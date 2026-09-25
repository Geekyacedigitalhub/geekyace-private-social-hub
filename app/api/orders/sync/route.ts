import { NextResponse } from "next/server";
import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providers, refills } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

async function recordSyncEvent(orderId: string, eventType: string, message: string, payload?: Record<string, unknown>) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.select({ id: orderEvents.id })
    .from(orderEvents)
    .where(and(
      eq(orderEvents.orderId, orderId),
      eq(orderEvents.eventType, eventType),
      gte(orderEvents.createdAt, since),
    ))
    .limit(1);

  if (recent.length > 0) return false;

  try {
    await db.insert(orderEvents).values({
      orderId,
      eventType,
      message,
      ...(payload ? { payload } : {}),
    });
    return true;
  } catch (error) {
    console.error("Automatic sync event logging failed:", error);
    return false;
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "order-sync", 4);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);

  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret || request.headers.get("x-sync-secret") !== secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    // Always take the oldest active orders. Each checked order has its
    // updatedAt refreshed below, so the next run naturally advances through
    // the active set without offset pagination skipping rows as ordering shifts.
    const active = await db.select().from(orders)
      .where(inArray(orders.status, ["pending", "processing"]))
      .orderBy(asc(orders.updatedAt))
      .limit(100);
    let updated = 0;
    let skippedProvider = 0;
    let providerFailures = 0;
    let unknownStatuses = 0;
    for (const order of active) {
      if (!order.providerId) continue;

      let providerOrderId = order.providerOrderId;
      if (!providerOrderId) {
        const submissionEvent = (await db
          .select({ payload: orderEvents.payload })
          .from(orderEvents)
          .where(and(
            eq(orderEvents.orderId, order.id),
            eq(orderEvents.eventType, "provider_submitted"),
          ))
          .orderBy(desc(orderEvents.createdAt))
          .limit(20))
          .find((event) => {
            if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return false;
            return typeof (event.payload as { providerOrderId?: unknown }).providerOrderId === "string";
          });

        const recoveredId = submissionEvent?.payload && typeof submissionEvent.payload === "object" && !Array.isArray(submissionEvent.payload)
          ? (submissionEvent.payload as { providerOrderId?: unknown }).providerOrderId
          : undefined;

        if (typeof recoveredId === "string" && recoveredId.trim() && recoveredId.length <= 256) {
          providerOrderId = recoveredId.trim();
          // Only recover an ID while the order is still active. A concurrent
          // status check may have finalized the order while we searched its events.
          const recovered = (await db.update(orders)
            .set({ status: "processing", providerOrderId, updatedAt: new Date() })
            .where(and(
              eq(orders.id, order.id),
              inArray(orders.status, ["pending", "processing"]),
            ))
            .returning({ id: orders.id })).at(0);

          // Another worker may have finalized the order while recovery was
          // reading the submission event. Stop here rather than querying the
          // provider with a stale active-order snapshot.
          if (!recovered) continue;

          try {
            await db.insert(orderEvents).values({
              orderId: order.id,
              eventType: "provider_submission_recovered",
              message: "Recovered upstream provider order ID from the submission event.",
            });
          } catch (eventError) {
            console.error("Provider recovery event logging failed:", eventError);
          }
        }
      }

      if (!providerOrderId) continue;
      const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
      if (!providerRow?.enabled) {
        skippedProvider++;
        await recordSyncEvent(order.id, "automatic_status_check_skipped", "Automatic synchronization skipped because the assigned provider is unavailable.");
        continue;
      }
      const provider = createProviderAdapter({ name: providerRow.name, baseUrl: providerRow.baseUrl, apiKey: process.env.PROVIDER_API_KEY ?? "" });
      let status;
      try {
        status = await provider.getOrderStatus(providerOrderId);
      } catch (providerError) {
        providerFailures++;
        await recordSyncEvent(order.id, "automatic_status_check_failed", "Automatic provider status synchronization failed.", { error: "Provider request failed." });
        continue;
      }
      if (status.status === "unknown") {
        unknownStatuses++;
        continue;
      }

      const nextStatus =
        ["completed", "failed", "cancelled"].includes(order.status)
          ? order.status
          : status.status;

      // Only update orders that are still active. A concurrent manual status
      // check can finalize an order while this provider request is in flight;
      // never let a stale sync response overwrite that terminal state.
      await db.update(orders).set({
        status: nextStatus,
        startCount: status.startCount,
        currentCount: status.currentCount,
        completedQuantity: status.completedQuantity,
        remains: status.remains,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, order.id),
        inArray(orders.status, ["pending", "processing"]),
      ));
      const changed = nextStatus !== order.status ||
        status.startCount !== order.startCount ||
        status.currentCount !== order.currentCount ||
        status.completedQuantity !== order.completedQuantity ||
        status.remains !== order.remains;

      if (changed) {
        try {
          await db.insert(orderEvents).values({
            orderId: order.id,
            eventType: "automatic_status_check",
            message: "Automatic provider status synchronization changed the order.",
            payload: { providerStatus: status.status, previousStatus: order.status, nextStatus },
          });
        } catch (eventError) {
          console.error("Automatic status event logging failed:", eventError);
        }
      }
      if (changed) updated++;
    }
    // Refill checks also update rows as they progress. Avoid offset pagination
    // because changing rows between runs can shift later refills and cause skips.
    const activeRefills = await db
      .select()
      .from(refills)
      .where(inArray(refills.status, ["requested", "processing"]))
      .orderBy(asc(refills.createdAt))
      .limit(100);
    let refillsUpdated = 0;

    for (const refill of activeRefills) {
      if (!refill.providerRefillId) continue;
      const order = (await db.select().from(orders).where(eq(orders.id, refill.orderId))).at(0);
      if (!order?.providerId) continue;
      const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
      if (!providerRow?.enabled) continue;

      const provider = createProviderAdapter({
        name: providerRow.name,
        baseUrl: providerRow.baseUrl,
        apiKey: process.env.PROVIDER_API_KEY ?? "",
      });

      if (!provider.getRefillStatus) continue;

      try {
        const raw = await provider.getRefillStatus(refill.providerRefillId);
        const providerStatus = normalizeRefillStatus(raw);
        if (!providerStatus) continue;

        const refillChanged = providerStatus !== refill.status;
        if (refillChanged) {
          // Do not let a stale provider response move a refill backward after
          // another worker has already finalized it.
          await db.update(refills).set({
            status: providerStatus,
            completedAt: providerStatus === "completed" || providerStatus === "failed" ? new Date() : refill.completedAt,
          }).where(and(
            eq(refills.id, refill.id),
            inArray(refills.status, ["requested", "processing"]),
          ));

          try {
            await db.insert(orderEvents).values({
              orderId: refill.orderId,
              eventType: "automatic_refill_status_check",
              message: "Provider refill status changed.",
              payload: { providerStatus, previousStatus: refill.status },
            });
          } catch (eventError) {
            console.error("Automatic refill status event logging failed:", eventError);
          }
          refillsUpdated++;
        }
      } catch {
        await recordSyncEvent(
          refill.orderId,
          "automatic_refill_status_check_failed",
          "Automatic provider refill status synchronization failed.",
          { error: "Provider request failed." },
        );
      }
    }

    return NextResponse.json({ ok: true, checked: active.length, updated, skippedProvider, providerFailures, unknownStatuses, refillsChecked: activeRefills.length, refillsUpdated }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Order synchronization failed:", error);
    return NextResponse.json({ ok: false, error: "Order synchronization failed." }, { status: 500 });
  }
}


function normalizeRefillStatus(value: unknown): "requested" | "processing" | "completed" | "failed" | null {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? String((value as { status?: unknown }).status ?? (value as { refill?: unknown }).refill ?? "")
    : String(value ?? "");
  const status = raw.toLowerCase();
  if (status.includes("complete") || status.includes("success") || status.includes("done")) return "completed";
  if (status.includes("fail") || status.includes("error") || status.includes("reject")) return "failed";
  if (status.includes("process") || status.includes("progress")) return "processing";
  if (status.includes("pending") || status.includes("request") || status.includes("await")) return "requested";
  return null;
}

import { NextResponse } from "next/server";
import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providers, refills } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

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

  await db.insert(orderEvents).values({
    orderId,
    eventType,
    message,
    ...(payload ? { payload } : {}),
  });
  return true;
}

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret || request.headers.get("x-sync-secret") !== secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const activeCountResult = await db.select({ count: count() }).from(orders).where(inArray(orders.status, ["pending", "processing"]));
    const activeCount = Number(activeCountResult.at(0)?.count ?? 0);
    const orderPages = Math.max(1, Math.ceil(activeCount / 100));
    const orderPage = Math.floor(Date.now() / (15 * 60 * 1000)) % orderPages;
    const active = await db.select().from(orders).where(inArray(orders.status, ["pending", "processing"])).orderBy(asc(orders.updatedAt)).limit(100).offset(orderPage * 100);
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
          .where(eq(orderEvents.orderId, order.id))
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
          await db.update(orders)
            .set({ status: "processing", providerOrderId, updatedAt: new Date() })
            .where(eq(orders.id, order.id));
          await db.insert(orderEvents).values({
            orderId: order.id,
            eventType: "provider_submission_recovered",
            message: "Recovered upstream provider order ID from the submission event.",
          });
        }
      }

      if (!providerOrderId) continue;
      const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
      if (!providerRow?.enabled) {
        skippedProvider++;
        await recordSyncEvent(order.id, "automatic_status_check_skipped", "Automatic synchronization skipped because the assigned provider is unavailable.");
        continue;
      }
      const provider = createProviderAdapter({ name: providerRow.name, baseUrl: providerRow.baseUrl || process.env.PROVIDER_API_BASE_URL || "", apiKey: process.env.PROVIDER_API_KEY ?? "" });
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

      await db.update(orders).set({
        status: nextStatus,
        startCount: status.startCount,
        currentCount: status.currentCount,
        completedQuantity: status.completedQuantity,
        remains: status.remains,
        updatedAt: new Date(),
      }).where(eq(orders.id, order.id));
      const changed = nextStatus !== order.status ||
        status.startCount !== order.startCount ||
        status.currentCount !== order.currentCount ||
        status.completedQuantity !== order.completedQuantity ||
        status.remains !== order.remains;

      if (changed) {
        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: "automatic_status_check",
          message: "Automatic provider status synchronization changed the order.",
          payload: { providerStatus: status.status, previousStatus: order.status, nextStatus },
        });
      }
      if (changed) updated++;
    }
    const refillCountResult = await db.select({ count: count() }).from(refills).where(inArray(refills.status, ["requested", "processing"]));
    const refillCount = Number(refillCountResult.at(0)?.count ?? 0);
    const refillPages = Math.max(1, Math.ceil(refillCount / 100));
    const refillPage = Math.floor(Date.now() / (15 * 60 * 1000)) % refillPages;
    const activeRefills = await db.select().from(refills).where(inArray(refills.status, ["requested", "processing"])).orderBy(asc(refills.createdAt)).limit(100).offset(refillPage * 100);
    let refillsUpdated = 0;

    for (const refill of activeRefills) {
      if (!refill.providerRefillId) continue;
      const order = (await db.select().from(orders).where(eq(orders.id, refill.orderId))).at(0);
      if (!order?.providerId) continue;
      const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
      if (!providerRow?.enabled) continue;

      const provider = createProviderAdapter({
        name: providerRow.name,
        baseUrl: providerRow.baseUrl || process.env.PROVIDER_API_BASE_URL || "",
        apiKey: process.env.PROVIDER_API_KEY ?? "",
      });

      if (!provider.getRefillStatus) continue;

      try {
        const raw = await provider.getRefillStatus(refill.providerRefillId);
        const providerStatus = normalizeRefillStatus(raw);
        if (!providerStatus) continue;

        const refillChanged = providerStatus !== refill.status;
        if (refillChanged) {
          await db.update(refills).set({
            status: providerStatus,
            completedAt: providerStatus === "completed" || providerStatus === "failed" ? new Date() : refill.completedAt,
          }).where(eq(refills.id, refill.id));

          await db.insert(orderEvents).values({
            orderId: refill.orderId,
            eventType: "automatic_refill_status_check",
            message: "Provider refill status changed.",
            payload: { providerStatus, previousStatus: refill.status },
          });
          refillsUpdated++;
        }
      } catch {
        await db.insert(orderEvents).values({
          orderId: refill.orderId,
          eventType: "automatic_refill_status_check_failed",
          message: "Automatic provider refill status synchronization failed.",
          payload: { error: "Provider request failed." },
        });
      }
    }

    return NextResponse.json({ ok: true, checked: active.length, updated, skippedProvider, providerFailures, unknownStatuses, refillsChecked: activeRefills.length, refillsUpdated });
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

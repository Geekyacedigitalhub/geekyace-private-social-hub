import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providers, refills } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const SYNC_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function run() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

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

type OrderSyncResult = {
  updated: boolean;
  skippedProvider: boolean;
  providerFailure: boolean;
  unknownStatus: boolean;
};

type RefillSyncResult = {
  updated: boolean;
};

export async function POST(request: Request) {
  const limited = rateLimit(request, "order-sync", 4);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);

  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret || request.headers.get("x-sync-secret") !== secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    // Always take the oldest active orders. Each checked order has its
    // updatedAt refreshed below, so the next run naturally advances through
    // the active set without offset pagination skipping rows as ordering shifts.
    const active = await db.select({
      id: orders.id,
      providerId: orders.providerId,
      providerOrderId: orders.providerOrderId,
      status: orders.status,
      startCount: orders.startCount,
      currentCount: orders.currentCount,
      completedQuantity: orders.completedQuantity,
      remains: orders.remains,
      updatedAt: orders.updatedAt,
    }).from(orders)
      .where(inArray(orders.status, ["pending", "processing"]))
      .orderBy(asc(orders.updatedAt))
      .limit(100);
    // Cache provider configuration and adapters for the whole sync run.
    // This removes one providers query and adapter construction per active order/refill.
    const providerRows = await db.select({
      id: providers.id,
      name: providers.name,
      baseUrl: providers.baseUrl,
      enabled: providers.enabled,
    }).from(providers);
    const providerById = new Map(providerRows.map((provider) => [provider.id, provider]));
    const providerAdapterById = new Map<string, ReturnType<typeof createProviderAdapter>>();
    const getProviderAdapter = (providerRow: typeof providerRows[number]) => {
      const cached = providerAdapterById.get(providerRow.id);
      if (cached) return cached;
      const adapter = createProviderAdapter({
        name: providerRow.name,
        baseUrl: providerRow.baseUrl,
        apiKey: process.env.PROVIDER_API_KEY ?? "",
      });
      providerAdapterById.set(providerRow.id, adapter);
      return adapter;
    };

    // Recover missing upstream IDs in one indexed query instead of one
    // order_events query per order. Preserve the previous "latest 20 events"
    // recovery window for each order.
    const ordersNeedingRecovery = active.filter((order) => !order.providerOrderId).map((order) => order.id);
    const recoveredProviderOrderIdByOrderId = new Map<string, string>();
    if (ordersNeedingRecovery.length > 0) {
      const submissionEvents = await db
        .select({ orderId: orderEvents.orderId, payload: orderEvents.payload })
        .from(orderEvents)
        .where(and(
          inArray(orderEvents.orderId, ordersNeedingRecovery),
          eq(orderEvents.eventType, "provider_submitted"),
        ))
        .orderBy(desc(orderEvents.createdAt));

      const eventsSeenByOrder = new Map<string, number>();
      for (const event of submissionEvents) {
        const seen = eventsSeenByOrder.get(event.orderId) ?? 0;
        if (seen >= 20) continue;
        eventsSeenByOrder.set(event.orderId, seen + 1);
        if (recoveredProviderOrderIdByOrderId.has(event.orderId)) continue;
        if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) continue;

        const recoveredId = (event.payload as { providerOrderId?: unknown }).providerOrderId;
        if (typeof recoveredId === "string" && recoveredId.trim() && recoveredId.length <= 256) {
          recoveredProviderOrderIdByOrderId.set(event.orderId, recoveredId.trim());
        }
      }
    }

    const orderResults = await mapWithConcurrency(active, SYNC_CONCURRENCY, async (order): Promise<OrderSyncResult> => {
      if (!order.providerId) return { updated: false, skippedProvider: false, providerFailure: false, unknownStatus: false };

      let providerOrderId = order.providerOrderId;
      if (!providerOrderId) {
        const recoveredId = recoveredProviderOrderIdByOrderId.get(order.id);

        if (recoveredId) {
          providerOrderId = recoveredId;
          const recovered = (await db.update(orders)
            .set({ status: "processing", providerOrderId, updatedAt: new Date() })
            .where(and(
              eq(orders.id, order.id),
              inArray(orders.status, ["pending", "processing"]),
            ))
            .returning({ id: orders.id })).at(0);

          if (!recovered) return { updated: false, skippedProvider: false, providerFailure: false, unknownStatus: false };

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

      if (!providerOrderId) return { updated: false, skippedProvider: false, providerFailure: false, unknownStatus: false };
      const providerRow = providerById.get(order.providerId);
      if (!providerRow?.enabled) {
        await recordSyncEvent(order.id, "automatic_status_check_skipped", "Automatic synchronization skipped because the assigned provider is unavailable.");
        return { updated: false, skippedProvider: true, providerFailure: false, unknownStatus: false };
      }
      const provider = getProviderAdapter(providerRow);
      let status;
      try {
        status = await provider.getOrderStatus(providerOrderId);
      } catch (providerError) {
        await recordSyncEvent(order.id, "automatic_status_check_failed", "Automatic provider status synchronization failed.", { error: "Provider request failed." });
        return { updated: false, skippedProvider: false, providerFailure: true, unknownStatus: false };
      }
      if (status.status === "unknown") {
        return { updated: false, skippedProvider: false, providerFailure: false, unknownStatus: true };
      }

      const nextStatus =
        ["completed", "partial", "failed", "cancelled"].includes(order.status)
          ? order.status
          : status.status;

      const updatedOrder = (await db.update(orders).set({
        status: nextStatus,
        startCount: status.startCount,
        currentCount: status.currentCount,
        completedQuantity: status.completedQuantity,
        remains: status.remains,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, order.id),
        inArray(orders.status, ["pending", "processing"]),
      )).returning({ id: orders.id })).at(0);

      if (!updatedOrder) return { updated: false, skippedProvider: false, providerFailure: false, unknownStatus: false };

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

      return { updated: changed, skippedProvider: false, providerFailure: false, unknownStatus: false };
    });

    const updated = orderResults.filter((result) => result.updated).length;
    const skippedProvider = orderResults.filter((result) => result.skippedProvider).length;
    const providerFailures = orderResults.filter((result) => result.providerFailure).length;
    const unknownStatuses = orderResults.filter((result) => result.unknownStatus).length;

    const activeRefills = await db
      .select({
        id: refills.id,
        orderId: refills.orderId,
        providerRefillId: refills.providerRefillId,
        status: refills.status,
        completedAt: refills.completedAt,
        createdAt: refills.createdAt,
      })
      .from(refills)
      .where(inArray(refills.status, ["requested", "processing"]))
      .orderBy(asc(refills.createdAt))
      .limit(100);
    const refillOrderIds = activeRefills.map((refill) => refill.orderId);
    const refillOrders = refillOrderIds.length > 0
      ? await db.select({
          id: orders.id,
          providerId: orders.providerId,
        }).from(orders).where(inArray(orders.id, refillOrderIds))
      : [];
    const refillOrderById = new Map(refillOrders.map((order) => [order.id, order]));
    const refillResults = await mapWithConcurrency(activeRefills, SYNC_CONCURRENCY, async (refill): Promise<RefillSyncResult> => {
      if (!refill.providerRefillId) return { updated: false };
      const order = refillOrderById.get(refill.orderId);
      if (!order?.providerId) return { updated: false };
      const providerRow = providerById.get(order.providerId);
      if (!providerRow?.enabled) return { updated: false };

      const provider = getProviderAdapter(providerRow);
      if (!provider.getRefillStatus) return { updated: false };

      try {
        const raw = await provider.getRefillStatus(refill.providerRefillId);
        const providerStatus = normalizeRefillStatus(raw);
        if (!providerStatus) return { updated: false };

        const refillChanged = providerStatus !== refill.status;
        if (!refillChanged) return { updated: false };

        const updatedRefill = (await db.update(refills).set({
          status: providerStatus,
          completedAt: providerStatus === "completed" || providerStatus === "failed" ? new Date() : refill.completedAt,
        }).where(and(
          eq(refills.id, refill.id),
          inArray(refills.status, ["requested", "processing"]),
        )).returning({ id: refills.id })).at(0);

        if (!updatedRefill) return { updated: false };

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
        return { updated: true };
      } catch {
        await recordSyncEvent(
          refill.orderId,
          "automatic_refill_status_check_failed",
          "Automatic provider refill status synchronization failed.",
          { error: "Provider request failed." },
        );
        return { updated: false };
      }
    });

    const refillsUpdated = refillResults.filter((result) => result.updated).length;

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

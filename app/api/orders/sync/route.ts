import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providers, refills } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret || request.headers.get("x-sync-secret") !== secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const active = await db.select().from(orders).where(inArray(orders.status, ["pending", "processing"]));
    let updated = 0;
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
        await db.insert(orderEvents).values({ orderId: order.id, eventType: "automatic_status_check_skipped", message: "Automatic synchronization skipped because the assigned provider is unavailable." });
        continue;
      }
      const provider = createProviderAdapter({ name: providerRow.name, baseUrl: providerRow.baseUrl || process.env.PROVIDER_API_BASE_URL || "", apiKey: process.env.PROVIDER_API_KEY ?? "" });
      let status;
      try {
        status = await provider.getOrderStatus(providerOrderId);
      } catch (providerError) {
        await db.insert(orderEvents).values({ orderId: order.id, eventType: "automatic_status_check_failed", message: "Automatic provider status synchronization failed.", payload: { error: "Provider request failed." } });
        continue;
      }
      if (status.status === "unknown") continue;

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
      await db.insert(orderEvents).values({ orderId: order.id, eventType: "automatic_status_check", message: "Automatic provider status synchronization completed.", payload: { providerStatus: status.status } });
      updated++;
    }
    const activeRefills = await db.select().from(refills).where(inArray(refills.status, ["requested", "processing"]));
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

        await db.update(refills).set({
          status: providerStatus,
          completedAt: providerStatus === "completed" || providerStatus === "failed" ? new Date() : refill.completedAt,
        }).where(eq(refills.id, refill.id));

        await db.insert(orderEvents).values({
          orderId: refill.orderId,
          eventType: "automatic_refill_status_check",
          message: "Provider refill status synchronized.",
          payload: { providerStatus },
        });
        refillsUpdated++;
      } catch {
        await db.insert(orderEvents).values({
          orderId: refill.orderId,
          eventType: "automatic_refill_status_check_failed",
          message: "Automatic provider refill status synchronization failed.",
          payload: { error: "Provider request failed." },
        });
      }
    }

    return NextResponse.json({ ok: true, checked: active.length, updated, refillsChecked: activeRefills.length, refillsUpdated });
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

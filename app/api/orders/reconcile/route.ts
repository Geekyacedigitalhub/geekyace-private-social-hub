import { NextResponse } from "next/server";
import { and, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const MAX_RECOVERIES = 50;

export async function POST(request: Request) {
  const limited = rateLimit(request, "orders-reconcile", 5);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);

  const expectedSecret = process.env.INTERNAL_SYNC_SECRET?.trim();
  const suppliedSecret = request.headers.get("x-internal-sync-secret")?.trim();
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const candidates = await db
      .select({ order: orders })
      .from(orders)
      .where(inArray(orders.status, ["pending", "processing"]))
      .orderBy(desc(orders.updatedAt))
      .limit(MAX_RECOVERIES);

    let recovered = 0;
    for (const { order } of candidates) {
      if (order.providerOrderId) continue;

      const events = await db
        .select()
        .from(orderEvents)
        .where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.eventType, "provider_submitted")))
        .orderBy(desc(orderEvents.createdAt))
        .limit(1);

      const payload = events[0]?.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;

      const providerOrderId = typeof payload.providerOrderId === "string" ? payload.providerOrderId.trim() : "";
      if (!providerOrderId || providerOrderId.length > 256) continue;

      const updated = (
        await db.update(orders)
          .set({ status: "processing", providerOrderId, updatedAt: new Date() })
          .where(and(eq(orders.id, order.id), eq(orders.providerOrderId, null)))
          .returning()
      ).at(0);

      if (updated) {
        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: "provider_submission_recovered",
          message: "Recovered provider order ID from the submission event.",
          payload: { providerOrderId },
        });
        recovered++;
      }
    }

    return NextResponse.json({ ok: true, checked: candidates.length, recovered });
  } catch (error) {
    console.error("Order reconciliation failed:", error);
    return NextResponse.json({ ok: false, error: "Order reconciliation failed." }, { status: 500 });
  }
}

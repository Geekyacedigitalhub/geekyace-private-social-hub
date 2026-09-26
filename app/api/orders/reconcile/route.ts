import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";
import { requireSameOrigin } from "@/lib/security/csrf";

export async function POST(request: Request) {
  const limited = rateLimit(request, "order-reconcile", 10);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);

  const denied = await requireOwner();
  if (denied) return denied;

  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  try {
    const body = (await request.json()) as { orderId?: string; reason?: string };
    const orderId = String(body.orderId ?? "").trim();
    const reason = String(body.reason ?? "").trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    }
    if (!reason || reason.length > 500) {
      return NextResponse.json({ error: "A reconciliation reason is required and must be 500 characters or fewer." }, { status: 400 });
    }

    const updated = (await db.update(orders).set({
      status: "failed",
      errorMessage: reason,
      updatedAt: new Date(),
    }).where(and(
      eq(orders.id, orderId),
      eq(orders.status, "pending"),
    )).returning()).at(0);

    if (!updated) {
      return NextResponse.json(
        { error: "Only a currently pending order can be reconciled. Orders with a provider ID are not eligible for this action." },
        { status: 409 },
      );
    }

    if (updated.providerOrderId) {
      return NextResponse.json(
        { error: "This order has a provider order ID and cannot be reconciled through the unresolved-order path." },
        { status: 409 },
      );
    }

    await db.insert(orderEvents).values({
      orderId,
      eventType: "manual_reconciliation",
      message: "Owner manually reconciled an unresolved provider submission as failed.",
      payload: { reason, providerOrderIdPresent: false },
    });

    return NextResponse.json({ ok: true, order: updated }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Order reconciliation failed:", error);
    return NextResponse.json({ error: "Unable to reconcile order." }, { status: 500 });
  }
}

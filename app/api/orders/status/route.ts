import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providers } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { orderId?: string };
    const orderId = String(body.orderId ?? "").trim();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const order = (await db.select().from(orders).where(eq(orders.id, orderId))).at(0);
    if (!order || !order.providerOrderId || !order.providerId) {
      return NextResponse.json({ error: "Order or provider order ID not found." }, { status: 404 });
    }

    const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
    if (!providerRow?.enabled) {
      return NextResponse.json({ error: "The provider assigned to this order is unavailable." }, { status: 409 });
    }

    const provider = createProviderAdapter({
      name: providerRow.name,
      baseUrl: providerRow.baseUrl || process.env.PROVIDER_API_BASE_URL || "",
      apiKey: process.env.PROVIDER_API_KEY ?? "",
    });

    const status = await provider.getOrderStatus(order.providerOrderId);
    const updated = (await db.update(orders).set({
      status: status.status === "unknown" ? order.status : status.status,
      startCount: status.startCount,
      currentCount: status.currentCount,
      completedQuantity: status.completedQuantity,
      remains: status.remains,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id)).returning()).at(0);

    await db.insert(orderEvents).values({
      orderId: order.id,
      eventType: "status_check",
      message: "Provider status checked.",
      payload: status.raw ? { providerResponse: status.raw } : null,
    });

    return NextResponse.json({ ok: true, order: updated, providerStatus: status.status });
  } catch (error) {
    console.error("Order status check failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to update order status." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret || request.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const active = await db.select().from(orders)
      .where(inArray(orders.status, ["pending", "processing"]));

    let updated = 0;
    for (const order of active) {
      if (!order.providerOrderId || !order.providerId) continue;

      const provider = createProviderAdapter({
        name: order.providerId,
        baseUrl: process.env.PROVIDER_API_BASE_URL ?? "",
        apiKey: process.env.PROVIDER_API_KEY ?? "",
      });

      let status;
      try {
        status = await provider.getOrderStatus(order.providerOrderId);
      } catch (providerError) {
        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: "automatic_status_check_failed",
          message: "Automatic provider status synchronization failed.",
          payload: {
            error: providerError instanceof Error ? providerError.message : "Provider request failed.",
          },
        });
        continue;
      }

      if (status.status === "unknown") continue;

      await db.update(orders).set({
        status: status.status,
        startCount: status.startCount,
        currentCount: status.currentCount,
        completedQuantity: status.completedQuantity,
        remains: status.remains,
        updatedAt: new Date(),
      }).where(eq(orders.id, order.id));

      await db.insert(orderEvents).values({
        orderId: order.id,
        eventType: "automatic_status_check",
        message: "Automatic provider status synchronization completed.",
        payload: status.raw ? { providerResponse: status.raw } : null,
      });

      updated++;
    }

    return NextResponse.json({ ok: true, checked: active.length, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order synchronization failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

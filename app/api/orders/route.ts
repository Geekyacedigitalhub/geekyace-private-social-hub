import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providerServices, services } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      serviceId?: string;
      target?: string;
      quantity?: number;
    };

    const serviceId = String(body.serviceId ?? "").trim();
    const target = String(body.target ?? "").trim();
    const quantity = Number(body.quantity);

    if (!serviceId || !target || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Service, target, and a valid quantity are required." }, { status: 400 });
    }

    const service = (await db.select().from(services).where(eq(services.id, serviceId))).at(0);
    if (!service || !service.enabled) {
      return NextResponse.json({ error: "Service is unavailable." }, { status: 404 });
    }

    if (quantity < service.minQuantity || quantity > service.maxQuantity) {
      return NextResponse.json({
        error: "Quantity must be between " + service.minQuantity + " and " + service.maxQuantity + ".",
      }, { status: 400 });
    }

    const mapping = (await db.select().from(providerServices)
      .where(eq(providerServices.serviceId, service.id)))
      .find((item) => item.active);

    if (!mapping) {
      return NextResponse.json({ error: "No active provider mapping exists for this service." }, { status: 409 });
    }

    const provider = createProviderAdapter({
      name: mapping.providerId,
      baseUrl: process.env.PROVIDER_API_BASE_URL ?? "",
      apiKey: process.env.PROVIDER_API_KEY ?? "",
    });

    const created = await provider.createOrder({
      serviceId: mapping.externalServiceId,
      target,
      quantity,
    });

    const inserted = await db.insert(orders).values({
      serviceId: service.id,
      target,
      quantity,
      status: "processing",
      providerId: mapping.providerId,
      providerOrderId: created.providerOrderId,
    }).returning();

    const order = inserted[0];
    if (!order) throw new Error("Order record could not be created.");

    await db.insert(orderEvents).values({
      orderId: order.id,
      eventType: "created",
      message: "Order created with upstream provider.",
      payload: created.raw ? { providerResponse: created.raw } : null,
    });

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create order.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providerServices, providers, services } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";


export async function POST(request: Request) {
  const limited = rateLimit(request, "orders-create", 10);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  try {
    const body = (await request.json()) as { serviceId?: string; target?: string; quantity?: number };
    const serviceId = String(body.serviceId ?? "").trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(serviceId)) return NextResponse.json({ error: "Invalid service ID." }, { status: 400 });
    const target = String(body.target ?? "").trim();
    if (target.length > 2048) return NextResponse.json({ error: "Target is too long." }, { status: 400 });
    const quantity = Number(body.quantity);
    if (!serviceId || !target || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Service, target, and a valid quantity are required." }, { status: 400 });
    }
    const service = (await db.select().from(services).where(eq(services.id, serviceId))).at(0);
    if (!service || !service.enabled) return NextResponse.json({ error: "Service is unavailable." }, { status: 404 });
    if (quantity < service.minQuantity || quantity > service.maxQuantity) {
      return NextResponse.json({ error: "Quantity must be between " + service.minQuantity + " and " + service.maxQuantity + "." }, { status: 400 });
    }
    const mapping = (await db.select({ mapping: providerServices, provider: providers }).from(providerServices).innerJoin(providers, eq(providerServices.providerId, providers.id)).where(eq(providerServices.serviceId, service.id))).find(({ mapping, provider }) => mapping.active && provider.enabled);
    if (!mapping) return NextResponse.json({ error: "No active provider mapping exists for this service." }, { status: 409 });
    const providerMin = mapping.mapping.minQuantity ?? service.minQuantity;
    const providerMax = mapping.mapping.maxQuantity ?? service.maxQuantity;
    if (quantity < providerMin || quantity > providerMax) return NextResponse.json({ error: "Quantity must be between " + providerMin + " and " + providerMax + " for the selected provider." }, { status: 400 });
    const inserted = await db.insert(orders).values({ serviceId: service.id, target, quantity, status: "pending", providerId: mapping.provider.id }).returning();
    const order = inserted[0];
    if (!order) throw new Error("Order record could not be created.");
    try {
      await db.insert(orderEvents).values({ orderId: order.id, eventType: "created", message: "Local order created; awaiting upstream provider submission." });
    } catch (eventError) {
      console.error("Order creation event logging failed:", eventError);
    }
    try {
      const provider = createProviderAdapter({ name: mapping.provider.name, baseUrl: mapping.provider.baseUrl, apiKey: process.env.PROVIDER_API_KEY ?? "" });
      const created = await provider.createOrder({ serviceId: mapping.mapping.externalServiceId, target, quantity });
      let updated = (await db.update(orders).set({ status: "processing", providerOrderId: created.providerOrderId, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning()).at(0);
      if (!updated) {
        for (let attempt = 0; attempt < 2 && !updated; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          updated = (await db.update(orders).set({ status: "processing", providerOrderId: created.providerOrderId, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning()).at(0);
        }
      }
      if (!updated) {
        console.error("Provider order created but local order update failed:", order.id);
        return NextResponse.json({ ok: false, error: "Order was submitted, but local status synchronization is pending. Do not resubmit this order." }, { status: 503 });
      }

      try {
        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: "provider_submitted",
          message: "Order submitted to upstream provider.",
          payload: { providerOrderId: created.providerOrderId },
        });
      } catch (eventError) {
        console.error("Provider submission event logging failed:", eventError);
      }

      return NextResponse.json({ ok: true, order: updated });
    } catch {
      await db.update(orders).set({ status: "failed", errorMessage: "Upstream provider submission failed.", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await db.insert(orderEvents).values({ orderId: order.id, eventType: "provider_submission_failed", message: "Order could not be submitted to upstream provider." });
      return NextResponse.json({ ok: false, error: "Order could not be submitted to the configured provider." }, { status: 502 });
    }
  } catch (error) {
    console.error("Order creation failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to create order." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "orders-read", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  try {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200);
    return NextResponse.json({ orders: rows }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Order list failed:", error);
    return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
  }
}

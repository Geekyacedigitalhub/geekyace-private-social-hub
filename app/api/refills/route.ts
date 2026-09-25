import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providerServices, providers, refills } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const rows = await db.select().from(refills).orderBy(refills.createdAt);
    return NextResponse.json({ refills: rows });
  } catch (error) {
    console.error("Refill list failed:", error);
    return NextResponse.json({ error: "Unable to load refills." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "refill-create", 10);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  try {
    const body = (await request.json()) as { orderId?: string };
    const orderId = String(body.orderId ?? "").trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(orderId)) return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });

    const order = (await db.select().from(orders).where(eq(orders.id, orderId))).at(0);
    if (!order?.providerOrderId || !order.providerId) {
      return NextResponse.json({ error: "Order is not linked to a provider." }, { status: 404 });
    }

    const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
    if (!providerRow?.enabled) return NextResponse.json({ error: "Assigned provider is unavailable." }, { status: 409 });

    const mapping = (await db.select().from(providerServices).where(and(eq(providerServices.providerId, order.providerId), eq(providerServices.serviceId, order.serviceId), eq(providerServices.active, true)))).at(0);
    if (!mapping?.refillSupported) {
      return NextResponse.json({ error: "Refill is not enabled for this service." }, { status: 409 });
    }

    const existing = (await db.select().from(refills).where(and(eq(refills.orderId, order.id), inArray(refills.status, ["eligible", "requested", "processing"])))).at(0);
    if (existing) {
      return NextResponse.json({ error: "An active refill request already exists for this order." }, { status: 409 });
    }

    const provider = createProviderAdapter({
      name: providerRow.name,
      baseUrl: providerRow.baseUrl || process.env.PROVIDER_API_BASE_URL || "",
      apiKey: process.env.PROVIDER_API_KEY ?? "",
    });

    if (!provider.requestRefill) {
      return NextResponse.json({ error: "The configured provider does not support refill requests." }, { status: 409 });
    }

    const created = await provider.requestRefill(order.providerOrderId);
    const inserted = (await db.insert(refills).values({
      orderId: order.id,
      providerRefillId: created.providerRefillId,
      status: "requested",
      requestedAt: new Date(),
    }).returning()).at(0);

    await db.insert(orderEvents).values({
      orderId: order.id,
      eventType: "refill_requested",
      message: "Refill request submitted to upstream provider.",
      payload: { providerRefillId: created.providerRefillId },
    });

    return NextResponse.json({ ok: true, refill: inserted });
  } catch (error) {
    console.error("Refill request failed:", error);
    return NextResponse.json({ ok: false, error: "Refill request failed." }, { status: 502 });
  }
}

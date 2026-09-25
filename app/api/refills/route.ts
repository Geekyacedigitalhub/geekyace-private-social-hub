import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, providers, refills } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

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
  try {
    const body = (await request.json()) as { orderId?: string };
    const orderId = String(body.orderId ?? "").trim();
    if (!orderId) return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    const order = (await db.select().from(orders).where(eq(orders.id, orderId))).at(0);
    if (!order?.providerOrderId || !order.providerId) return NextResponse.json({ error: "Order is not linked to a provider." }, { status: 404 });
    const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
    if (!providerRow?.enabled) return NextResponse.json({ error: "Assigned provider is unavailable." }, { status: 409 });
    const provider = createProviderAdapter({ name: providerRow.name, baseUrl: providerRow.baseUrl || process.env.PROVIDER_API_BASE_URL || "", apiKey: process.env.PROVIDER_API_KEY ?? "" });
    if (!provider.getRefillStatus) return NextResponse.json({ error: "This provider adapter does not expose refill status." }, { status: 409 });
    const result = await provider.getRefillStatus(order.providerOrderId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Refill request failed:", error);
    return NextResponse.json({ error: "Refill request failed." }, { status: 502 });
  }
}

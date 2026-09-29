import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providers, services } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, "transactions-read", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;

  try {
    const raw = Number(new URL(request.url).searchParams.get("limit") ?? 200);
    const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 200) : 200;
    const rows = await db.select({
      id: orderEvents.id,
      orderId: orders.id,
      type: orderEvents.eventType,
      message: orderEvents.message,
      status: orders.status,
      target: orders.target,
      quantity: orders.quantity,
      service: services.name,
      provider: providers.name,
      createdAt: orderEvents.createdAt,
    }).from(orderEvents)
      .innerJoin(orders, eq(orderEvents.orderId, orders.id))
      .innerJoin(services, eq(orders.serviceId, services.id))
      .leftJoin(providers, eq(orders.providerId, providers.id))
      .orderBy(desc(orderEvents.createdAt))
      .limit(limit);

    return NextResponse.json({ transactions: rows }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Transaction activity load failed:", error);
    return NextResponse.json({ error: "Unable to load transaction activity." }, { status: 500 });
  }
}
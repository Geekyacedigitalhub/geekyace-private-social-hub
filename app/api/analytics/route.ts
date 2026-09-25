import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, orderEvents, refills } from "@/lib/db/schema";

export async function GET(request: Request) {
  const limited = rateLimit(request, "analytics-read", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  try {
    const [total, active, completed, failed, refillCount, eventCount, quantity] = await Promise.all([
      db.select({ value: count() }).from(orders),
      db.select({ value: count() }).from(orders).where(sql`${orders.status} in ('pending','processing')`),
      db.select({ value: count() }).from(orders).where(eq(orders.status, "completed")),
      db.select({ value: count() }).from(orders).where(eq(orders.status, "failed")),
      db.select({ value: count() }).from(refills),
      db.select({ value: count() }).from(orderEvents),
      db.select({ value: sql<number>`coalesce(sum(${orders.quantity}),0)` }).from(orders),
    ]);

    return NextResponse.json({
      totalOrders: Number(total[0]?.value ?? 0),
      activeOrders: Number(active[0]?.value ?? 0),
      completedOrders: Number(completed[0]?.value ?? 0),
      failedOrders: Number(failed[0]?.value ?? 0),
      refillRecords: Number(refillCount[0]?.value ?? 0),
      events: Number(eventCount[0]?.value ?? 0),
      totalQuantity: Number(quantity[0]?.value ?? 0),
    });
  } catch (error) {
    console.error("Analytics query failed:", error);
    return NextResponse.json({ error: "Unable to load analytics." }, { status: 500 });
  }
}

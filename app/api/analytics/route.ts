import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, orderEvents, refills } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";

export async function GET(request: Request) {
  const limited = rateLimit(request, "analytics-read", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    // Keep the dashboard metrics in one aggregate query instead of seven
    // independent round-trips. The FILTER clauses preserve the existing
    // per-status counts while allowing Postgres to aggregate in one scan.
    const [metrics] = await Promise.all([
      db
        .select({
          totalOrders: count(orders.id),
          activeOrders: sql<number>`count(*) filter (where ${orders.status} in ('pending','processing'))`,
          completedOrders: sql<number>`count(*) filter (where ${orders.status} = 'completed')`,
          failedOrders: sql<number>`count(*) filter (where ${orders.status} = 'failed')`,
          totalQuantity: sql<number>`coalesce(sum(${orders.quantity}),0)`,
        })
        .from(orders),
      db.select({ value: count() }).from(refills),
      db.select({ value: count() }).from(orderEvents),
    ]).then(async ([orderMetrics, refillResult, eventResult]) => ({
      orderMetrics: orderMetrics[0],
      refillCount: Number(refillResult[0]?.value ?? 0),
      eventCount: Number(eventResult[0]?.value ?? 0),
    }));

    return NextResponse.json({
      totalOrders: Number(metrics.orderMetrics?.totalOrders ?? 0),
      activeOrders: Number(metrics.orderMetrics?.activeOrders ?? 0),
      completedOrders: Number(metrics.orderMetrics?.completedOrders ?? 0),
      failedOrders: Number(metrics.orderMetrics?.failedOrders ?? 0),
      refillRecords: metrics.refillCount,
      events: metrics.eventCount,
      totalQuantity: Number(metrics.orderMetrics?.totalQuantity ?? 0),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Analytics query failed:", error);
    return NextResponse.json({ error: "Unable to load analytics." }, { status: 500 });
  }
}

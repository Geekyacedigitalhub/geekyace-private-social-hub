import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { platforms, services } from "@/lib/db/schema";

export async function GET(request: Request) {
  const limited = rateLimit(request, "services-read", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  try {
    const rows = await db
      .select({
        id: services.id,
        name: services.name,
        platform: platforms.name,
        min: services.minQuantity,
        max: services.maxQuantity,
      })
      .from(services)
      .innerJoin(platforms, eq(services.platformId, platforms.id))
      .where(eq(services.enabled, true));

    return NextResponse.json({ services: rows });
  } catch (error) {
    console.error("Services query failed:", error);
    return NextResponse.json({ error: "Unable to load services." }, { status: 500 });
  }
}

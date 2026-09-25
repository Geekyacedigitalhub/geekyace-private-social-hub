import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { platforms, services } from "@/lib/db/schema";

export async function GET() {
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

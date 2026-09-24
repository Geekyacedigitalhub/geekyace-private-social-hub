import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, orderEvents } from "@/lib/db/schema";

export async function GET() {
  const [events, audits] = await Promise.all([
    db.select().from(orderEvents).orderBy(desc(orderEvents.createdAt)).limit(100),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100),
  ]);
  return NextResponse.json({ events, audits });
}

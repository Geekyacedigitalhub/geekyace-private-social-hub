import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, orderEvents } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";

export async function GET(request: Request) {
  const limited = rateLimit(request,"logs-read",20);
  if(!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied=await requireOwner();
  if(denied) return denied;
  try {
    const [events,audits]=await Promise.all([
      db.select().from(orderEvents).orderBy(desc(orderEvents.createdAt)).limit(100),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100),
    ]);
    return NextResponse.json({events,audits},{headers:{"Cache-Control":"no-store, max-age=0"}});
  } catch(error){console.error("Logs query failed:",error);return NextResponse.json({error:"Unable to load logs."},{status:500});}
}

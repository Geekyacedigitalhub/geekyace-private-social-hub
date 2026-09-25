import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { platforms, providerServices, providers, services } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";

export async function GET(request: Request) {
  const limited = rateLimit(request,"services-read",30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied=await requireOwner();
  if (denied) return denied;
  try {
    const rows=await db.selectDistinct({id:services.id,name:services.name,platform:platforms.name,min:services.minQuantity,max:services.maxQuantity}).from(services).innerJoin(platforms,eq(services.platformId,platforms.id)).innerJoin(providerServices,and(eq(providerServices.serviceId,services.id),eq(providerServices.active,true))).innerJoin(providers,and(eq(providerServices.providerId,providers.id),eq(providers.enabled,true))).where(eq(services.enabled,true));
    return NextResponse.json({services:rows},{headers:{"Cache-Control":"no-store, max-age=0"}});
  } catch(error){console.error("Services query failed:",error);return NextResponse.json({error:"Unable to load services."},{status:500});}
}

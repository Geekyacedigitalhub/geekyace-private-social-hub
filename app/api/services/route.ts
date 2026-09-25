import { and, eq, exists, sql } from "drizzle-orm";
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
    const rows=await db
      .select({
        id: services.id,
        name: services.name,
        platform: platforms.name,
        min: services.minQuantity,
        max: services.maxQuantity,
        serviceType: sql<string>`coalesce((
          select provider_services.metadata->>'serviceType'
          from provider_services
          inner join providers on provider_services.provider_id = providers.id
          where provider_services.service_id = services.id
            and provider_services.active = true
            and providers.enabled = true
          order by provider_services.created_at desc
          limit 1
        ), 'other')`,
      })
      .from(services)
      .innerJoin(platforms, eq(services.platformId, platforms.id))
      .where(and(
        eq(services.enabled, true),
        exists(
          db
            .select({ id: providerServices.id })
            .from(providerServices)
            .innerJoin(providers, eq(providerServices.providerId, providers.id))
            .where(and(
              eq(providerServices.serviceId, services.id),
              eq(providerServices.active, true),
              eq(providers.enabled, true),
            )),
        ),
      ));
    return NextResponse.json({services:rows},{headers:{"Cache-Control":"no-store, max-age=0"}});
  } catch(error){console.error("Services query failed:",error);return NextResponse.json({error:"Unable to load services."},{status:500});}
}

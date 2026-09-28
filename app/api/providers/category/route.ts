import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platforms, providerServices, providers, services } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";

function inferType(name: string) {
  const value = name.toLowerCase();
  const pairs: [string, string][] = [
    ["follower","followers"],["like","likes"],["comment","comments"],["view","views"],
    ["share","shares"],["save","saves"],["subscriber","subscribers"],["member","members"],
    ["reaction","reactions"],["repost","reposts"],["traffic","traffic"],["impression","impressions"],
    ["review","reviews"],["rating","ratings"],["mention","mentions"],["vote","votes"],
  ];
  return pairs.find(([needle]) => value.includes(needle))?.[1] ?? "other";
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "provider-category", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;

  const rows = await db.select({
    providerId: providers.id,
    provider: providers.name,
    serviceId: services.id,
    serviceName: services.name,
    platform: platforms.name,
    serviceType: services.slug,
    min: services.minQuantity,
    max: services.maxQuantity,
    price: providerServices.pricePerThousand,
    refill: providerServices.refillSupported,
  })
    .from(providerServices)
    .innerJoin(providers, eq(providerServices.providerId, providers.id))
    .innerJoin(services, eq(providerServices.serviceId, services.id))
    .innerJoin(platforms, eq(services.platformId, platforms.id))
    .where(and(eq(providerServices.active, true), eq(providers.enabled, true), eq(services.enabled, true), eq(platforms.enabled, true)));

  const categories = new Map<string, { id: string; label: string; platform: string; type: string }>();
  const providersByCategory = new Map<string, Map<string, { providerId: string; provider: string; services: typeof rows[number][] }>>();

  for (const row of rows) {
    const type = inferType(row.serviceName);
    const categoryId = row.platform.toLowerCase() + "|" + type;
    if (!categories.has(categoryId)) {
      categories.set(categoryId, { id: categoryId, label: row.platform + " " + type.replace(/_/g, " "), platform: row.platform, type });
    }
    const providerMap = providersByCategory.get(categoryId) ?? new Map();
    const current = providerMap.get(row.providerId) ?? { providerId: row.providerId, provider: row.provider, services: [] };
    current.services.push(row);
    providerMap.set(row.providerId, current);
    providersByCategory.set(categoryId, providerMap);
  }

  const result = [...categories.values()].sort((a,b) => a.label.localeCompare(b.label)).map(category => ({
    ...category,
    providers: [...(providersByCategory.get(category.id)?.values() ?? [])].map(item => ({
      providerId: item.providerId,
      provider: item.provider,
      serviceCount: item.services.length,
      services: item.services.map(service => ({
        id: service.serviceId,
        name: service.serviceName,
        min: service.min,
        max: service.max,
        pricePerThousand: service.price == null ? null : Number(service.price),
        refillSupported: service.refill,
      })),
    })).sort((a,b) => a.provider.localeCompare(b.provider)),
  }));

  return NextResponse.json({ ok: true, categories: result }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

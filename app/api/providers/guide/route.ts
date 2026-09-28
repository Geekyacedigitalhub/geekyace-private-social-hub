import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platforms, providerHealth, providerServices, providers, services } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";

function inferCategory(name: string) {
  const value = name.toLowerCase();
  const pairs: [string, string][] = [
    ["follower", "Followers"], ["like", "Likes"], ["comment", "Comments"],
    ["view", "Views"], ["share", "Shares"], ["save", "Saves"],
    ["subscriber", "Subscribers"], ["member", "Members"], ["reaction", "Reactions"],
    ["repost", "Reposts"], ["traffic", "Traffic"], ["impression", "Impressions"],
    ["review", "Reviews"], ["rating", "Ratings"], ["mention", "Mentions"], ["vote", "Votes"],
  ];
  return pairs.find(([needle]) => value.includes(needle))?.[1] ?? "Other";
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "provider-guide", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const platformFilter = params.get("platform")?.trim().toLowerCase() ?? "";
  const categoryFilter = params.get("category")?.trim().toLowerCase() ?? "";

  const rows = await db.select({
    providerId: providers.id,
    provider: providers.name,
    providerEnabled: providers.enabled,
    mappingId: providerServices.id,
    price: providerServices.pricePerThousand,
    min: providerServices.minQuantity,
    max: providerServices.maxQuantity,
    refill: providerServices.refillSupported,
    serviceName: services.name,
    platform: platforms.name,
  })
    .from(providerServices)
    .innerJoin(providers, eq(providerServices.providerId, providers.id))
    .innerJoin(services, eq(providerServices.serviceId, services.id))
    .innerJoin(platforms, eq(services.platformId, platforms.id))
    .where(and(eq(providerServices.active, true), eq(providers.enabled, true), eq(services.enabled, true), eq(platforms.enabled, true)));

  const healthRows = await db.select({
    providerId: providerHealth.providerId,
    status: providerHealth.status,
    responseTimeMs: providerHealth.responseTimeMs,
    checkedAt: providerHealth.checkedAt,
  }).from(providerHealth);

  const latestHealth = new Map<string, typeof healthRows[number]>();
  for (const row of healthRows) {
    const existing = latestHealth.get(row.providerId);
    if (!existing || new Date(row.checkedAt).getTime() > new Date(existing.checkedAt).getTime()) {
      latestHealth.set(row.providerId, row);
    }
  }

  const categories = new Set<string>();
  const platformsSet = new Set<string>();
  const grouped = new Map<string, {
    providerId: string; provider: string; platform: string; category: string;
    mappings: number; refillMappings: number; minPrice: number | null; maxPrice: number | null;
    examples: string[];
  }>();

  for (const row of rows) {
    const category = inferCategory(row.serviceName);
    platformsSet.add(row.platform);
    categories.add(category);
    if (platformFilter && row.platform.toLowerCase() !== platformFilter) continue;
    if (categoryFilter && category.toLowerCase() !== categoryFilter) continue;

    const key = [row.providerId, row.platform, category].join("|");
    const existing = grouped.get(key);
    const price = row.price == null ? null : Number(row.price);
    if (!existing) {
      grouped.set(key, {
        providerId: row.providerId, provider: row.provider, platform: row.platform, category,
        mappings: 1, refillMappings: row.refill ? 1 : 0,
        minPrice: price, maxPrice: price, examples: [row.serviceName],
      });
    } else {
      existing.mappings += 1;
      if (row.refill) existing.refillMappings += 1;
      if (price != null) {
        existing.minPrice = existing.minPrice == null ? price : Math.min(existing.minPrice, price);
        existing.maxPrice = existing.maxPrice == null ? price : Math.max(existing.maxPrice, price);
      }
      if (existing.examples.length < 3 && !existing.examples.includes(row.serviceName)) existing.examples.push(row.serviceName);
    }
  }

  const coverage = [...grouped.values()].map((item) => {
    const health = latestHealth.get(item.providerId);
    return {
      ...item,
      health: health?.status ?? "unknown",
      latencyMs: health?.responseTimeMs ?? null,
      lastCheckedAt: health?.checkedAt ?? null,
      refillPercent: item.mappings ? Math.round((item.refillMappings / item.mappings) * 100) : 0,
    };
  }).sort((a, b) => a.platform.localeCompare(b.platform) || a.category.localeCompare(b.category) || a.provider.localeCompare(b.provider));

  return NextResponse.json({
    ok: true,
    filters: { platform: platformFilter || null, category: categoryFilter || null },
    platforms: [...platformsSet].sort(),
    categories: [...categories].sort(),
    coverage,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

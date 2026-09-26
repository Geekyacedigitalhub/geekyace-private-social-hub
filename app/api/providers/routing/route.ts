import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platforms, providerHealth, providerServices, providers, services } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";


function routingFingerprint(platform: string, serviceType: string, name: string) {
  const normalizedPlatform = platform.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedType = serviceType.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  const raw = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const descriptorTerms = [
    "real", "mix", "bot", "hq", "premium", "female", "male", "organic",
    "aged", "old", "new", "highretention", "lowdrop", "fast", "slow",
    "global", "worldwide", "usa", "uk", "canada", "australia", "germany",
    "france", "italy", "spain", "brazil", "india", "nigeria", "bangladesh",
    "pakistan", "indonesia", "turkey", "japan", "korea", "mexico",
  ];

  const descriptors = descriptorTerms.filter((term) => raw.replace(/[^a-z0-9]+/g, " ").includes(term));
  const core = raw
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => ![
      "instagram","facebook","tiktok","youtube","twitter","x","linkedin","threads",
      "telegram","discord","reddit","twitch","pinterest","spotify","snapchat",
      "followers","follower","likes","like","views","view","comments","comment",
      "shares","share","saves","save","subscribers","subscriber","members","member",
      "reactions","reaction","reposts","repost","traffic","impressions","impression",
      "service","profile","page","post","video","photo","story",
    ].includes(token))
    .filter((token) => !/^\d+$/.test(token))
    .slice(0, 8);

  return [normalizedPlatform, normalizedType, [...new Set([...core, ...descriptors])].sort().join(",")].join("|");
}

function routingScore(selected: { platform: string; serviceType: string; name: string }, candidate: { platform: string; serviceType: string; name: string }) {
  if (selected.platform.toLowerCase() !== candidate.platform.toLowerCase()) return 0;
  if (selected.serviceType !== candidate.serviceType) return 0;
  const a = new Set(routingFingerprint(selected.platform, selected.serviceType, selected.name).split("|")[2].split(",").filter(Boolean));
  const b = new Set(routingFingerprint(candidate.platform, candidate.serviceType, candidate.name).split("|")[2].split(",").filter(Boolean));
  if (!a.size && !b.size) return 100;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union ? Math.round((intersection / union) * 100) : 100;
}

function inferServiceType(name: string) {
  const value = name.toLowerCase();
  const pairs: [string,string][] = [["follower","followers"],["like","likes"],["comment","comments"],["view","views"],["share","shares"],["save","saves"],["subscriber","subscribers"],["member","members"],["reaction","reactions"],["repost","reposts"],["traffic","traffic"],["impression","impressions"],["review","reviews"],["rating","ratings"],["mention","mentions"],["vote","votes"]];
  return pairs.find(([needle]) => value.includes(needle))?.[1] ?? "other";
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "provider-routing-preview", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;

  const serviceId = new URL(request.url).searchParams.get("serviceId")?.trim() ?? "";
  if (!serviceId) return NextResponse.json({ error: "serviceId is required." }, { status: 400 });

  const service = (await db.select().from(services).where(eq(services.id, serviceId))).at(0);
  if (!service || !service.enabled) return NextResponse.json({ error: "Service is unavailable." }, { status: 404 });

  const selectedMapping = (await db.select({ mapping: providerServices, provider: providers })
    .from(providerServices)
    .innerJoin(providers, eq(providerServices.providerId, providers.id))
    .where(and(eq(providerServices.serviceId, service.id), eq(providerServices.active, true), eq(providers.enabled, true)))).at(0);

  const allRows = await db.select({
    mapping: providerServices,
    provider: providers,
    service: services,
    platform: platforms,
  })
    .from(providerServices)
    .innerJoin(providers, eq(providerServices.providerId, providers.id))
    .innerJoin(services, eq(providerServices.serviceId, services.id))
    .innerJoin(platforms, eq(services.platformId, platforms.id))
    .where(and(eq(providerServices.active, true), eq(providers.enabled, true), eq(services.enabled, true)));

  const selectedType = String(selectedMapping?.mapping.metadata && typeof selectedMapping.mapping.metadata === "object"
    ? (selectedMapping.mapping.metadata as { serviceType?: unknown }).serviceType ?? ""
    : "").trim() || inferServiceType(service.name);
  const selectedContext = { platform: (await db.select({ name: platforms.name }).from(platforms).where(eq(platforms.id, service.platformId))).at(0)?.name ?? "Other", serviceType: selectedType, name: service.name };

  const healthRows = await db.select({
    providerId: providerHealth.providerId,
    status: providerHealth.status,
    responseTimeMs: providerHealth.responseTimeMs,
    checkedAt: providerHealth.checkedAt,
  }).from(providerHealth).orderBy(desc(providerHealth.checkedAt)).limit(500);

  const latestHealth = new Map<string, typeof healthRows[number]>();
  for (const row of healthRows) if (!latestHealth.has(row.providerId)) latestHealth.set(row.providerId, row);

  const healthRank: Record<string, number> = { healthy: 0, degraded: 1, unknown: 2, down: 3 };
  const scored = allRows
    .map(({ mapping, provider, service: candidateService, platform }) => {
      const candidateType = String(mapping.metadata && typeof mapping.metadata === "object"
        ? (mapping.metadata as { serviceType?: unknown }).serviceType ?? ""
        : "").trim() || inferServiceType(candidateService.name);
      return {
        mapping,
        provider,
        candidateService,
        platform,
        score: routingScore(selectedContext, { platform: platform.name, serviceType: candidateType, name: candidateService.name }),
        candidateType,
      };
    })
    .filter((row) => row.score >= 70);

  const bestByProvider = new Map<string, typeof scored[number]>();
  for (const row of scored) {
    const existing = bestByProvider.get(row.provider.id);
    if (!existing || row.score > existing.score || (row.score === existing.score && Number(row.mapping.pricePerThousand ?? Infinity) < Number(existing.mapping.pricePerThousand ?? Infinity))) {
      bestByProvider.set(row.provider.id, row);
    }
  }

  const candidates = [...bestByProvider.values()].map(({ mapping, provider, score }) => {
    const health = latestHealth.get(provider.id);
    return {
      providerId: provider.id,
      provider: provider.name,
      pricePerThousand: mapping.pricePerThousand == null ? null : Number(mapping.pricePerThousand),
      min: mapping.minQuantity ?? service.minQuantity,
      max: mapping.maxQuantity ?? service.maxQuantity,
      refillSupported: mapping.refillSupported,
      health: health?.status ?? "unknown",
      latencyMs: health?.responseTimeMs ?? null,
      matchScore: score,
    };
  }).sort((a, b) => {
    const hr = (healthRank[a.health] ?? 2) - (healthRank[b.health] ?? 2);
    if (hr !== 0) return hr;
    const ap = a.pricePerThousand ?? Number.POSITIVE_INFINITY;
    const bp = b.pricePerThousand ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    return (a.latencyMs ?? Number.POSITIVE_INFINITY) - (b.latencyMs ?? Number.POSITIVE_INFINITY);
  });

  return NextResponse.json({
    ok: true,
    service: { id: service.id, name: service.name, min: service.minQuantity, max: service.maxQuantity },
    mode: "smart_auto",
    selectedProviderId: candidates[0]?.providerId ?? null,
    candidates,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { providerHealth, providerServices, providers, services } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";

export async function GET(request: Request) {
  const limited = rateLimit(request, "provider-routing-preview", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;

  const serviceId = new URL(request.url).searchParams.get("serviceId")?.trim() ?? "";
  if (!serviceId) return NextResponse.json({ error: "serviceId is required." }, { status: 400 });

  const service = (await db.select().from(services).where(eq(services.id, serviceId))).at(0);
  if (!service || !service.enabled) return NextResponse.json({ error: "Service is unavailable." }, { status: 404 });

  const rows = await db.select({ mapping: providerServices, provider: providers })
    .from(providerServices)
    .innerJoin(providers, eq(providerServices.providerId, providers.id))
    .where(and(eq(providerServices.serviceId, service.id), eq(providerServices.active, true), eq(providers.enabled, true)));

  const healthRows = await db.select({
    providerId: providerHealth.providerId,
    status: providerHealth.status,
    responseTimeMs: providerHealth.responseTimeMs,
    checkedAt: providerHealth.checkedAt,
  }).from(providerHealth).orderBy(desc(providerHealth.checkedAt)).limit(500);

  const latestHealth = new Map<string, typeof healthRows[number]>();
  for (const row of healthRows) if (!latestHealth.has(row.providerId)) latestHealth.set(row.providerId, row);

  const healthRank: Record<string, number> = { healthy: 0, degraded: 1, unknown: 2, down: 3 };
  const candidates = rows.map(({ mapping, provider }) => {
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
import { NextResponse } from "next/server";
import { desc, eq, lt } from "drizzle-orm";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { providerBalanceSnapshots, providerHealth, providerServices, providers } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { requireOwner } from "@/lib/auth/require-owner";
import { requireSameOrigin } from "@/lib/security/csrf";

export async function GET(request: Request) {
  const limited = rateLimit(request, "provider-health-read", 20);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 200;
  const rows = limit <= 20
    ? await db
        .select({
          id: providerHealth.id,
          providerId: providerHealth.providerId,
          status: providerHealth.status,
          responseTimeMs: providerHealth.responseTimeMs,
          checkedAt: providerHealth.checkedAt,
        })
        .from(providerHealth)
        .orderBy(desc(providerHealth.checkedAt))
        .limit(limit)
    : await db
        .select()
        .from(providerHealth)
        .orderBy(desc(providerHealth.checkedAt))
        .limit(limit);
    const providerRows = await db.select().from(providers);
    const mappingRows = await db.select({ providerId: providerServices.providerId, active: providerServices.active }).from(providerServices);
    const counts = new Map<string, { mappings:number; activeMappings:number }>();
    for (const row of mappingRows) {
      const current = counts.get(row.providerId) ?? { mappings:0, activeMappings:0 };
      current.mappings++;
      if (row.active) current.activeMappings++;
      counts.set(row.providerId, current);
    }
    const latestByProvider = new Map<string, typeof rows[number]>();
    for (const row of rows) {
      if (!latestByProvider.has(row.providerId)) latestByProvider.set(row.providerId, row);
    }
    const providerSummary = providerRows.map((provider) => {
      const latest = latestByProvider.get(provider.id);
      const count = counts.get(provider.id) ?? { mappings:0, activeMappings:0 };
      return { name: provider.name, enabled: provider.enabled, mappings: count.mappings, activeMappings: count.activeMappings, health: latest?.status ?? "unknown", latencyMs: latest?.responseTimeMs ?? null };
    });
    return NextResponse.json(
      { health: rows, providers: providerSummary },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Provider health query failed:", error);
    return NextResponse.json({ error: "Unable to load provider health." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "provider-health", 10);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  const requestedProvider = new URL(request.url).searchParams.get("provider")?.trim();
  const providerName = requestedProvider || "TaskletPay";
  let providerRow: typeof providers.$inferSelect | undefined;

  try {
    providerRow = (await db.select().from(providers).where(eq(providers.name, providerName))).at(0);
    if (!providerRow) {
      return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    }

    const provider = createProviderAdapter({ name: providerRow.name, baseUrl: providerRow.baseUrl });
    const started = Date.now();
    const [balance, services] = await Promise.all([provider.getBalance(), provider.getServices()]);
    const latencyMs = Date.now() - started;

    // Health and balance are telemetry, not an audit trail. Retain a bounded
    // history so repeated checks cannot grow these tables indefinitely.
    const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(providerHealth).where(lt(providerHealth.checkedAt, retentionCutoff));
    await db.delete(providerBalanceSnapshots).where(lt(providerBalanceSnapshots.checkedAt, retentionCutoff));

    // Slow but successful providers are degraded rather than healthy. This
    // keeps Smart Auto from preferring a provider that is technically alive
    // but consistently too slow.
    const healthStatus = latencyMs >= 8000 ? "degraded" : "healthy";
    await db.insert(providerHealth).values({
      providerId: providerRow.id,
      status: healthStatus,
      responseTimeMs: latencyMs,
      checkedAt: new Date(),
    });
    await db.insert(providerBalanceSnapshots).values({
      providerId: providerRow.id,
      balance: String(balance.balance),
      currency: balance.currency,
    });

    return NextResponse.json(
      {
        ok: true,
        status: healthStatus,
        latencyMs,
        balance: balance.balance,
        currency: balance.currency,
        serviceCount: services.length,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Provider health check failed:", error);
    try {
      await db.insert(providerHealth).values({
        providerId: providerRow.id,
        status: "down",
        responseTimeMs: null,
        checkedAt: new Date(),
      });
    } catch (telemetryError) {
      console.error("Provider health failure telemetry failed:", telemetryError);
    }
    return NextResponse.json(
      { ok: false, status: "down", error: "Provider health check failed." },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

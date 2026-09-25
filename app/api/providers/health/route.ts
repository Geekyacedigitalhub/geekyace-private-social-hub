import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { providerBalanceSnapshots, providerHealth, providers } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { requireOwner } from "@/lib/auth/require-owner";
import { requireSameOrigin } from "@/lib/security/csrf";

export async function GET(request: Request) {
  const limited = rateLimit(request, "provider-health-read", 20);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const rows = await db
      .select()
      .from(providerHealth)
      .orderBy(desc(providerHealth.checkedAt))
      .limit(200);
    return NextResponse.json(
      { health: rows },
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
  const providerName = process.env.PROVIDER_NAME ?? "Configured provider";
  const baseUrl = process.env.PROVIDER_API_BASE_URL?.trim() ?? "";
  const apiKey = process.env.PROVIDER_API_KEY ?? "";

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "Provider credentials are not configured." }, { status: 503 });
  }

  try {
    const provider = createProviderAdapter({ name: providerName, baseUrl, apiKey });
    const started = Date.now();
    const [balance, services] = await Promise.all([provider.getBalance(), provider.getServices()]);
    const latencyMs = Date.now() - started;

    const providerRow = (await db.select().from(providers)).find((item) => item.name === providerName);
    if (providerRow) {
      await db.insert(providerHealth).values({
        providerId: providerRow.id,
        status: "healthy",
        responseTimeMs: latencyMs,
        checkedAt: new Date(),
      });
      await db.insert(providerBalanceSnapshots).values({
        providerId: providerRow.id,
        balance: String(balance.balance),
        currency: balance.currency,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        status: "healthy",
        latencyMs,
        balance: balance.balance,
        currency: balance.currency,
        serviceCount: services.length,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Provider health check failed:", error);
    return NextResponse.json(
      { ok: false, status: "down", error: "Provider health check failed." },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

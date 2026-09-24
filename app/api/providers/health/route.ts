import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { providerBalanceSnapshots, providerHealth, providers } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

export async function GET() {
  const rows = await db.select().from(providerHealth);
  return NextResponse.json({ health: rows });
}

export async function POST() {
  const providerName = process.env.PROVIDER_NAME ?? "Configured provider";
  const baseUrl = process.env.PROVIDER_API_BASE_URL ?? "";
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
        latencyMs,
        lastCheckedAt: new Date(),
      });
      await db.insert(providerBalanceSnapshots).values({
        providerId: providerRow.id,
        balance: String(balance.balance),
        currency: balance.currency,
      });
    }

    return NextResponse.json({ ok: true, status: "healthy", latencyMs, balance: balance.balance, currency: balance.currency, serviceCount: services.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider health check failed.";
    return NextResponse.json({ ok: false, status: "down", error: message }, { status: 502 });
  }
}

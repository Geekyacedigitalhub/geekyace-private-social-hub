import { NextResponse } from "next/server";
import { createProviderAdapter } from "@/lib/providers";

export async function POST() {
  const baseUrl = process.env.PROVIDER_API_BASE_URL;
  const apiKey = process.env.PROVIDER_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { ok: false, error: "Provider API is not configured on the server." },
      { status: 503 },
    );
  }

  try {
    const provider = createProviderAdapter({
      name: "Configured provider",
      baseUrl,
      apiKey,
    });

    const [balance, services] = await Promise.all([
      provider.getBalance(),
      provider.getServices(),
    ]);

    return NextResponse.json({
      ok: true,
      balance: balance.balance,
      currency: balance.currency,
      serviceCount: services.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider connection failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

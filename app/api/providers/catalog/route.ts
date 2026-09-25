import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platforms, providerServices, providers, services } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";

export async function POST() {
  const baseUrl = process.env.PROVIDER_API_BASE_URL ?? "https://app.smmpanel.ng/api/v2";
  const apiKey = process.env.PROVIDER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "PROVIDER_API_KEY is not configured on the server." }, { status: 503 });

  try {
    const providerName = process.env.PROVIDER_NAME ?? "SMM Panel Nigeria";
    const provider = createProviderAdapter({ name: providerName, baseUrl, apiKey });
    const remoteServices = await provider.getServices();
    let providerRow = (await db.select().from(providers).where(eq(providers.name, providerName))).at(0);
    if (!providerRow) {
      const inserted = await db.insert(providers).values({ name: providerName, baseUrl, enabled: true }).returning();
      providerRow = inserted[0];
      if (!providerRow) throw new Error("Provider record could not be created.");
    } else if (!providerRow.enabled || providerRow.baseUrl !== baseUrl) {
      const updated = await db.update(providers).set({ baseUrl, enabled: true }).where(eq(providers.id, providerRow.id)).returning();
      providerRow = updated[0];
      if (!providerRow) throw new Error("Provider record could not be updated.");
    }

    let imported = 0;
    for (const remote of remoteServices) {
      if (!remote.id || !remote.name || !Number.isFinite(remote.min) || !Number.isFinite(remote.max) || remote.min <= 0 || remote.max < remote.min) continue;
      const platformName = inferPlatformName(remote.category, remote.name);
      const platformSlug = platformName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
      let platformRow = (await db.select().from(platforms).where(eq(platforms.slug, platformSlug))).at(0);
      if (!platformRow) {
        const inserted = await db.insert(platforms).values({ name: platformName, slug: platformSlug, enabled: true }).returning();
        platformRow = inserted[0];
        if (!platformRow) throw new Error("Platform record could not be created.");
      }
      const serviceSlug = (remote.name + "-" + remote.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let serviceRow = (await db.select().from(services).where(eq(services.slug, serviceSlug))).at(0);
      if (!serviceRow) {
        const inserted = await db.insert(services).values({ platformId: platformRow.id, name: remote.name, slug: serviceSlug, description: remote.type ? String(remote.type) : null, minQuantity: remote.min, maxQuantity: remote.max, enabled: true }).returning();
        serviceRow = inserted[0];
        if (!serviceRow) throw new Error("Service record could not be created.");
      } else {
        const updated = await db.update(services).set({ platformId: platformRow.id, name: remote.name, minQuantity: remote.min, maxQuantity: remote.max, enabled: true, description: remote.type ? String(remote.type) : serviceRow.description }).where(eq(services.id, serviceRow.id)).returning();
        serviceRow = updated[0];
        if (!serviceRow) throw new Error("Service record could not be updated.");
      }
      const existingMapping = (await db.select().from(providerServices).where(eq(providerServices.externalServiceId, remote.id))).find(mapping => mapping.providerId === providerRow.id);
      const values = { providerId: providerRow.id, serviceId: serviceRow.id, externalServiceId: remote.id, pricePerThousand: remote.rate?.toString(), minQuantity: remote.min, maxQuantity: remote.max, refillSupported: Boolean(remote.refill), active: true, metadata: remote.raw ? { providerService: remote.raw } : null };
      if (existingMapping) await db.update(providerServices).set(values).where(eq(providerServices.id, existingMapping.id));
      else await db.insert(providerServices).values(values);
      imported++;
    }
    return NextResponse.json({ ok: true, provider: providerName, imported, available: remoteServices.length });
  } catch (error) {
    console.error("Provider catalog sync failed:", error);
    return NextResponse.json({ ok: false, error: "Catalog synchronization failed." }, { status: 502 });
  }
}

function inferPlatformName(category?: string, serviceName?: string) {
  const value = `${category ?? ""} ${serviceName ?? ""}`.toLowerCase();
  const platforms = [
    ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["facebook", "Facebook"],
    ["twitter", "X"], [" x ", "X"], ["linkedin", "LinkedIn"], ["threads", "Threads"], ["telegram", "Telegram"],
    ["discord", "Discord"], ["reddit", "Reddit"], ["twitch", "Twitch"], ["pinterest", "Pinterest"],
    ["spotify", "Spotify"], ["snapchat", "Snapchat"],
  ] as const;
  for (const [needle, label] of platforms) if (value.includes(needle)) return label;
  return category?.trim() || "Other";
}

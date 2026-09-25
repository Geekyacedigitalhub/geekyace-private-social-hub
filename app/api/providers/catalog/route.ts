import { NextResponse } from "next/server";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { platforms, providerServices, providers, services } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";
import { requireSameOrigin } from "@/lib/security/csrf";

export async function POST(request: Request) {
  const limited = rateLimit(request, "provider-catalog", 5);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  const baseUrl = process.env.PROVIDER_API_BASE_URL?.trim() ?? "";
  const apiKey = process.env.PROVIDER_API_KEY;
  if (!baseUrl || !apiKey) return NextResponse.json({ error: "Provider API is not configured on the server." }, { status: 503 });

  try {
    const providerName = process.env.PROVIDER_NAME ?? "SMM Panel Nigeria";
    const provider = createProviderAdapter({ name: providerName, baseUrl, apiKey });
    const remoteServices = await provider.getServices();

    // An empty catalog is treated as a failed synchronization rather than a valid
    // catalog. This prevents a transient/provider-side empty response from wiping
    // the locally usable catalog.
    if (remoteServices.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Provider returned an empty catalog; existing catalog was not changed." },
        { status: 502 },
      );
    }

    const seenExternalIds = new Set<string>();
    let imported = 0;

    await db.transaction(async (tx) => {
      let providerRow = (await tx.select().from(providers).where(eq(providers.name, providerName))).at(0);
      if (!providerRow) {
        const inserted = await tx.insert(providers).values({ name: providerName, baseUrl, enabled: true }).returning();
        providerRow = inserted[0];
        if (!providerRow) throw new Error("Provider record could not be created.");
      } else if (providerRow.baseUrl !== baseUrl) {
        const updated = await tx.update(providers).set({ baseUrl }).where(eq(providers.id, providerRow.id)).returning();
        providerRow = updated[0];
        if (!providerRow) throw new Error("Provider record could not be updated.");
      }

      // Prefetch the provider's existing mappings plus all referenced
      // platforms/services once. This removes several database reads per catalog
      // row while keeping the existing transactional write semantics intact.
      const existingMappings = await tx
        .select()
        .from(providerServices)
        .where(eq(providerServices.providerId, providerRow.id));
      const mappingByExternalId = new Map(existingMappings.map((mapping) => [mapping.externalServiceId, mapping]));
      const existingServiceIds = existingMappings.map((mapping) => mapping.serviceId);
      const referencedServices = existingServiceIds.length > 0
        ? await tx.select().from(services).where(inArray(services.id, existingServiceIds))
        : [];
      const serviceById = new Map(referencedServices.map((service) => [service.id, service]));
      const slugs = remoteServices
        .map((remote) => (remote.name + "-" + remote.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 240))
        .filter(Boolean);
      const slugServices = slugs.length > 0
        ? await tx.select().from(services).where(inArray(services.slug, slugs))
        : [];
      const serviceBySlug = new Map(slugServices.map((service) => [service.slug, service]));
      const platformRows = await tx.select().from(platforms);
      const platformBySlug = new Map(platformRows.map((platform) => [platform.slug, platform]));

      for (const remote of remoteServices) {
        if (
          !remote.id ||
          !remote.name ||
          !Number.isFinite(remote.min) ||
          !Number.isFinite(remote.max) ||
          remote.min <= 0 ||
          remote.max < remote.min
        ) {
          // A malformed row means the provider response is not trustworthy.
          // Do not silently skip it: skipped rows would otherwise be treated
          // as removed and their existing mappings could be deactivated.
          throw new Error("Provider returned a malformed catalog service.");
        }
        if (seenExternalIds.has(remote.id)) {
          // Duplicate external IDs make the provider catalog ambiguous. Treat
          // the whole sync as invalid rather than silently importing a partial
          // interpretation of the provider response.
          throw new Error("Provider returned duplicate catalog service IDs.");
        }
        seenExternalIds.add(remote.id);

        const platformName = inferPlatformName(remote.category, remote.name);
        const platformSlug = platformName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
        let platformRow = platformBySlug.get(platformSlug);
        if (!platformRow) {
          const inserted = await tx.insert(platforms).values({ name: platformName, slug: platformSlug, enabled: true }).returning();
          platformRow = inserted[0];
          if (!platformRow) throw new Error("Platform record could not be created.");
          platformBySlug.set(platformSlug, platformRow);
        }

        const serviceSlug = (remote.name + "-" + remote.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 240);
        const existingMapping = mappingByExternalId.get(remote.id);
        let serviceRow = existingMapping
          ? serviceById.get(existingMapping.serviceId)
          : serviceBySlug.get(serviceSlug);

        if (!serviceRow) {
          const inserted = await tx.insert(services).values({
            platformId: platformRow.id,
            name: remote.name,
            slug: serviceSlug,
            description: remote.type ? String(remote.type) : null,
            minQuantity: remote.min,
            maxQuantity: remote.max,
            enabled: true,
          }).returning();
          serviceRow = inserted[0];
          if (!serviceRow) throw new Error("Service record could not be created.");
          serviceBySlug.set(serviceSlug, serviceRow);
        } else {
          const updated = await tx.update(services).set({
            platformId: platformRow.id,
            name: remote.name,
            minQuantity: remote.min,
            maxQuantity: remote.max,
            enabled: true,
            description: remote.type ? String(remote.type) : serviceRow.description,
          }).where(eq(services.id, serviceRow.id)).returning();
          serviceRow = updated[0];
          if (!serviceRow) throw new Error("Service record could not be updated.");
        }

        const serviceType = inferServiceType(remote.category, remote.name, remote.type);

        const values = {
          providerId: providerRow.id,
          serviceId: serviceRow.id,
          externalServiceId: remote.id,
          pricePerThousand: remote.rate?.toString(),
          minQuantity: remote.min,
          maxQuantity: remote.max,
          refillSupported: Boolean(remote.refill),
          active: true,
          metadata: {
            providerCategory: remote.category ?? null,
            providerType: remote.type ?? null,
            platform: platformName,
            serviceType,
            refillSupported: Boolean(remote.refill),
            cancelSupported: Boolean(remote.cancel),
          },
        };

        if (existingMapping) {
          await tx.update(providerServices).set(values).where(eq(providerServices.id, existingMapping.id));
        } else {
          const insertedMapping = (await tx.insert(providerServices).values(values).returning()).at(0);
          if (insertedMapping) mappingByExternalId.set(remote.id, insertedMapping);
        }
        imported++;
      }

      // A successful, non-empty catalog is authoritative for this provider.
      // Deactivate all mappings missing from the response in one statement
      // instead of issuing one UPDATE per removed service.
      await tx
        .update(providerServices)
        .set({ active: false })
        .where(
          and(
            eq(providerServices.providerId, providerRow.id),
            notInArray(providerServices.externalServiceId, Array.from(seenExternalIds)),
          ),
        );
    });

    return NextResponse.json({
      ok: true,
      provider: providerName,
      imported,
      available: remoteServices.length,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Provider catalog sync failed:", error);
    return NextResponse.json({ ok: false, error: "Catalog synchronization failed; existing catalog was preserved." }, { status: 502 });
  }
}

function inferServiceType(category?: string, serviceName?: string, providerType?: string) {
  const value = `${category ?? ""} ${serviceName ?? ""} ${providerType ?? ""}`.toLowerCase();
  const matchers = [
    ["watch time", "watch_time"],
    ["watchtime", "watch_time"],
    ["live viewer", "live_viewers"],
    ["live viewers", "live_viewers"],
    ["story view", "story_views"],
    ["story views", "story_views"],
    ["profile visit", "profile_visits"],
    ["profile visits", "profile_visits"],
    ["subscriber", "subscribers"],
    ["member", "members"],
    ["follower", "followers"],
    ["like", "likes"],
    ["comment", "comments"],
    ["share", "shares"],
    ["save", "saves"],
    ["reaction", "reactions"],
    ["repost", "reposts"],
    ["view", "views"],
    ["engagement", "engagement"],
  ] as const;

  for (const [needle, type] of matchers) {
    if (value.includes(needle)) return type;
  }

  return "other";
}

function inferPlatformName(category?: string, serviceName?: string) {
  const value = `${category ?? ""} ${serviceName ?? ""}`.toLowerCase();

  const platformMatchers = [
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["youtube", "YouTube"],
    ["facebook", "Facebook"],
    ["twitter", "X"],
    ["linkedin", "LinkedIn"],
    ["threads", "Threads"],
    ["telegram", "Telegram"],
    ["discord", "Discord"],
    ["reddit", "Reddit"],
    ["twitch", "Twitch"],
    ["pinterest", "Pinterest"],
    ["spotify", "Spotify"],
    ["snapchat", "Snapchat"],
    ["whatsapp", "WhatsApp"],
    ["soundcloud", "SoundCloud"],
    ["apple music", "Apple Music"],
    ["applemusic", "Apple Music"],
    ["kick", "Kick"],
    ["quora", "Quora"],
    ["tumblr", "Tumblr"],
    ["vk", "VK"],
    ["vimeo", "Vimeo"],
    ["dailymotion", "Dailymotion"],
    ["google business", "Google Business"],
    ["google maps", "Google Business"],
    ["business profile", "Google Business"],
    ["yelp", "Yelp"],
    ["patreon", "Patreon"],
    ["onlyfans", "OnlyFans"],
    ["rumble", "Rumble"],
    ["likee", "Likee"],
    ["kwai", "Kwai"],
    ["line", "LINE"],
    ["weibo", "Weibo"],
    ["douyin", "Douyin"],
    ["bilibili", "Bilibili"],
    ["mixcloud", "Mixcloud"],
    ["steam", "Steam"],
    ["roblox", "Roblox"],
    ["minecraft", "Minecraft"],
  ] as const;

  for (const [needle, label] of platformMatchers) {
    if (value.includes(needle)) return label;
  }

  if (/(^|\\s)x(\\s|$)/.test(value)) return "X";
  return category?.trim() || "Other";
}

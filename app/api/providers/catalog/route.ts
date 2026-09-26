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
    const platformCounts = new Map<string, number>();
    const serviceTypeCounts = new Map<string, number>();

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
        const orderRequirements = inferOrderRequirements(remote.category, remote.name, remote.type);
        platformCounts.set(platformName, (platformCounts.get(platformName) ?? 0) + 1);
        serviceTypeCounts.set(serviceType, (serviceTypeCounts.get(serviceType) ?? 0) + 1);

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
            orderRequirements,
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
      platforms: Object.fromEntries([...platformCounts.entries()].sort((a, b) => b[1] - a[1])),
      serviceTypes: Object.fromEntries([...serviceTypeCounts.entries()].sort((a, b) => b[1] - a[1])),
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
    ["app download and signup", "app_download_signup"],
    ["download and signup", "app_download_signup"],
    ["signup + like", "signup_like"],
    ["sign up + like", "signup_like"],
    ["page likes", "page_likes"],
    ["page like", "page_likes"],
    ["group members", "group_members"],
    ["group member", "group_members"],
    ["post shares", "post_shares"],
    ["post share", "post_shares"],
    ["share to story", "story_shares"],
    ["story shares", "story_shares"],
    ["story share", "story_shares"],
    ["custom meme comments", "custom_meme_comments"],
    ["custom meme comment", "custom_meme_comments"],
    ["meme comments", "meme_comments"],
    ["meme comment", "meme_comments"],
    ["poll vote", "poll_votes"],
    ["poll", "votes"],
    ["channel follow", "channel_follows"],
    ["channel followers", "channel_follows"],
    ["repin", "repins"],
    ["watch time", "watch_time"],
    ["watchtime", "watch_time"],
    ["live viewer", "live_viewers"],
    ["live viewers", "live_viewers"],
    ["story view", "story_views"],
    ["story views", "story_views"],
    ["profile visit", "profile_visits"],
    ["profile visits", "profile_visits"],
    ["channel member", "members"],
    ["group member", "members"],
    ["app download", "app_downloads"],
    ["download", "downloads"],
    ["signup", "signups"],
    ["sign up", "signups"],
    ["direct dm", "direct_messages"],
    ["direct message", "direct_messages"],
    ["bot chat", "bot_chat"],
    ["connection", "connections"],
    ["sound use", "sound_use"],
    ["subscriber", "subscribers"],
    ["member", "members"],
    ["follower", "followers"],
    ["follow", "followers"],
    ["mention", "mentions"],
    ["like", "likes"],
    ["comment", "comments"],
    ["share", "shares"],
    ["save", "saves"],
    ["reaction", "reactions"],
    ["repost", "reposts"],
    ["retweet", "reposts"],
    ["pin", "saves"],
    ["view", "views"],
    ["engagement", "engagement"],
    ["vote", "votes"],
    ["review", "reviews"],
    ["rating", "ratings"],
    ["traffic", "traffic"],
    ["impression", "impressions"],
  ] as const;

  for (const [needle, type] of matchers) {
    if (value.includes(needle)) return type;
  }

  return "other";
}

function inferOrderRequirements(category?: string, serviceName?: string, providerType?: string) {
  const value = `${category ?? ""} ${serviceName ?? ""} ${providerType ?? ""}`.toLowerCase();
  if (value.includes("custom comments package")) return { requiredFields: ["comments"], omitQuantity: true };
  if (value.includes("custom meme comments")) return { requiredFields: ["comments"], omitQuantity: false };
  if (value.includes("meme comments")) return { requiredFields: ["comments"], omitQuantity: false };
  if (value.includes("custom comments")) return { requiredFields: ["comments"], omitQuantity: false };
  if (value.includes("comment replies")) return { requiredFields: ["comments", "username"], omitQuantity: false };
  if (value.includes("mentions with hashtags")) return { requiredFields: ["usernames", "hashtags"], omitQuantity: false };
  if (value.includes("mentions user followers")) return { requiredFields: ["username"], omitQuantity: false };
  if (value.includes("mentions media likers")) return { requiredFields: ["media_url"], omitQuantity: false };
  if (value.includes("mentions hashtag")) return { requiredFields: ["hashtag"], omitQuantity: false };
  if (value.includes("mentions")) return { requiredFields: ["usernames"], omitQuantity: false };
  if (value.includes("invites from groups")) return { requiredFields: ["groups"], omitQuantity: false };
  if (value.includes("poll")) return { requiredFields: ["answer_number"], omitQuantity: false };
  return { requiredFields: [], omitQuantity: false };
}

function inferPlatformName(category?: string, serviceName?: string) {
  const value = `${category ?? ""} ${serviceName ?? ""}`.toLowerCase();

  const platformMatchers = [
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["youtube", "YouTube"],
    ["facebook", "Facebook"],
    ["twitter", "X"],
    ["x.com", "X"],
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
    ["google play store", "Google Play Store"],
    ["google play", "Google Play Store"],
    ["google business", "Google Business"],
    ["google maps", "Google Business"],
    ["business profile", "Google Business"],
    ["website", "Website"],
    ["yelp", "Yelp"],
    ["patreon", "Patreon"],
    ["onlyfans", "OnlyFans"],
    ["rumble", "Rumble"],
    ["likee", "Likee"],
    ["kwai", "Kwai"],
    ["lemon8", "Lemon8"],
    ["bereal", "BeReal"],
    ["bluesky", "Bluesky"],
    ["mastodon", "Mastodon"],
    ["clubhouse", "Clubhouse"],
    ["truth social", "Truth Social"],
    ["truthsocial", "Truth Social"],
    ["gab", "Gab"],
    ["mewe", "MeWe"],
    ["koo", "Koo"],
    ["line", "LINE"],
    ["weibo", "Weibo"],
    ["douyin", "Douyin"],
    ["bilibili", "Bilibili"],
    ["mixcloud", "Mixcloud"],
    ["steam", "Steam"],
    ["roblox", "Roblox"],
    ["minecraft", "Minecraft"],
    ["threads.net", "Threads"],
    ["substack", "Substack"],
    ["medium", "Medium"],
    ["behance", "Behance"],
    ["dribbble", "Dribbble"],
    ["flickr", "Flickr"],
    ["deviantart", "DeviantArt"],
    ["product hunt", "Product Hunt"],
    ["producthunt", "Product Hunt"],
    ["trustpilot", "Trustpilot"],
    ["tripadvisor", "Tripadvisor"],
  ] as const;

  for (const [needle, label] of platformMatchers) {
    if (matchesPlatform(value, needle)) return label;
  }

  return category?.trim() || "Other";
}

function matchesPlatform(value: string, needle: string) {
  if (needle.length <= 2) {
    return new RegExp(`(^|[^a-z0-9])${needle}(?=$|[^a-z0-9])`, "i").test(value);
  }
  return value.includes(needle);
}
");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(value);
}

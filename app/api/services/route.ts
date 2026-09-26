import { and, eq, exists, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { platforms, providerServices, providers, services } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";

export async function GET(request: Request) {
  const limited = rateLimit(request,"services-read",30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied=await requireOwner();
  if (denied) return denied;
  try {
    const rows=await db
      .select({
        id: services.id,
        name: services.name,
        platform: platforms.name,
        min: services.minQuantity,
        max: services.maxQuantity,
        serviceType: sql<string>`coalesce(
          nullif((
            select provider_services.metadata->>'serviceType'
            from provider_services
            inner join providers on provider_services.provider_id = providers.id
            where provider_services.service_id = services.id
              and provider_services.active = true
              and providers.enabled = true
            order by provider_services.created_at desc
            limit 1
          ), 'other'),
          case
            when lower(services.name) like '%app download and signup%' or lower(services.name) like '%download and signup%' then 'app_download_signup'
            when lower(services.name) like '%signup + like%' or lower(services.name) like '%sign up + like%' then 'signup_like'
            when lower(services.name) like '%page like%' then 'page_likes'
            when lower(services.name) like '%group member%' then 'group_members'
            when lower(services.name) like '%post share%' then 'post_shares'
            when lower(services.name) like '%share to story%' or lower(services.name) like '%story share%' then 'story_shares'
            when lower(services.name) like '%custom meme comment%' then 'custom_meme_comments'
            when lower(services.name) like '%meme comment%' then 'meme_comments'
            when lower(services.name) like '%poll vote%' then 'poll_votes'
            when lower(services.name) like '%channel follow%' then 'channel_follows'
            when lower(services.name) like '%repin%' then 'repins'
            when lower(services.name) like '%impression%' then 'impressions'
            when lower(services.name) like '%follower%' or lower(services.name) like '%follow%' then 'followers'
            when lower(services.name) like '%subscriber%' then 'subscribers'
            when lower(services.name) like '%member%' then 'members'
            when lower(services.name) like '%comment%' then 'comments'
            when lower(services.name) like '%like%' then 'likes'
            when lower(services.name) like '%view%' then 'views'
            when lower(services.name) like '%share%' then 'shares'
            when lower(services.name) like '%repost%' or lower(services.name) like '%retweet%' then 'reposts'
            when lower(services.name) like '%save%' then 'saves'
            when lower(services.name) like '%mention%' then 'mentions'
            when lower(services.name) like '%vote%' then 'votes'
            else 'other'
          end
        )`,
        pricePerThousand: sql<string | null>`(
          select provider_services.price_per_thousand
          from provider_services
          inner join providers on provider_services.provider_id = providers.id
          where provider_services.service_id = services.id
            and provider_services.active = true
            and providers.enabled = true
          order by provider_services.created_at desc
          limit 1
        )`,
        refillSupported: sql<boolean>`coalesce((
          select provider_services.refill_supported
          from provider_services
          inner join providers on provider_services.provider_id = providers.id
          where provider_services.service_id = services.id
            and provider_services.active = true
            and providers.enabled = true
          order by provider_services.created_at desc
          limit 1
        ), false)`,
        cancelSupported: sql<boolean>`coalesce((
          select coalesce((provider_services.metadata->>'cancelSupported')::boolean, false)
          from provider_services
          inner join providers on provider_services.provider_id = providers.id
          where provider_services.service_id = services.id
            and provider_services.active = true
            and providers.enabled = true
          order by provider_services.created_at desc
          limit 1
        ), false)`,
        orderRequirements: sql<unknown>`coalesce((
          select provider_services.metadata->'orderRequirements'
          from provider_services
          inner join providers on provider_services.provider_id = providers.id
          where provider_services.service_id = services.id
            and provider_services.active = true
            and providers.enabled = true
          order by provider_services.created_at desc
          limit 1
        ), jsonb_build_object('requiredFields', jsonb_build_array(), 'omitQuantity', false))`,
      })
      .from(services)
      .innerJoin(platforms, eq(services.platformId, platforms.id))
      .where(and(
        eq(services.enabled, true),
        exists(
          db
            .select({ id: providerServices.id })
            .from(providerServices)
            .innerJoin(providers, eq(providerServices.providerId, providers.id))
            .where(and(
              eq(providerServices.serviceId, services.id),
              eq(providerServices.active, true),
              eq(providers.enabled, true),
            )),
        ),
      ));
    return NextResponse.json({services:rows},{headers:{"Cache-Control":"no-store, max-age=0"}});
  } catch(error){console.error("Services query failed:",error);return NextResponse.json({error:"Unable to load services."},{status:500});}
}

import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, platforms, providerHealth, providerServices, providers, services } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { ProviderRejectedError } from "@/lib/providers/generic";
import { requireOwner } from "@/lib/auth/require-owner";
import { requireSameOrigin } from "@/lib/security/csrf";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}

function replayResponse(order: typeof orders.$inferSelect) {
  if (order.status === "pending") {
    return NextResponse.json({ ok: true, replayed: true, pending: true, order }, { status: 202 });
  }
  if (order.status === "failed" || order.status === "cancelled") {
    return NextResponse.json(
      { ok: false, replayed: true, error: "This order request has already been finalized unsuccessfully. Start a new order to retry.", order },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, replayed: true, order });
}


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

  const descriptorWords = new Set(raw.replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean));
  const descriptors = descriptorTerms.filter((term) => descriptorWords.has(term));
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

export async function POST(request: Request) {
  const limited = rateLimit(request, "orders-create", 10);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  try {
    const body = (await request.json()) as {
      serviceId?: string;
      target?: string;
      quantity?: number;
      fields?: Record<string, unknown>;
      providerId?: string;
      idempotencyKey?: string;
    };
    const idempotencyKey = String(body.idempotencyKey ?? request.headers.get("idempotency-key") ?? "").trim();
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 });
    }

    const existing = (await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey))).at(0);
    if (existing) return replayResponse(existing);

    const serviceId = String(body.serviceId ?? "").trim();
    const requestedProviderId = String(body.providerId ?? "").trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (requestedProviderId && !uuidPattern.test(requestedProviderId)) return NextResponse.json({ error: "Invalid provider selection." }, { status: 400 });
    if (!uuidPattern.test(serviceId)) return NextResponse.json({ error: "Invalid service ID." }, { status: 400 });
    const target = String(body.target ?? "").trim();
    if (target.length > 2048) return NextResponse.json({ error: "Target is too long." }, { status: 400 });
    const quantity = Number(body.quantity);
    if (!serviceId || !target || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Service, target, and a valid quantity are required." }, { status: 400 });
    }
    const service = (await db.select().from(services).where(eq(services.id, serviceId))).at(0);
    if (!service || !service.enabled) return NextResponse.json({ error: "Service is unavailable." }, { status: 404 });
    if (quantity < service.minQuantity || quantity > service.maxQuantity) {
      return NextResponse.json({ error: "Quantity must be between " + service.minQuantity + " and " + service.maxQuantity + "." }, { status: 400 });
    }
    const selectedPlatform = (await db.select({ name: platforms.name }).from(platforms).where(eq(platforms.id, service.platformId))).at(0)?.name ?? "Other";
    const selectedMapping = (await db.select({ mapping: providerServices })
      .from(providerServices)
      .where(and(eq(providerServices.serviceId, service.id), eq(providerServices.active, true)))).at(0);
    const selectedType = String(selectedMapping?.mapping.metadata && typeof selectedMapping.mapping.metadata === "object"
      ? (selectedMapping.mapping.metadata as { serviceType?: unknown }).serviceType ?? ""
      : "").trim() || inferServiceType(service.name);

    const allCandidates = await db.select({ mapping: providerServices, provider: providers, candidateService: services, platform: platforms })
      .from(providerServices)
      .innerJoin(providers, eq(providerServices.providerId, providers.id))
      .innerJoin(services, eq(providerServices.serviceId, services.id))
      .innerJoin(platforms, eq(services.platformId, platforms.id))
      .where(and(eq(providerServices.active, true), eq(providers.enabled, true), eq(services.enabled, true)));

    const scored = allCandidates
      .map(({ mapping, provider, candidateService, platform }) => {
        const candidateType = String(mapping.metadata && typeof mapping.metadata === "object"
          ? (mapping.metadata as { serviceType?: unknown }).serviceType ?? ""
          : "").trim() || inferServiceType(candidateService.name);
        return {
          mapping,
          provider,
          score: routingScore(
            { platform: selectedPlatform, serviceType: selectedType, name: service.name },
            { platform: platform.name, serviceType: candidateType, name: candidateService.name },
          ),
        };
      })
      .filter(({ score }) => score >= 70 && quantity >= (0) && quantity <= (Number.MAX_SAFE_INTEGER));

    const bestByProvider = new Map<string, typeof scored[number]>();
    for (const row of scored) {
      const min = row.mapping.minQuantity ?? service.minQuantity;
      const max = row.mapping.maxQuantity ?? service.maxQuantity;
      if (quantity < min || quantity > max) continue;
      const existing = bestByProvider.get(row.provider.id);
      if (!existing || row.score > existing.score || (row.score === existing.score && Number(row.mapping.pricePerThousand ?? Infinity) < Number(existing.mapping.pricePerThousand ?? Infinity))) {
        bestByProvider.set(row.provider.id, row);
      }
    }
    const eligible = [...bestByProvider.values()];
    if (!eligible.length) return NextResponse.json({ error: "No enabled provider can fulfill this quantity for this service." }, { status: 409 });
    if (requestedProviderId && !eligible.some((candidate) => candidate.provider.id === requestedProviderId)) {
      return NextResponse.json({ error: "The selected provider is no longer compatible with this service or quantity." }, { status: 409 });
    }

    const healthRows = await db.select({ providerId: providerHealth.providerId, status: providerHealth.status, responseTimeMs: providerHealth.responseTimeMs, checkedAt: providerHealth.checkedAt })
      .from(providerHealth).orderBy(desc(providerHealth.checkedAt)).limit(500);
    const latestHealth = new Map<string, typeof healthRows[number]>();
    for (const row of healthRows) if (!latestHealth.has(row.providerId)) latestHealth.set(row.providerId, row);
    const healthRank: Record<string, number> = { healthy: 0, degraded: 1, unknown: 2, down: 3 };
    eligible.sort((a, b) => {
      const ah = latestHealth.get(a.provider.id);
      const bh = latestHealth.get(b.provider.id);
      const hr = (healthRank[ah?.status ?? "unknown"] ?? 2) - (healthRank[bh?.status ?? "unknown"] ?? 2);
      if (hr !== 0) return hr;
      const ap = a.mapping.pricePerThousand == null ? Number.POSITIVE_INFINITY : Number(a.mapping.pricePerThousand);
      const bp = b.mapping.pricePerThousand == null ? Number.POSITIVE_INFINITY : Number(b.mapping.pricePerThousand);
      if (ap !== bp) return ap - bp;
      return (ah?.responseTimeMs ?? Number.POSITIVE_INFINITY) - (bh?.responseTimeMs ?? Number.POSITIVE_INFINITY);
    });
    const mapping = requestedProviderId
      ? eligible.find((candidate) => candidate.provider.id === requestedProviderId)!
      : eligible[0];
    const providerMin = mapping.mapping.minQuantity ?? service.minQuantity;
    const providerMax = mapping.mapping.maxQuantity ?? service.maxQuantity;

    const requirements = getOrderRequirements(mapping.mapping.metadata);
    const rawFields = body.fields ?? {};
    const fields: Record<string, string> = {};
    for (const key of requirements.requiredFields) {
      const value = typeof rawFields[key] === "string" ? rawFields[key].trim() : "";
      if (!value) return NextResponse.json({ error: `The selected service requires: ${requirements.requiredFields.join(", ")}.` }, { status: 400 });
      if (value.length > 20_000) return NextResponse.json({ error: `Order field "${key}" is too long.` }, { status: 400 });
      fields[key] = value;
    }

    if (fields.answer_number && !["1", "2"].includes(fields.answer_number)) {
      return NextResponse.json({ error: "Poll answer must be 1 or 2." }, { status: 400 });
    }

    if (fields.comments) {
      const commentLines = fields.comments.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (commentLines.length !== quantity) {
        return NextResponse.json({ error: `Comments must contain exactly ${quantity} non-empty lines.` }, { status: 400 });
      }
    }

    let order;
    try {
      order = (await db.insert(orders).values({
        serviceId: service.id,
        target,
        quantity,
        status: "pending",
        providerId: mapping.provider.id,
        idempotencyKey,
      }).returning()).at(0);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const conflicting = (await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey))).at(0);
      if (conflicting) return replayResponse(conflicting);
      throw error;
    }

    if (!order) throw new Error("Order record could not be created.");
    try {
      await db.insert(orderEvents).values({ orderId: order.id, eventType: "created", message: "Local order created; awaiting upstream provider submission." });
    } catch (eventError) {
      console.error("Order creation event logging failed:", eventError);
    }
    let providerOrderId: string | undefined;
    try {
      const provider = createProviderAdapter({ name: mapping.provider.name, baseUrl: mapping.provider.baseUrl });
      const created = await provider.createOrder({
        serviceId: mapping.mapping.externalServiceId,
        target,
        quantity,
        fields,
        omitQuantity: requirements.omitQuantity,
      });
      providerOrderId = created.providerOrderId;

      // Record the upstream ID immediately after provider acceptance so the
      // sync worker can recover it if the local order update fails.
      try {
        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: "provider_submitted",
          message: "Order submitted to upstream provider.",
          payload: { providerOrderId },
        });
      } catch (eventError) {
        console.error("Provider submission event logging failed:", eventError);
      }

      let updated = (await db.update(orders).set({ status: "processing", providerOrderId, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning()).at(0);
      if (!updated) {
        for (let attempt = 0; attempt < 2 && !updated; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          updated = (await db.update(orders).set({ status: "processing", providerOrderId, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning()).at(0);
        }
      }
      if (!updated) {
        console.error("Provider order created but local order update failed:", order.id);
        return NextResponse.json({ ok: false, error: "Order was submitted, but local status synchronization is pending. Do not resubmit this order." }, { status: 503 });
      }
      return NextResponse.json({ ok: true, order: updated });
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        const initialMessage = error.message || "Provider rejected the order.";

        // A provider rejection is an explicit refusal, so Smart Auto can
        // safely try another already-validated compatible provider. We never
        // fail over after an uncertain/network error because that could create
        // a duplicate upstream order.
        if (!requestedProviderId) {
          const alternatives = eligible.filter((candidate) => candidate.provider.id !== mapping.provider.id);
          for (const alternative of alternatives) {
            try {
              const fallbackProvider = createProviderAdapter({
                name: alternative.provider.name,
                baseUrl: alternative.provider.baseUrl,
              });
              const fallbackCreated = await fallbackProvider.createOrder({
                serviceId: alternative.mapping.externalServiceId,
                target,
                quantity,
                fields,
                omitQuantity: requirements.omitQuantity,
              });

              try {
                await db.insert(orderEvents).values({
                  orderId: order.id,
                  eventType: "provider_failover",
                  message: "Smart Auto switched to a compatible provider after the selected provider rejected the order.",
                  payload: {
                    rejectedProviderId: mapping.provider.id,
                    fallbackProviderId: alternative.provider.id,
                    fallbackProviderOrderId: fallbackCreated.providerOrderId,
                    rejectionReason: initialMessage,
                  },
                });
              } catch (eventError) {
                console.error("Provider failover event logging failed:", eventError);
              }

              const fallbackUpdated = await db.update(orders).set({
                providerId: alternative.provider.id,
                status: "processing",
                providerOrderId: fallbackCreated.providerOrderId,
                errorMessage: null,
                updatedAt: new Date(),
              }).where(eq(orders.id, order.id)).returning();

              if (fallbackUpdated.at(0)) {
                return NextResponse.json({
                  ok: true,
                  order: fallbackUpdated[0],
                  failover: true,
                  previousProviderId: mapping.provider.id,
                });
              }

              return NextResponse.json(
                { ok: false, error: "Order was submitted through a fallback provider, but local status synchronization is pending. Do not resubmit this order." },
                { status: 503 },
              );
            } catch (fallbackError) {
              if (fallbackError instanceof ProviderRejectedError) continue;

              // The fallback outcome is uncertain, so preserve the order as
              // pending rather than risking another upstream submission.
              await db.update(orders).set({
                providerId: alternative.provider.id,
                status: "pending",
                errorMessage: "Fallback provider submission outcome is uncertain; reconciliation is required.",
                updatedAt: new Date(),
              }).where(eq(orders.id, order.id));
              try {
                await db.insert(orderEvents).values({
                  orderId: order.id,
                  eventType: "provider_failover_uncertain",
                  message: "Fallback provider submission outcome could not be confirmed. Order was left pending.",
                  payload: { fallbackProviderId: alternative.provider.id },
                });
              } catch (eventError) {
                console.error("Provider failover event logging failed:", eventError);
              }
              return NextResponse.json(
                { ok: false, pending: true, error: "Provider rejected the order and fallback submission could not be confirmed. Do not resubmit this order.", order },
                { status: 503 },
              );
            }
          }
        }

        const message = alternativesMessage(initialMessage, eligible, mapping.provider.id);
        await db.update(orders).set({
          status: "failed",
          errorMessage: message,
          updatedAt: new Date(),
        }).where(eq(orders.id, order.id));
        try {
          await db.insert(orderEvents).values({
            orderId: order.id,
            eventType: "provider_rejected",
            message: "Provider rejected the order; no compatible fallback provider accepted it.",
            payload: { reason: initialMessage },
          });
        } catch (eventError) {
          console.error("Provider rejection event logging failed:", eventError);
        }
        return NextResponse.json(
          { ok: false, error: message, order: { ...order, status: "failed", errorMessage: message } },
          { status: 502 },
        );
      }
      if (providerOrderId) {
        console.error("Provider order was created but local synchronization failed:", order.id);
        return NextResponse.json({ ok: false, error: "Order was submitted, but local status synchronization is pending. Do not resubmit this order." }, { status: 503 });
      }
      // A timeout/connection failure can happen after the provider accepted the
      // order but before we received its ID. Marking it failed here would allow
      // a retry to create a duplicate upstream order. Keep it pending instead;
      // the idempotency key still prevents accidental resubmission.
      await db.update(orders).set({
        status: "pending",
        errorMessage: "Provider submission outcome is uncertain; manual/provider reconciliation is required.",
        updatedAt: new Date(),
      }).where(eq(orders.id, order.id));
      await db.insert(orderEvents).values({
        orderId: order.id,
        eventType: "provider_submission_uncertain",
        message: "Provider submission outcome could not be confirmed. Order was left pending to prevent duplicate submission.",
      });
      return NextResponse.json(
        { ok: false, pending: true, error: "Provider submission could not be confirmed. Do not resubmit this order; reconciliation is required.", order },
        { status: 503 },
      );
    }
  } catch (error) {
    console.error("Order creation failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to create order." }, { status: 500 });
  }
}

function alternativesMessage(initialMessage: string, eligible: Array<{ provider: typeof providers.$inferSelect }>, selectedProviderId: string) {
  const attempted = eligible.filter((candidate) => candidate.provider.id !== selectedProviderId).length;
  return attempted > 0
    ? `${initialMessage} No compatible fallback provider accepted this order.`
    : initialMessage;
}

function getOrderRequirements(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return { requiredFields: [] as string[], omitQuantity: false };
  const value = metadata as { orderRequirements?: unknown };
  const requirements = value.orderRequirements;
  if (!requirements || typeof requirements !== "object") return { requiredFields: [] as string[], omitQuantity: false };
  const data = requirements as { requiredFields?: unknown; omitQuantity?: unknown };
  const requiredFields = Array.isArray(data.requiredFields)
    ? data.requiredFields.filter((field): field is string => typeof field === "string").slice(0, 8)
    : [];
  return { requiredFields, omitQuantity: data.omitQuantity === true };
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "orders-read", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 200;

    // Allow lightweight consumers such as the dashboard to request only the
    // rows they display instead of always loading the full 200-order payload.
    const rows = limit <= 20
      ? await db
          .select({
            id: orders.id,
            target: orders.target,
            quantity: orders.quantity,
            status: orders.status,
            completedQuantity: orders.completedQuantity,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .orderBy(desc(orders.createdAt))
          .limit(limit)
      : await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);

    return NextResponse.json({ orders: rows }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Order list failed:", error);
    return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
  }
}

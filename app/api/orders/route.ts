import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providerServices, providers, services } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
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
      idempotencyKey?: string;
    };
    const idempotencyKey = String(body.idempotencyKey ?? request.headers.get("idempotency-key") ?? "").trim();
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 });
    }

    const existing = (await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey))).at(0);
    if (existing) return replayResponse(existing);

    const serviceId = String(body.serviceId ?? "").trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    const mapping = (await db
      .select({ mapping: providerServices, provider: providers })
      .from(providerServices)
      .innerJoin(providers, eq(providerServices.providerId, providers.id))
      .where(and(
        eq(providerServices.serviceId, service.id),
        eq(providerServices.active, true),
        eq(providers.enabled, true),
      ))
      .limit(1)).at(0);
    if (!mapping) return NextResponse.json({ error: "No active provider mapping exists for this service." }, { status: 409 });
    const providerMin = mapping.mapping.minQuantity ?? service.minQuantity;
    const providerMax = mapping.mapping.maxQuantity ?? service.maxQuantity;
    if (quantity < providerMin || quantity > providerMax) return NextResponse.json({ error: "Quantity must be between " + providerMin + " and " + providerMax + " for the selected provider." }, { status: 400 });

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
      const provider = createProviderAdapter({ name: mapping.provider.name, baseUrl: mapping.provider.baseUrl, apiKey: process.env.PROVIDER_API_KEY ?? "" });
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
    } catch {
      if (providerOrderId) {
        console.error("Provider order was created but local synchronization failed:", order.id);
        return NextResponse.json({ ok: false, error: "Order was submitted, but local status synchronization is pending. Do not resubmit this order." }, { status: 503 });
      }
      await db.update(orders).set({ status: "failed", errorMessage: "Upstream provider submission failed.", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await db.insert(orderEvents).values({ orderId: order.id, eventType: "provider_submission_failed", message: "Order could not be submitted to upstream provider." });
      return NextResponse.json({ ok: false, error: "Order could not be submitted to the configured provider." }, { status: 502 });
    }
  } catch (error) {
    console.error("Order creation failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to create order." }, { status: 500 });
  }
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

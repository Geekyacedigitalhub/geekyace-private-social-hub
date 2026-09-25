import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providerServices, providers, refills } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";
import { requireSameOrigin } from "@/lib/security/csrf";

const ACTIVE_REFILL_STATUSES = ["eligible", "requested", "processing"] as const;

export async function GET(request: Request) {
  const limited = rateLimit(request, "refills-read", 30);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const rows = await db.select().from(refills).orderBy(desc(refills.createdAt)).limit(200);
    return NextResponse.json(
      { refills: rows },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Refill list failed:", error);
    return NextResponse.json({ error: "Unable to load refills." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "refill-create", 10);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  try {
    const body = (await request.json()) as { orderId?: string };
    const orderId = String(body.orderId ?? "").trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(orderId)) {
      return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    }

    const order = (await db.select().from(orders).where(eq(orders.id, orderId))).at(0);
    if (!order?.providerOrderId || !order.providerId) {
      return NextResponse.json({ error: "Order is not linked to a provider." }, { status: 404 });
    }
    if (order.providerOrderId.length > 256) {
      return NextResponse.json({ error: "Provider order ID is invalid." }, { status: 409 });
    }

    const providerRow = (await db.select().from(providers).where(eq(providers.id, order.providerId))).at(0);
    if (!providerRow?.enabled) {
      return NextResponse.json({ error: "Assigned provider is unavailable." }, { status: 409 });
    }

    const mapping = (
      await db
        .select()
        .from(providerServices)
        .where(
          and(
            eq(providerServices.providerId, order.providerId),
            eq(providerServices.serviceId, order.serviceId),
            eq(providerServices.active, true),
          ),
        )
    ).at(0);
    if (!mapping?.refillSupported) {
      return NextResponse.json({ error: "Refill is not enabled for this service." }, { status: 409 });
    }

    const existing = (
      await db
        .select()
        .from(refills)
        .where(and(eq(refills.orderId, order.id), inArray(refills.status, ACTIVE_REFILL_STATUSES)))
    ).at(0);
    if (existing) {
      return NextResponse.json({ error: "An active refill request already exists for this order." }, { status: 409 });
    }

    // Claim the refill before contacting the provider. The partial unique index
    // prevents concurrent requests from creating multiple active claims.
    let claim;
    try {
      claim = (
        await db
          .insert(refills)
          .values({
            orderId: order.id,
            status: "requested",
            requestedAt: new Date(),
          })
          .returning()
      ).at(0);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          { error: "An active refill request already exists for this order." },
          { status: 409 },
        );
      }
      throw error;
    }

    if (!claim) {
      return NextResponse.json({ error: "Unable to reserve the refill request." }, { status: 500 });
    }

    const provider = createProviderAdapter({
      name: providerRow.name,
      baseUrl: providerRow.baseUrl,
      apiKey: process.env.PROVIDER_API_KEY ?? "",
    });
    if (!provider.requestRefill) {
      await markRefillFailed(claim.id);
      return NextResponse.json(
        { error: "The configured provider does not support refill requests." },
        { status: 409 },
      );
    }

    let created;
    try {
      created = await provider.requestRefill(order.providerOrderId);
    } catch (error) {
      // Keep the claim active when the provider outcome is uncertain. This
      // prevents a retry from submitting a second upstream refill.
      console.error("Provider refill submission failed:", error);
      return NextResponse.json(
        {
          ok: false,
          error: "Refill submission outcome is uncertain. Do not retry this order until it is reconciled.",
        },
        { status: 502 },
      );
    }

    let inserted;
    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      try {
        inserted = (
          await db
            .update(refills)
            .set({
              providerRefillId: created.providerRefillId,
              status: "requested",
              requestedAt: new Date(),
            })
            .where(eq(refills.id, claim.id))
            .returning()
        ).at(0);
      } catch (syncError) {
        console.error("Refill claim update failed after provider submission:", {
          claimId: claim.id,
          attempt: attempt + 1,
          error: syncError,
        });
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }

    if (!inserted) {
      console.error("Refill claim update could not be synchronized after provider submission:", claim.id);
      return NextResponse.json(
        {
          ok: false,
          error: "Refill was submitted, but local status synchronization is pending. Do not resubmit this refill.",
        },
        { status: 503 },
      );
    }

    try {
      await db.insert(orderEvents).values({
        orderId: order.id,
        eventType: "refill_requested",
        message: "Refill request submitted to upstream provider.",
        payload: { providerRefillId: created.providerRefillId },
      });
    } catch (eventError) {
      console.error("Refill event logging failed:", eventError);
    }

    return NextResponse.json(
      { ok: true, refill: inserted },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Refill request failed:", error);
    return NextResponse.json({ ok: false, error: "Refill request failed." }, { status: 502 });
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function markRefillFailed(refillId: string) {
  try {
    await db.update(refills).set({ status: "failed" }).where(eq(refills.id, refillId));
  } catch (error) {
    console.error("Failed to release refill claim:", error);
  }
}

CREATE TYPE "public"."order_status" AS ENUM('pending', 'processing', 'completed', 'partial', 'failed', 'cancelled');
CREATE TYPE "public"."refill_status" AS ENUM('eligible', 'requested', 'processing', 'completed', 'failed', 'not_eligible');
CREATE TYPE "public"."provider_health_status" AS ENUM('healthy', 'degraded', 'down', 'unknown');

CREATE TABLE "platforms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "slug" text NOT NULL UNIQUE,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform_id" uuid NOT NULL REFERENCES "platforms"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "min_quantity" integer NOT NULL,
  "max_quantity" integer NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "services_quantity_range_check" CHECK ("min_quantity" > 0 AND "max_quantity" >= "min_quantity")
);

CREATE TABLE "providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "base_url" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "provider_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" uuid NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "external_service_id" text NOT NULL,
  "price_per_thousand" numeric(14,4),
  "min_quantity" integer,
  "max_quantity" integer,
  "refill_supported" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "provider_services_quantity_range_check" CHECK (
    ("min_quantity" IS NULL OR "min_quantity" > 0) AND
    ("max_quantity" IS NULL OR "max_quantity" >= COALESCE("min_quantity", 1)) AND
    ("price_per_thousand" IS NULL OR "price_per_thousand" >= 0)
  )
);

CREATE TABLE "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE RESTRICT,
  "target" text NOT NULL,
  "quantity" integer NOT NULL,
  "status" "public"."order_status" NOT NULL DEFAULT 'pending',
  "provider_id" uuid REFERENCES "providers"("id") ON DELETE SET NULL,
  "provider_order_id" text,
  "start_count" integer,
  "current_count" integer,
  "completed_quantity" integer,
  "remains" integer,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "orders_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "order_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "message" text,
  "payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "refills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "provider_refill_id" text,
  "status" "public"."refill_status" NOT NULL DEFAULT 'eligible',
  "requested_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "provider_health" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" uuid NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "status" "public"."provider_health_status" NOT NULL DEFAULT 'unknown',
  "response_time_ms" integer,
  "checked_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "provider_balance_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" uuid NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "balance" numeric(14,4) NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "checked_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" text,
  "action" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "services_platform_slug_unique" ON "services" ("platform_id", "slug");
CREATE UNIQUE INDEX "provider_services_mapping_unique" ON "provider_services" ("provider_id", "service_id", "external_service_id");
CREATE INDEX "services_platform_id_idx" ON "services" ("platform_id");
CREATE INDEX "provider_services_provider_id_idx" ON "provider_services" ("provider_id");
CREATE INDEX "provider_services_service_id_idx" ON "provider_services" ("service_id");
CREATE INDEX "orders_status_idx" ON "orders" ("status");
CREATE INDEX "orders_provider_id_idx" ON "orders" ("provider_id");
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at");
CREATE INDEX "order_events_order_id_idx" ON "order_events" ("order_id");
CREATE INDEX "refills_order_id_idx" ON "refills" ("order_id");
CREATE INDEX "provider_health_provider_checked_idx" ON "provider_health" ("provider_id", "checked_at");
CREATE INDEX "provider_balance_provider_checked_idx" ON "provider_balance_snapshots" ("provider_id", "checked_at");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");

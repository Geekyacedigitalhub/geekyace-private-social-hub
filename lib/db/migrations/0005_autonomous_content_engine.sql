CREATE TYPE "public"."content_status" AS ENUM('idea','scripted','generating','ready','scheduled','published','failed','archived');
CREATE TYPE "public"."content_type" AS ENUM('short_video','carousel','image','text');
CREATE TYPE "public"."automation_mode" AS ENUM('assisted','trusted','autonomous');
CREATE TYPE "public"."scheduled_post_status" AS ENUM('draft','scheduled','publishing','published','failed','cancelled');

CREATE TABLE "brand_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "website_url" text,
  "description" text NOT NULL,
  "audience" jsonb,
  "voice" text,
  "colors" jsonb,
  "content_rules" jsonb,
  "automation_mode" "automation_mode" NOT NULL DEFAULT 'trusted',
  "timezone" text NOT NULL DEFAULT 'Africa/Lagos',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "content_pillars" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_profile_id" uuid NOT NULL REFERENCES "brand_profiles"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "weight" integer NOT NULL DEFAULT 20,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "trends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_profile_id" uuid REFERENCES "brand_profiles"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "external_id" text,
  "title" text NOT NULL,
  "summary" text,
  "url" text,
  "relevance_score" integer NOT NULL DEFAULT 0,
  "momentum_score" integer NOT NULL DEFAULT 0,
  "risk_score" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "discovered_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz
);

CREATE TABLE "content_ideas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_profile_id" uuid NOT NULL REFERENCES "brand_profiles"("id") ON DELETE CASCADE,
  "trend_id" uuid REFERENCES "trends"("id") ON DELETE SET NULL,
  "pillar_id" uuid REFERENCES "content_pillars"("id") ON DELETE SET NULL,
  "type" "content_type" NOT NULL DEFAULT 'short_video',
  "title" text NOT NULL,
  "hook" text,
  "script" text,
  "caption" text,
  "cta" text,
  "hashtags" jsonb,
  "status" "content_status" NOT NULL DEFAULT 'idea',
  "score" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "content_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "content_idea_id" uuid NOT NULL REFERENCES "content_ideas"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "provider" text,
  "external_id" text,
  "url" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "social_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_profile_id" uuid NOT NULL REFERENCES "brand_profiles"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "account_name" text NOT NULL,
  "external_account_id" text,
  "status" text NOT NULL DEFAULT 'disconnected',
  "token_reference" text,
  "metadata" jsonb,
  "connected_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "scheduled_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "content_idea_id" uuid NOT NULL REFERENCES "content_ideas"("id") ON DELETE CASCADE,
  "social_account_id" uuid NOT NULL REFERENCES "social_accounts"("id") ON DELETE CASCADE,
  "status" "scheduled_post_status" NOT NULL DEFAULT 'draft',
  "scheduled_for" timestamptz NOT NULL,
  "published_at" timestamptz,
  "external_post_id" text,
  "error_message" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "content_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "scheduled_post_id" uuid NOT NULL REFERENCES "scheduled_posts"("id") ON DELETE CASCADE,
  "views" integer NOT NULL DEFAULT 0,
  "likes" integer NOT NULL DEFAULT 0,
  "comments" integer NOT NULL DEFAULT 0,
  "shares" integer NOT NULL DEFAULT 0,
  "saves" integer NOT NULL DEFAULT 0,
  "clicks" integer NOT NULL DEFAULT 0,
  "watch_time_seconds" integer NOT NULL DEFAULT 0,
  "measured_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "content_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_profile_id" uuid NOT NULL REFERENCES "brand_profiles"("id") ON DELETE CASCADE,
  "run_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'running',
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "items_created" integer NOT NULL DEFAULT 0,
  "error_message" text,
  "metadata" jsonb
);

CREATE INDEX "trends_brand_discovered_idx" ON "trends" ("brand_profile_id","discovered_at");
CREATE INDEX "content_ideas_brand_status_idx" ON "content_ideas" ("brand_profile_id","status");
CREATE INDEX "scheduled_posts_due_idx" ON "scheduled_posts" ("status","scheduled_for");
CREATE INDEX "content_metrics_post_measured_idx" ON "content_metrics" ("scheduled_post_id","measured_at");

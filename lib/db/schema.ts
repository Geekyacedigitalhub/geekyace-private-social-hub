import { boolean, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const orderStatus = pgEnum("order_status", ["pending","processing","completed","partial","failed","cancelled"]);
export const refillStatus = pgEnum("refill_status", ["eligible","requested","processing","completed","failed","not_eligible"]);
export const providerHealthStatus = pgEnum("provider_health_status", ["healthy","degraded","down","unknown"]);

export const platforms = pgTable("platforms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformId: uuid("platform_id").references(() => platforms.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  minQuantity: integer("min_quantity").notNull(),
  maxQuantity: integer("max_quantity").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  baseUrl: text("base_url").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerServices = pgTable("provider_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id, { onDelete: "cascade" }).notNull(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
  externalServiceId: text("external_service_id").notNull(),
  pricePerThousand: numeric("price_per_thousand", { precision: 14, scale: 4 }),
  minQuantity: integer("min_quantity"),
  maxQuantity: integer("max_quantity"),
  refillSupported: boolean("refill_supported").notNull().default(false),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }).notNull(),
  target: text("target").notNull(),
  quantity: integer("quantity").notNull(),
  status: orderStatus("status").notNull().default("pending"),
  providerId: uuid("provider_id").references(() => providers.id, { onDelete: "set null" }),
  providerOrderId: text("provider_order_id"),
  idempotencyKey: text("idempotency_key"),
  startCount: integer("start_count"),
  currentCount: integer("current_count"),
  completedQuantity: integer("completed_quantity"),
  remains: integer("remains"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderEvents = pgTable("order_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(),
  message: text("message"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const refills = pgTable("refills", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  providerRefillId: text("provider_refill_id"),
  status: refillStatus("status").notNull().default("eligible"),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerHealth = pgTable("provider_health", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id, { onDelete: "cascade" }).notNull(),
  status: providerHealthStatus("status").notNull().default("unknown"),
  responseTimeMs: integer("response_time_ms"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerBalanceSnapshots = pgTable("provider_balance_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id, { onDelete: "cascade" }).notNull(),
  balance: numeric("balance", { precision: 14, scale: 4 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


export const contentStatus = pgEnum("content_status", ["idea","scripted","generating","ready","scheduled","published","failed","archived"]);
export const contentType = pgEnum("content_type", ["short_video","carousel","image","text"]);
export const automationMode = pgEnum("automation_mode", ["assisted","trusted","autonomous"]);
export const scheduledPostStatus = pgEnum("scheduled_post_status", ["draft","scheduled","publishing","published","failed","cancelled"]);

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  websiteUrl: text("website_url"),
  description: text("description").notNull(),
  audience: jsonb("audience"),
  voice: text("voice"),
  colors: jsonb("colors"),
  contentRules: jsonb("content_rules"),
  automationMode: automationMode("automation_mode").notNull().default("trusted"),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contentPillars = pgTable("content_pillars", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  weight: integer("weight").notNull().default(20),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const trends = pgTable("trends", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  externalId: text("external_id"),
  title: text("title").notNull(),
  summary: text("summary"),
  url: text("url"),
  relevanceScore: integer("relevance_score").notNull().default(0),
  momentumScore: integer("momentum_score").notNull().default(0),
  riskScore: integer("risk_score").notNull().default(0),
  metadata: jsonb("metadata"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const contentIdeas = pgTable("content_ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, { onDelete: "cascade" }).notNull(),
  trendId: uuid("trend_id").references(() => trends.id, { onDelete: "set null" }),
  pillarId: uuid("pillar_id").references(() => contentPillars.id, { onDelete: "set null" }),
  type: contentType("type").notNull().default("short_video"),
  title: text("title").notNull(),
  hook: text("hook"),
  script: text("script"),
  caption: text("caption"),
  cta: text("cta"),
  hashtags: jsonb("hashtags"),
  status: contentStatus("status").notNull().default("idea"),
  score: integer("score").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contentAssets = pgTable("content_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentIdeaId: uuid("content_idea_id").references(() => contentIdeas.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  provider: text("provider"),
  externalId: text("external_id"),
  url: text("url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const socialAccounts = pgTable("social_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, { onDelete: "cascade" }).notNull(),
  platform: text("platform").notNull(),
  accountName: text("account_name").notNull(),
  externalAccountId: text("external_account_id"),
  status: text("status").notNull().default("disconnected"),
  tokenReference: text("token_reference"),
  metadata: jsonb("metadata"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentIdeaId: uuid("content_idea_id").references(() => contentIdeas.id, { onDelete: "cascade" }).notNull(),
  socialAccountId: uuid("social_account_id").references(() => socialAccounts.id, { onDelete: "cascade" }).notNull(),
  status: scheduledPostStatus("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  externalPostId: text("external_post_id"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contentMetrics = pgTable("content_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  scheduledPostId: uuid("scheduled_post_id").references(() => scheduledPosts.id, { onDelete: "cascade" }).notNull(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  watchTimeSeconds: integer("watch_time_seconds").notNull().default(0),
  measuredAt: timestamp("measured_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contentRuns = pgTable("content_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, { onDelete: "cascade" }).notNull(),
  runType: text("run_type").notNull(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  itemsCreated: integer("items_created").notNull().default(0),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
});

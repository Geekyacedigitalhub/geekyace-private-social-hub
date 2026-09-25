CREATE INDEX IF NOT EXISTS "orders_status_updated_idx"
ON "orders" ("status", "updated_at" ASC);

CREATE INDEX IF NOT EXISTS "refills_status_created_idx"
ON "refills" ("status", "created_at" ASC);

CREATE INDEX IF NOT EXISTS "provider_services_provider_service_active_idx"
ON "provider_services" ("provider_id", "service_id", "active");

CREATE INDEX IF NOT EXISTS "provider_services_provider_external_idx"
ON "provider_services" ("provider_id", "external_service_id");

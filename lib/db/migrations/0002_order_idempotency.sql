ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;

CREATE UNIQUE INDEX "orders_idempotency_key_unique"
ON "orders" ("idempotency_key")
WHERE "idempotency_key" IS NOT NULL;

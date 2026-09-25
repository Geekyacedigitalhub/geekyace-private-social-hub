CREATE UNIQUE INDEX "refills_active_order_unique"
ON "refills" ("order_id")
WHERE "status" IN ('eligible', 'requested', 'processing');

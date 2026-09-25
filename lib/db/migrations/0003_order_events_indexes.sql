CREATE INDEX "order_events_order_created_idx"
ON "order_events" ("order_id", "created_at" DESC);

CREATE INDEX "order_events_order_type_created_idx"
ON "order_events" ("order_id", "event_type", "created_at" DESC);

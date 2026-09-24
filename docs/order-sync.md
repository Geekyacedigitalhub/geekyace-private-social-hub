# Order status synchronization

The private panel exposes a server-side synchronization endpoint at `/api/orders/sync`.

It requires the `x-sync-secret` header to match `INTERNAL_SYNC_SECRET`. The endpoint only checks pending and processing orders, queries the configured provider, updates the local order record, and records an order event.

Keep the sync secret server-side. Do not expose it in client-side JavaScript.

For a free deployment, this endpoint can be invoked by an external scheduler or an approved cron facility. The application itself does not need to run a permanent background process.

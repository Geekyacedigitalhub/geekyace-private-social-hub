# Private production security checklist

- Keep the repository private.
- Keep database and provider credentials server-side.
- Keep the owner email allowlist configured.
- Do not enable public registration in the application.
- Keep Neon Auth trusted origins limited to the actual deployment domains.
- Keep `INTERNAL_SYNC_SECRET` server-side.
- Never expose provider API keys in client components.
- Validate service IDs, targets, and quantities on the server.
- Record important order and administrative events.
- Use provider webhook verification if webhooks are enabled.
- Review provider terms and platform rules before enabling any service.

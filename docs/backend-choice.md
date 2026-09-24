# Backend Choice

## Decision

Use **Neon Serverless Postgres** instead of Supabase.

The current Supabase organization has reached its free-project limit, and we do not need to disturb any existing project.

## Why Neon fits this app

This is a private single-user Next.js/Vercel control panel. Its primary backend requirement is PostgreSQL. Neon provides serverless PostgreSQL and a free plan, and Neon documents Neon Auth for authentication on free-plan projects.

## Planned stack

- Next.js
- Neon Serverless Postgres
- Drizzle ORM
- Neon Auth
- Vercel
- Server-side provider adapters

## Security

- DATABASE_URL is server-only.
- Provider credentials are server-only.
- Sensitive operations require authentication.
- Audit logging will cover administrative actions.
- Database constraints enforce integrity.
- Authorization is implemented before production deployment.

No existing Supabase project will be paused, deleted, or modified.

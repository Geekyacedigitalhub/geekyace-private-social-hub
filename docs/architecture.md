# Architecture

## Application

Next.js App Router + TypeScript + Tailwind.

## Security boundary

Browser -> Next.js server boundary -> provider adapter -> provider API

Provider credentials must remain server-side. Public environment variables are limited to values safe for browser exposure.

## Planned data flow

1. User authenticates.
2. User selects a platform and service.
3. Application validates the order.
4. Server selects a configured provider route.
5. Server creates the upstream order.
6. Provider order ID is stored.
7. Status is synchronized.
8. Completion, partial, failure, and refill states are recorded.

## Planned persistence

Supabase PostgreSQL with Row Level Security.

## Private deployment

The application is intended for a private subdomain, with public registration disabled.

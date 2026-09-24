# Provider architecture

The private panel uses a provider adapter boundary so provider-specific HTTP details never leak into the UI.

## Adapter contract

Every provider adapter implements:

- service catalog retrieval
- balance retrieval
- order creation
- order status lookup
- optional cancellation
- optional refill status

## Security rules

- Provider API keys are server-side only.
- Never expose provider credentials through client components, browser JavaScript, database rows returned to the browser, or public API responses.
- Validate provider responses before writing them to the database.
- Use timeouts and record provider failures in order events and provider health records.
- Provider APIs are integrations only. The panel does not create accounts, automate fake accounts, bypass platform safeguards, or evade anti-spam systems.

## Generic provider

`GenericPanelProvider` supports the common POST form pattern used by many panel APIs. It is deliberately isolated behind `ProviderAdapter` so a provider with a different API can receive its own adapter later.

Before enabling any provider, verify that its API and the requested service are permitted to be used and that its published terms match the intended workflow.

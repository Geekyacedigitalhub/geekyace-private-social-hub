# GeekyAce Private Social Hub

Private, single-user control panel for managing social-service orders through configured provider APIs.

## Autonomous Content Engine

The private hub now includes the foundation for GeekyAce Digital Hub's autonomous marketing system:

- Brand profile and content-pillar model
- Trend opportunity records and scoring
- AI-ready content idea and asset pipeline
- Social account and scheduled-post model
- Performance metrics and content-run history
- Private Content Engine dashboard
- Server-side execution boundary for future trend, video and publishing adapters

See `docs/content-engine.md` for the execution architecture.

## Milestone 1

Foundation only:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Private single-user application shell
- Provider/API abstraction planned for later milestones
- Supabase integration planned after the application shell is in place
- Security-first server-side handling of provider credentials

## Intended deployment

The application is designed to run on a private subdomain such as:

`social.geekyacedigitalhub.com`

The application itself is intended to use free-tier infrastructure where practical.

## Important scope

This project is an order/control panel. It does not create fake social accounts, automate fake-account behavior, evade platform safeguards, or bypass platform security controls.

Upstream services must be used only where their APIs and terms permit the intended service.

## Local development

Requirements:

- Node.js 20+
- npm

Install and run:

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

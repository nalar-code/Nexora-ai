# Nexora AI — SaaS starter

A polished Next.js UI starter for an AI chatbot SaaS, with a OpenRouter server-side streaming route and a Supabase SQL schema starter.

## What's included
- Responsive marketing landing page: hero, features, how-it-works, pricing concept, CTA and footer.
- Chat workspace UI with starter prompts, streaming response display, copy, stop and mobile sidebar.
- Server-side OpenRouter API route with input validation and a configurable model.
- Supabase email/password registration and login actions, email confirmation callback, session refresh middleware, and sign-out.
- Supabase schema for profiles, conversations, messages, subscriptions, usage and file metadata, with row-level security policies.
- Environment example and production checklist.

## Important status notes
This is an **MVP starter**, not a fully deployed commercial service. Supabase Auth and conversation persistence are implemented in the code but require valid project credentials and SQL setup. Usage quotas and metering are implemented in the Phase 3 SQL/API path, but require applying the migration and validating it against a real Supabase project. Payments, document uploads/web search, and comprehensive production hardening are not enabled. Pricing is illustrative. Do not advertise unimplemented features as active.

## Requirements
- Node.js 20+
- npm
- An OpenRouter API key
- A Supabase project

## Run locally
1. Extract this project.
2. Copy `.env.example` to `.env.local`.
3. Set `OPENROUTER_API_KEY`, and configure `OPENROUTER_MODELS` with a comma-separated allowlist of model IDs. The first model is the default.
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.

If the API key is absent, the chat route returns a configuration message. Keep secrets server-side and never prefix them with `NEXT_PUBLIC_`.

## OpenRouter configuration
The server calls `https://openrouter.ai/api/v1/chat/completions` using a Bearer token. Configure:
- `OPENROUTER_API_KEY` (server-only secret)
- `OPENROUTER_MODELS` (comma-separated allowlist; first item is the default)
- `OPENROUTER_MAX_OUTPUT_TOKENS` (defaults to 2048)

The authenticated chat UI can select only models in the server allowlist. Check model IDs and pricing in the [OpenRouter model catalog](https://openrouter.ai/models). Never use a `NEXT_PUBLIC_` prefix for the API key.

## Supabase Auth and database setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication → URL Configuration, set your local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect URLs. Add your production URLs later.
4. Copy the project URL and anon/publishable key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Set `APP_ORIGIN=http://localhost:3000`, then restart the dev server.
6. Register through `/signup`, confirm email if enabled, and log in at `/login`.
7. The chat page now requires a Supabase session; the chat endpoint checks the signed-in user and stores messages in the database.

Never put the Supabase service-role key in browser code. The chat UI and conversation API use the authenticated user's session and the schema's RLS policies. Subscription entitlements must only be changed by a verified server-side payment webhook.

## Before production launch
- Implement Supabase Auth, server-side session checks and protected routes.
- Save conversations/messages in the database; verify conversation ownership on every operation.
- Add server-enforced per-user quotas, rate limiting, abuse monitoring and spend alerts.
- Handle stream cancellation, provider errors and retries robustly.
- Add secure upload validation and private object storage before exposing file features.
- Add a payment provider and signed webhook verification; make webhook processing idempotent.
- Add privacy policy, terms, account deletion and data retention controls.
- Add tests, logging, monitoring, backups and deployment environment configuration.
- Verify accessibility, mobile behavior and production build.
- Check applicable privacy, tax and consumer requirements for the target market.

## Suggested next implementation order
1. Supabase Auth and route protection.
2. Persisted conversations and messages.
3. Quotas and usage metering.
4. Payment gateway + verified webhooks.
5. File analysis and optional web search.
6. Tests, monitoring and deployment.

## Tech stack
Next.js App Router, React, TypeScript, Tailwind-like custom CSS, Lucide icons, OpenRouter REST API, Supabase-ready SQL schema.


## Phase 3 — Usage metering and quotas
1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. The chat API atomically reserves a request before calling OpenRouter and finalizes the usage record afterward. OpenRouter streaming usage metadata is used when returned; estimates are a fallback.
3. Monthly starter limits: Free 50 requests / 100,000 tokens; Pro 1,000 / 2,000,000; Team 5,000 / 10,000,000; Enterprise 20,000 / 50,000,000.
4. `/api/usage` reports current-month usage. Token counts use provider metadata when available and text-length estimates otherwise.
5. Paid limits apply only to `active` or `trialing` subscriptions. A trusted payment webhook must update subscription entitlements; browser clients must not be allowed to grant themselves paid plans.

Reservations are atomic per user. A request reserved before a provider failure is recorded as failed and excluded from request counts; production still needs reservation-expiry handling, monitoring, spend alerts, abuse protection, and load testing. Apply the SQL before using Phase 3; existing databases should back up data first.

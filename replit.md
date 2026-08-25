# Clinician Lab Platform

A clinician-facing decision-support workspace for structured external-prosthetic case planning, fitting documentation, and follow-up forecasting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/clinician-lab/` — the React case workspace and clinician-facing interface
- `artifacts/api-server/src/routes/clinical.ts` — clinical case, analysis, dashboard, and preset API endpoints
- `lib/api-spec/openapi.yaml` — source-of-truth API contract and generated client inputs
- `lib/db/src/schema/clinical.ts` — persistent case and clinician preference schema

## Architecture decisions

- Guidance is deliberately framed as clinical decision support rather than automated diagnosis or treatment authorization; clinicians remain responsible for review and approval.
- Starter cases are seeded idempotently through the API so a new workspace has useful example data without a separate seed command.
- Image selection currently stays browser-local for preview; persistent clinical image storage and true image/model generation must be designed with explicit consent, retention, and validation controls.

## Product

- Structured assessment intake captures case characteristics, treatment context, and retention information.
- Case workspaces provide generic treatment guidance, naturalness and skin-tone suggestions, silicone material guidance, fitting prompts, and longevity forecasts.
- Clinician presets persist review cadence, material defaults, and naturalness preferences within manufacturer guardrails.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

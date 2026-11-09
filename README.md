# Stuttgart

Finance, fleet and operations app. Monorepo (npm workspaces + Turborepo):

| Path | What |
|---|---|
| `apps/web` | Next.js app (the UI). Sign-in stays on Firebase Auth. |
| `apps/server` | NestJS API + Prisma + PostgreSQL. |
| `packages/shared` | Code both use: Zod schemas, money/VAT helpers, roles. Built to `dist/`. |

The app is **moving from Firestore to PostgreSQL**. During the move every
feature ("slice") can run on either, chosen by a flag — see [Data sources](#data-sources).

## Getting started

```bash
npm install
docker compose up -d                                   # Postgres on localhost:5433
npm run migrate:firestore -w @stuttgart/server -- --reset   # local copy of Firestore
npm run dev                                            # web :3000, server :4000, shared in watch mode
```

Env files (not committed): `apps/web/.env.local` (Firebase web config,
`NEXT_PUBLIC_API_URL`) and `apps/server/.env` (`DATABASE_URL`, Firebase admin
credentials, `WEB_ORIGIN`).

## Data sources

`NEXT_PUBLIC_API_FEATURES` in `apps/web/.env.local` decides which slices use the
API (local Postgres) instead of Firestore:

```bash
NEXT_PUBLIC_API_FEATURES=lookups,identity   # those slices on the API
NEXT_PUBLIC_API_FEATURES=all                # everything on the API
# unset                                     # everything on Firestore (= production today)
```

Slices: `lookups` (settings lists, vehicles), `identity` (profile, users,
companies, audit log), `ledger` (accounts, transactions, clients, invoices,
payments, suppliers), `inventory` (spare parts), `vat-reports` (VAT payments,
custom reports). Restart `npm run dev` after changing it.

In development a small banner (bottom right) shows which slices run where.

## Developing safely — read this

**1. Firestore mode on your machine writes to the real Firebase project.**
`apps/web` has one Firebase project, so any slice left on Firestore reads and
**writes production data** when you test locally. The banner turns red when
that's the case. To avoid it, use the emulators or a separate Firebase project:

- *Emulators* (needs Java 21+ and `npm i -g firebase-tools`):
  ```bash
  firebase emulators:start --project demo-stuttgart     # Firestore :8080, Auth :9099, UI :4001
  ```
  then add to `apps/web/.env.local`:
  `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1` and
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-stuttgart`. For the server, add
  `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` to `apps/server/.env`; for the
  migration script, run it with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`.
  Create a user in the emulator UI and a matching `users/{uid}` doc.
- *Separate project:* create a Firebase project for development and point the
  `NEXT_PUBLIC_FIREBASE_*` (web) and `FIREBASE_*` (server) variables at it.

Creating or removing users in the **identity** slice always talks to Firebase
Auth (the server creates the sign-in) — on the real project unless you use one
of the options above.

**2. Mixed modes drift apart.** With e.g. `ledger` on the API and `vat-reports`
on Firestore, new payments land in Postgres while the VAT page reads Firestore.
That's expected. Refresh the local copy whenever it gets confusing:
`npm run migrate:firestore -w @stuttgart/server -- --reset` (localhost only).

**3. Never set `NEXT_PUBLIC_API_FEATURES` in production before the cutover.**
A production build with it set is refused (`VERCEL_ENV=production` or
`APP_ENV=production`) unless `STUTTGART_CUTOVER=1` is also set — the cutover
itself (Phase 7) is the only time to use that.

**4. In Firestore mode, "loading" means `data === undefined`.** The
`lib/data/*` hooks feed TanStack Query from `onSnapshot` with the query
disabled, so `isLoading` stays false; treat `data === undefined` as loading.

## Tests and checks

```bash
npm run build                                  # all packages
npm run lint                                   # Biome (web), oxlint (server), tsc (shared)
npm run test:e2e -w @stuttgart/server          # 40 API tests against a throwaway DB (stuttgart_e2e)
npm run migrate:firestore -w @stuttgart/server -- --dry-run   # Firestore → Postgres check, no writes
npm run migrate:selftest -w @stuttgart/server  # migration steps against fake data (needs a *_test DB)
```

## Notes for contributors

- Components never call Firestore or the API directly: they use `lib/data/<slice>`
  (or the hooks/stores built on it), which pick the data source from the flag.
- Server writes are one SQL transaction each, with the audit entry inside it;
  balances only change through `apps/server/src/modules/ledger/ledger.primitives.ts`.
- Files that use TanStack Table start with `"use no memo"`: the React Compiler
  otherwise keeps showing stale rows when the data changes.

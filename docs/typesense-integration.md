# Typesense public club discovery — first integration slice

Typesense is an **optional search index**, not a replacement for Supabase/PostgreSQL.
Only public club directory fields are indexed, and the existing public directory
remains the source of truth for visibility, events, recruitment availability,
permissions and club detail pages.

## Configuration

Provision your own secured Typesense Cloud or self-hosted instance first.

Set these **server-only** environment variables (never `NEXT_PUBLIC_`):

- `TYPESENSE_URL` — HTTPS origin of the Typesense server.
- `TYPESENSE_SEARCH_KEY` — `documents:search`-only key restricted to
  `outclass_public_clubs_v1`. Used in a Next server action.
- `TYPESENSE_ADMIN_KEY` — operator-only key with collection create/read,
  document import/export/delete permissions, used only during reindexing.
  **Do not configure this key in Vercel runtime environments.**

Use an isolated staging collection/cluster while validating production rollout.
No credentials, database migrations, or external resources are provisioned by
this pull request.

## Backfill

From an authorized operator environment with an existing working Prisma
`DATABASE_URL` and the admin key:

`node scripts/sync-typesense-public-clubs.cjs`

The script creates the versioned collection if missing, imports only
discoverable and unsuspended clubs with these fields: id, name, category,
tagline and description. It verifies per-document import results and removes
IDs no longer present in the authoritative public directory.

It must be scheduled/repeated after club publication edits and withdrawal.
Until a reliable change-driven sync/outbox is implemented, an operator must
rerun the script after relevant changes or on an approved recurring job.

## Search behavior

The existing Discover UI still loads authoritative public directory data
and continues to apply client-side recruitment/time/acceptance filters.
For queries of at least two characters, it *optionally* uses Typesense for
typo-tolerant matching and ranks matches by relevance.

Only Typesense IDs that exist in the current authoritative public directory
can render, preventing search-index staleness from disclosing withdrawn
clubs. No private records are ever sent to Typesense in this slice.

When the cluster is unconfigured, times out or errors, Discover falls back
to its current local matching behavior. Demo mode continues using fixtures.

## Limitations and next stage

This first slice improves discovery matching, **not** initial directory
download latency; it still fetches public club records and intersects IDs
before rendering. Measure search p50/p95, index lag and resource cost.

Before expanding into global search or recruitment, design a permission-scoped
index, identity-aware read paths, revocation behavior, and authenticated
regression tests. Never index applicant PII, interview notes or private
applications in the public collection, and never reuse the public search key
for restricted collections.

## Validation

Verify on a staging Typesense cluster with seeded discoverable and suspended
clubs: correct matches, typos, category filter, active/deactivated
publication, blank query, network outage, demo mode, index withdrawal and
stale-result rejection. Run `npm run typecheck`, `npm run lint`,
`npm run build`, and browser navigation tests before activating production.

# Postgres-owned tables — 2026-11-09

Task `DB-OWN-1`. Owner decision (2026-11-09): the migration operator owns every application table; the server role works through explicit grants and policies. Follows `migration-reconciliation-2026-11-09.md`, decision D1(b). **Not applied to production.**

## What changes

| | Before (production today) | After |
| --- | --- | --- |
| Tables owned by `outclass_production_app` | 79 of 86 (53 moved by hand, 26 by migrations) | 0 |
| How the server role reaches those 79 tables | As owner: row-level security does not apply to it | `SELECT, INSERT, UPDATE, DELETE` grants and one policy per table, `outclass_runtime_access` (`FOR ALL`, `USING (true)`) |
| Server role can alter, drop or truncate tables, change policies, triggers or ownership | Yes, on 79 tables | No |
| 36 deny-everyone policies (`RESTRICTIVE … TO PUBLIC USING (false)`) | Passed only because the server role was the owner | Scoped to `anon, authenticated`; same expression |
| 43 tables with no deny policy | An accidental browser grant plus permissive policy would expose rows | New `outclass_browser_deny` (`RESTRICTIVE … TO anon, authenticated USING (false)`) |
| Six voting tables with narrower explicit access | `SELECT/INSERT(/UPDATE)` only | Unchanged |
| Browser roles | No privileges on any table | Unchanged |
| `_prisma_migrations` | Owned by `postgres`, closed to the server role | Unchanged |

The server role's row access is the same as before: every row of the 79 tables. This change removes its power over structure and policies. It does not add per-row restrictions; authorization stays in server actions.

One trade-off: the 36 deny policies used to apply to every role. They now name the two browser roles. A migration named earlier than this one but merged later could still hand a table to the server role; the new test fails if any table ends up unreachable, but it does not detect that case. Any other role still needs both a grant and a permissive policy to see a row, so nothing opens, but a future role is no longer denied by those policies automatically.

## Migration

`prisma/migrations/20261110090000_postgres_owned_tables`: one transaction, catalog changes only, no row read or written. Per table: transfer ownership to the operator, grant, create the policy, rescope deny policies. It then checks itself and aborts if the server role still owns a table, is a member of the owner, lacks a privilege, or is still subject to any restrictive policy. The new owner is the role that runs the migration (`postgres` through the migrations workflow). Without the server role it does nothing. Safe to repeat.

Locks: `ACCESS EXCLUSIVE` on each of the 79 tables, held until commit so the change is all-or-nothing. Each lock waits at most 2 s and the whole migration at most 15 s. While it runs, requests that touch an already locked table wait, so the worst case is a stall of up to 15 s; a deadlock with a running request aborts one side. On a timeout or deadlock nothing changes (rehearsed: a session reading `Club` made it fail in 2 s with ownership and policies untouched, and it succeeded once the session ended). A failed attempt through Prisma leaves a `P3009` ledger row that needs `prisma migrate resolve --rolled-back 20261110090000_postgres_owned_tables` (owner approval) before a retry. Apply in a quiet period.

Fixtures: the six disposable-database scripts no longer hand every table to the server role after migrating, so CI's native suites now run under this model. Three native tests that asserted server-role ownership now assert the opposite.

## Evidence (disposable PostgreSQL 16 in the session container)

| Check | Result |
| --- | --- |
| Full replay as a **non-superuser** `postgres` with `BYPASSRLS`, as in production | 75/75 applied (74 on main plus this one) |
| Production-shaped database (79 tables owned by the server role) and fresh database after the migration | identical ownership, grants and policies |
| As the server role: read every table; update, delete and row-lock probes on the 79; insert/update/read/delete round trip across `User`, `Club`, `ClubMember`, `PipelineRound`, `Application` | pass |
| As the server role: disable RLS, drop, truncate, add column, create/drop policy, take ownership, drop trigger, read the ledger | all refused |
| `anon`, `authenticated` | denied, including with an accidental grant plus permissive policy |
| Query plans for index use with non-leakproof operators, before vs after | identical |
| First draft granted before transferring ownership | **failed in rehearsal**: the server role ended with no privileges. Order fixed; the migration now aborts on this condition |
| Native suites on the final migration, run directly against the local database (fixtures no longer re-own tables) | security/concurrency 11/11; recipient audiences 16/16; communication schedules 18/18; decision publication 16/16; contention 14/14. One run made while the full unit suite was also running failed 9 timing-dependent subtests with no permission error; the same suites passed on an idle machine. Decision transactions (earlier draft): 45 pass, 3 fail on `git show` of commits missing from this shallow clone |
| Three older tests that rehearse historical repair migrations | pinned to migrations before this one, since they assert the ownership of their time |
| `tests/postgres-owned-tables.test.cjs` (PGlite: production-shaped, fresh, no server role). Asserts 36 rescoped and 43 new browser-deny policies, accidental browser grants on `User` and `Application` return no rows, and that every table stays reachable after any later migration | 3/3 |
| Reviewers | migration-reviewer: 2 high (lock window; later migrations forgetting the model), 4 medium, all addressed except a fixed table list in the rollback script (documented instead). authz-reviewer: no weakening; 2 medium addressed |
| Emergency rollback script, then migration re-applied | pass |

Not verified: sign-up through `handle_new_user` (lives outside the ledger; it is owned by `postgres`, which bypasses RLS), PostgreSQL 17, a restored production copy, the authenticated E2E stack, real Supabase Auth/Storage/Realtime, contention benchmarks, production load while locks are taken. CI on the PR runs the Docker-based native and E2E jobs.

## Rollout (each step needs owner approval)

1. CI green on the PR, including the disposable-integration jobs.
2. Rehearse on a restored production copy (PostgreSQL 17): apply, run `scripts/db/schema-fingerprint.sql`, sign in and exercise one student and one leader journey against it.
3. Dry run of the migrations workflow from the PR branch.
4. Apply in a quiet period. Deploy order does not matter: the application code is unchanged.
5. Verify (below). Watch runtime errors for `42501` for an hour.

```sql
SELECT pg_get_userbyid(c.relowner) AS owner, count(*)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relkind = 'r' GROUP BY 1;                                   -- expect postgres 86
SELECT count(*) FROM pg_policies
WHERE schemaname = 'public' AND policyname = 'outclass_runtime_access';  -- expect 79
SELECT pg_has_role('outclass_production_app', 'postgres', 'MEMBER');     -- expect false
```

## Rollback

`scripts/db/rollback-postgres-owned-tables.sql` gives the 79 tables back to the server role. Ownership bypasses row-level security, so server access returns at once. It is not a migration and needs owner approval. The forward migration can be applied again afterwards (rehearsed).

## After this

New tables: created by migrations as today (operator-owned, RLS on), with explicit server-role grants and policies. Do not add `OWNER TO outclass_production_app` to a migration again.

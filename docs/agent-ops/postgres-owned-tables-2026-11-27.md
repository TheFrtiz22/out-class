# Postgres-owned tables, second version (2026-11-27)

Task `DB-OWN-2`, fix 1 of the 2026-11-26 database security check. Replaces `DB-OWN-1` (PR #200, written on 2026-11-09 for 86 tables and never applied). **Not applied to production.** It is ordered after `20261127000000_profile_storage_server_only` (PR #714).

## What changes

Production on 2026-11-26 (read-only catalog queries, PostgreSQL 17.6): 96 tables in `public`, all with row-level security on and none forced.

| | Before | After |
| --- | --- | --- |
| Tables owned by `outclass_production_app` | 79 | 0 |
| How the server role reaches those tables | As owner: row-level security does not apply to it | `SELECT, INSERT, UPDATE, DELETE` grants and one policy per table, `outclass_runtime_access` (`FOR ALL`, `USING (true)`) |
| Server role can alter, drop or truncate tables, or change policies, triggers or ownership | Yes, on those tables | No |
| Deny-everyone policies on those tables (`RESTRICTIVE … TO PUBLIC USING (false)`, 36 today) | Passed only because the server role was the owner | Scoped to `anon, authenticated`; same expression |
| Those tables without a deny policy | An accidental browser grant plus permissive policy would expose rows | New `outclass_browser_deny` (`RESTRICTIVE … TO anon, authenticated USING (false)`) |
| 16 tables already owned by `postgres`, each with its own `<table>_runtime_<command>` policies and matching narrower grants (including the six voting tables) | | Not locked, not changed |
| `_prisma_migrations` and its two deny policies | Owned by `postgres`, closed to the server role | Unchanged |
| Functions (owner, `SECURITY DEFINER`, `EXECUTE`), default privileges, browser-role grants | | Unchanged |

The server role's row access is the same as before: every row of the tables it owned, and the narrower explicit access on the other 16. This change removes its power over structure and policies. It does not add per-row restrictions; authorization stays in server actions.

## How the migration decides

`prisma/migrations/20261127010000_postgres_owned_tables` reads the table list from the catalog when it runs. Nothing is counted or named in advance.

- A table that has a permissive policy naming the server role (other than `outclass_runtime_access`) and is not owned by it is already in the target model. It is skipped: no lock, no grant, no policy.
- Every other ordinary table in `public` except `_prisma_migrations` is moved to the operator if the server role owns it, then granted and given `outclass_runtime_access`. In production these are exactly the 79 owned tables. On a new installation they are the tables created before the per-table policies began, which is what lets the server role work there without owning anything.
- Sequences: none exist in production. Sequences behind a moved table's columns move with it, free-standing ones the server role owns are moved, and every sequence privilege it had is granted back.
- New owner: the role that runs the migration. It refuses to run as anyone but the owner of `_prisma_migrations`, so every table ends with one owner (`postgres` in production).

One transaction, `lock_timeout` 2 s, `statement_timeout` 15 s, catalog changes only. A second run changes nothing and takes no table lock. Without the server role it does nothing.

It aborts, changing nothing, if:

- the server role would lose any `SELECT`, `INSERT`, `UPDATE` or `DELETE` it had on a table, or any sequence privilege (compared against a snapshot taken at the start);
- a restrictive policy would still apply to the server role on a table it reaches through `outclass_runtime_access` (by name, through `PUBLIC`, or through a role it is a member of), or row security is off there;
- the server role still owns a table, sequence or view, owns a function, or is a member of the new owner;
- the server role keeps `TRUNCATE`, `REFERENCES` or `TRIGGER` on any table;
- the server role cannot execute a function that a CHECK constraint or column default in `public` calls (this covers the grant from #714);
- a table is owned by the server role and also has its own server-role policies (not the case in production; it needs a decision by a person).

## What does not change, and why it is safe

- **Deny policies are rescoped by role, not rewritten.** A condition such as `current_user <> 'outclass_production_app'` would keep them on `PUBLIC` but put a security qualifier on every server query against 36 tables. Naming the browser roles leaves server query plans as they are. The trade-off: a future role is no longer denied by those policies automatically. It still needs both a grant and a permissive policy to see a row.
- **Foreign keys and cascades** run as the table owner. That was the server role or `postgres` depending on the table; it is now always `postgres`.
- **Trigger functions** are `SECURITY INVOKER` and run as the server role, which has the same row access as before. `handle_new_user` and `outclass_signal_inbox` are `SECURITY DEFINER`, owned by `postgres`, and are not touched.
- **Application code** issues no DDL, `TRUNCATE` or `LOCK TABLE` (`actions/`, `app/`, `lib/`, `utils/` searched).

## Migrations after this one

The Database migrations workflow connects with `MIGRATION_DATABASE_URL`. In production that is `postgres`: it owns the database and the ledger, has `CREATE` on `public`, and after this change owns every table, so later migrations alter tables as their owner. Before this change it altered the 79 tables only through its membership in the server role. The server role never needs DDL.

A migration that creates a table must, in the same file: enable row-level security, grant the server role only the commands it needs, and add one permissive policy per command for `outclass_production_app` (see `20261118120000_meeting_check_in_pass` for the pattern). Never write `OWNER TO outclass_production_app` again. `tests/postgres-owned-tables.test.cjs` fails if a migration from this one on hands a table to the server role or leaves a table the server role cannot reach.

## Locks

`ACCESS EXCLUSIVE` on each table it changes (79 in production), held until commit so the change is all-or-nothing. Each lock waits at most 2 s and the whole migration at most 15 s. While it runs, requests that touch an already locked table wait; the worst case is a stall of a few seconds followed by failure with nothing changed. A deadlock with a running request aborts one side. A failed attempt through Prisma leaves a `P3009` ledger row that needs `prisma migrate resolve --rolled-back 20261127010000_postgres_owned_tables` (owner approval) before a retry. Apply in a quiet period.

## Rollback

`scripts/db/rollback-postgres-owned-tables.sql` gives every table carrying `outclass_runtime_access` back to the server role. Ownership bypasses row-level security, so server access returns at once. It is not a migration and needs owner approval. The forward migration can be run again afterwards. Checked read-only in production: `postgres` can act as the server role and can grant the temporary schema `CREATE` the transfer needs.

## Verify after applying

```sql
SELECT pg_get_userbyid(c.relowner) AS owner, count(*)
FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
GROUP BY 1;                                              -- one row: postgres
SELECT count(*) FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
  AND (has_table_privilege('outclass_production_app', c.oid, 'TRUNCATE')
    OR has_table_privilege('outclass_production_app', c.oid, 'TRIGGER')
    OR has_table_privilege('outclass_production_app', c.oid, 'REFERENCES'));          -- 0
SELECT c.relname FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relname <> '_prisma_migrations'
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polpermissive
                  AND 'outclass_production_app'::regrole::oid = ANY (p.polroles));    -- no rows
SELECT has_schema_privilege('outclass_production_app', 'public', 'CREATE'),
       pg_has_role('outclass_production_app', 'postgres', 'MEMBER');                  -- false, false
```

Then re-run the Supabase security advisor, and watch runtime errors for `42501` for an hour.

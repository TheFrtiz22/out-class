# Existing staging reconciliation — October 5, 2026

Scope: only `omfcozcbpmevwolshibh` (`outclass-staging`). Production `htlgjluegmdwfjkzzwic` is excluded. The user authorized resuming this existing project without paid changes, then preserving its legacy tables while rehearsing additive reconciliation.

The resumed project has 14 `public.oc_*` tables, 35 public RPC functions, an `oc_private` schema, two legacy profiles, and no Prisma migration ledger or `public."User"`. A normal `prisma migrate deploy` correctly stopped with P3005. No reset, archive replay, or speculative history registration was attempted.

The installation-specific plan is:

1. Retain a private custom-format backup of the existing public schema/data and a schema-only backup of public/oc_private. Record legacy table counts and server-computed content hashes without exporting private contents into the report.
2. Restore the schema-only backup into a new local native PostgreSQL database. Local Auth functions/identity-table prerequisites are placeholders for restoring foreign keys/policies; this is not a hosted Auth rehearsal.
3. Execute the unchanged `20260923000000_baseline/migration.sql` on this copy. Its 14 application tables and enums have distinct names from the legacy `oc_*` objects. Compare installed columns, defaults, constraints and indexes to a separate fresh reference database. Only then register this **actually executed** baseline with Prisma. Apply the other 24 migrations with Prisma migrate deploy. This rehearsal passed without changing the legacy objects.
4. Repeat the verified baseline installation on the named staging project, using a temporary staging-only login and explicitly assuming the existing postgres deployment role. Verify the baseline against the reference and all legacy content hashes before registering just this executed baseline. Stop on any mismatch. Deploy the remaining migrations through Prisma. Never register unexecuted migrations or infer Prisma history from the archived Supabase timestamps.
5. Verify ledger checksums, application RLS/browser-role denial, immutable evidence/score triggers, private Storage policies and unchanged legacy counts/hashes. The additive installation does not migrate legacy `oc_*` identities, clubs or applications into Prisma models; those remain separate and untouched. Synthetic test fixtures must use the current models.

Private backups and encrypted credentials are outside Git in the Windows account's local staging-verification directory. They are not production backups. No production release follows automatically from this staging reconciliation.

Status and final evidence are recorded in the release handoff; this plan does not authorize production reconciliation or deployment.

Completed: the additive installation and post-cleanup verification passed with 25 matching migrations, 47 private current application tables, and unchanged hashes/counts for all 14 legacy tables. The staging-only runtime role was removed after hosted HTTP tests; table ownership returned to postgres. See interview-release-handoff.md for passing evidence and remaining browser/preview gates.

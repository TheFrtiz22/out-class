# Eight-migration connector release package

This is preparation only. No production migration, deployment, credential rotation,
role provisioning or main merge is authorized by this package. Preserve the
compatible serving application until all eight migrations have verified successfully.

## Build from the reviewed final commit

```sh
python3 scripts/build-workspace-migration-package.py --source HEAD --ledger-json /tmp/outclass-current-main-live-ledger.json --output /tmp/outclass-current-main-release-package
OUTCLASS_PACKAGE_TEST_PYTHON=/tmp/outclass-production-readonly-probe/venv/bin/python sh scripts/test-workspace-migration-package.sh /tmp/outclass-current-main-release-package
```

The Python override selects the existing local psycopg environment; any Python with
psycopg installed works. The test runner creates a dedicated disposable PostgreSQL 17
container on **127.0.0.1:58442**. It loads no application environment/hosted credentials.
An existing container/package directory is never replaced. Preserve earlier evidence.

Builder resolves the full source SHA and reads **committed Git bytes**, never working
copies. It rejects existing-migration rewrites and anything other than the exact eight
pending migrations against main `23b1ec16332c1bf943df95b57c4f050c4d345659` (43 migrations).
The required `--ledger-json` is a fresh read-only connector snapshot containing project_id,
database/operator, completed ledger rows and bounded-role attributes. The builder
rejects missing/extra/incomplete or checksum-changed history before emitting payloads;
review any discrepancy for genuinely pending prerequisites rather than assuming eight.
The October 14 inspection matches all 43 current-main migrations; exactly eight remain.
`manifest.json` contains source SHA, project, live-snapshot SHA256, baseline ledger checksums, original SQL
SHA256 and adapted payload SHA256. `.source.sql` files are byte-identical to Git.
`.connector.sql` and `.tool.json` are the concrete execution package. Temporary
packages, logs and synthetic fixture data remain outside the repository.

## Supported execution and guards

Use the already validated authenticated Supabase **execute_sql** connector bound to
project **htlgjluegmdwfjkzzwic**, with each `.tool.json` as one complete call, in the
manifest order. Do not split statements, use apply_migration, resolve/mark-applied,
change source SQL, or write a second Supabase migration ledger. Operator credentials
remain unavailable; no credential retrieval or rotation is needed for this method.

Immediately before a separately authorized release:

1. Reconfirm the reviewed PR source equals `manifest.source`, main/serving code is
   compatible, the connector targets the named project, and backup/recovery controls
   are ready. Do not infer project identity from database name `postgres` alone.
2. Execute `preflight.sql` read-only through that connector. Require database/operator
   `postgres`, ledger count 43, mismatches zero, inherited bounded-owner access true,
   runtime schema CREATE false. Review every ledger name/checksum against the manifest.
3. Verify local source/payload SHA256 against `manifest.json`. Execute each complete
   `.tool.json` payload **once**, in order. Stop on any error; inspect the ledger
   read-only before deciding which *next* payload is valid. Never rerun committed DDL
   or manually fix history. Each payload expects the exact cumulative prior ledger.
4. Execute `postflight.sql` read-only: require count 51 and zero mismatches. Inspect
   ownership/restrictive policies/browser denial on RecipientGroup/Entry,
   ScheduledCommunication and RecruitmentCycle; legacy Admin deadlines and existing
   communications must remain intact. The payload itself checks ownership, restrictive
   false policies, browser CRUD privileges and unchanged runtime schema CREATE before
   recording success. Verify application runtime access through authorized paths.
5. Only afterward consider code/cron activation through the separately approved release.
   Keep outbound email disabled. New code before migrations can fail on absent tables,
   columns, constraints and nullable elevation support. Do not activate it early.

Every payload retains the migration's BEGIN/COMMIT and all source statements exactly.
Adapter guards run inside that transaction, acquire Prisma 6's advisory lock
**72707369** and exclusively lock `_prisma_migrations`, then require the precise prior
ledger (names, count, completed state, no rolled-back entries and accepted checksums).
Only four independently verified historical LF/CRLF equivalents are accepted. New
migration checksums always hash the **original committed SQL**, not wrapper SQL.

After source SQL and security assertions succeed, the same transaction inserts a
truthful UUID ledger entry with original checksum/name, actual start/finish timestamps,
null logs/rollback and one completed migration step. Any SQL, assertion or ledger
failure rolls back both schema and history. Previously successful migrations remain
committed if a later payload fails; resume requires the matching next cumulative
baseline. Replays and altered/missing/unexpected history fail closed. This is an
operator execution adapter, not a claim that recording history alone applies SQL.

Read-only production checks reconfirmed: 43 completed migrations, four known CRLF
ledger equivalents, database/operator postgres, non-superuser connector operator,
existing inherited outclass_production_app ownership access, schema creation and ledger
access for the operator. The runtime is NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE/
NOREPLICATION without schema CREATE. DecisionLetter remains owned by that role with
restrictive RLS and no FORCE RLS. No owner-role privileges/passwords are changed.

## Local validation

`test-workspace-migration-package.py` deploys the actual 43-migration baseline with
Prisma, including the four historical CRLF files, and uses a non-superuser operator
inheriting the same bounded owner role. Populated notifications, pending outbox,
preferences, immutable letters, membership and legacy Admin expiry are snapshotted.
For **each of eight payloads**, it injects source and ledger failures, verifies schema,
data/history and temporary schema privileges roll back, rejects checksum drift,
executes the exact payload, checks truthful history, rejects replay, and verifies data
preservation. This also tests interruption/resumption at every intermediate baseline.
Finally actual Prisma migrate status accepts all 51 entries and migrate deploy is a
history-preserving no-op. Actual runtime connection reads/writes and browser denial
are checked. Complete fresh-history and populated Prisma upgrade validation also run
through `scripts/test-decision-publication-local.cjs`.

The hosted connector's multi-statement transaction behavior was validated during the
original decision-letter release. This pass reuses that method and tests these exact
new payloads locally; it does **not** send DDL or ledger writes to production. Connection
secrets, SQL credentials and recovery files are absent from the package.

## Ordered committed SQL checksums

| Migration | SHA256 of original SQL |
|---|---|
| `20261012171752_admin_session_bound_elevation` | `29c2dc1b5e8e70071306f42aacb674ac2eaccf62f31254aa0a6aa289b73f2b89` |
| `20261013002253_recipient_audiences` | `8c0fa6bb35605e857bc86bef3205af1a5a4d6e7d3a07a4fc79c951a4de391cdf` |
| `20261013005624_scheduled_communications` | `9bc4432d1f26a35e7b48ec919c518cf34c4cbde9f6d4628285c6e9bd853830c2` |
| `20261013014837_decision_letter_controls` | `3552b5ad8609b4b7ea8a9510d72ed4b7ccfbbc0ece467d12a003bbb5162fd537` |
| `20261013014950_recruitment_cycles` | `983adc3d11ef0d4101000f85a8c6280365f9fb3357361c59ee2fa7c347bd72fa` |
| `20261013015200_scheduled_decisions` | `48e0aed7ed90734d230cbf4864b9c6fda14d89d704ca27fbe821d0a80c1137d8` |
| `20261013140024_scheduled_invitation_emails` | `e05e4e7ccd8b687b77db595aee10d81d008ab65076336a78987c50c0170eac14` |
| `20261013141510_scheduled_availability_requests` | `422b8d687830881d9eb8d7c2e517e9b18ca524516369d041b86cef0739a5ec66` |

# Ordinary session replay and expiry — October 19, 2026

Implementation baseline: `bbef8db`. **Local application changes only; production is unchanged.** No Auth setting, database migration, grant, credential or deployment was changed.

## Verified defect and change

Captured ordinary-session cookies were replayed through the real account API and profile Server Action on the reserved local Next/Auth/PostgreSQL fixture. Global logout, local logout, actual emailed password recovery, account disablement and malformed cookies already denied those requests. Local logout preserved a second device's access, and a fresh sign-in after recovery worked. These results narrow the original M6 hypothesis: this provider version did not reproduce logout/recovery replay.

The verified gap was the provider session's `not_after` deadline. After moving only that synthetic session's deadline into the past, its still-unexpired JWT passed Auth `getUser`, read the account (HTTP 200) and changed its profile. This is consistent with Supabase's documented enforcement on refresh, rather than a provider defect. [Before results](before.json) and [failing baseline run](before.txt) preserve the reproduction; the two reported failures are the expiry subtest and its parent.

`utils/auth.ts` now obtains a candidate access token from `getSession`, verifies that **exact token** with `getUser(token)`, and then checks `auth.sessions` for its UUID session ID, matching verified user ID, and a null or future `not_after`. `lib/auth-session.ts` extracts the claim only after that verification and binds it to the verified subject. Cookie session/user data alone is never accepted as identity. A missing/expired row denies access; a database failure propagates as an operational failure without falling back to JWT-only access.

The shared `getSessionUser` boundary applies this check to application authentication/bootstrap callers as well as `requireAuth`, avoiding a stale signed-in redirect on public entry pages. React request caching coalesces verification/checks within one request; it does not reuse an identity between requests. Existing fresh disabled-account and club-membership checks remain. Admin/support session locks and their stronger elevation requirements remain intact.

## Verification

| Captured credential condition | Before account / profile write | After account / profile write |
|---|---|---|
| Global logout | 401 / denied | 401 / denied |
| Local logout | 401 / denied | 401 / denied; other device works |
| Password recovery | 401 / denied | 401 / denied; fresh sign-in works |
| Disabled account | 401 / denied | 401 / denied |
| Expired `not_after`, unexpired JWT | **200 / accepted** | **401 / denied** |
| Malformed cookie | 401 / denied | 401 / denied |

Each replay uses a fresh copy of the captured cookies, so a preceding response clearing cookies cannot make a later mutation assertion pass. Denied reads require private/no-store headers and an authentication status rather than a server error. Complete profile/experience records are compared before and after each attempted write. Provider acceptance in the JSON is diagnostic on the original token; for the malformed-cookie case that original token remains valid, while the actual HTTP cookie is corrupted.

**37 real integration tests passed, zero failures/skips**, including eight cases counted with this suite's parent, all prior onboarding/account/signup tests and restricted-role SQL/Storage tests. **1,242 default tests passed, 34 fixture-gated skips, zero failures.** [Final integration output](e2e.txt), [default suite](tests.txt), [after results](after.json), [validation manifest](validation.json). Actual Next production build, typecheck and lint passed (26 existing warnings, zero errors). Fixture-gated skips are separate from real integration passes.

Five focused session tests cover invalid/foreign claims, exact-token verification ordering, refresh/provider failures, request-only caching, live-row denial, database failures and fresh disabled status. Existing auth-dependent test doubles now supply candidate sessions and live-row results; their permission, isolation and upload assertions remain. The runtime-role test still checks two complete forward/inverse cycles, then reapplies the candidate for the following replay suite. The whole reserved stack is removed afterward.

The first full unit run exposed 19 failures in three older harnesses missing the SDK `getSession` method ([initial output](initial-tests.txt)). Those mocks were updated to supply the same session/live-row model as the other auth tests. Their 32 focused checks then passed, followed by the complete 1,242-pass run. No production logic was weakened or failing assertions removed to accommodate them. The other 61 focused auth/session checks also passed: [focused output](focused.txt), [legacy harness output](legacy-focused.txt).

Reproduce using Node 24:

```sh
npx --yes --package=node@24 -- node scripts/run-onboarding-e2e.cjs --runtime-role
```

This uses only the reserved `outclass-onboarding-e2e` project, local SMTP and synthetic identities. The web application connects as the restricted role; operator access is used only for setup and deliberate fixture revocation/expiry. Existing user stacks are preserved. Temporary credential configuration and TLS key/certificate files were removed and port 3107 released after the run.

## Measured cost and limits

Before: no ordinary live-session SQL query. After: **one SQL statement per valid authenticated request**, with **one Auth user verification call retained**. A real SDK/restricted-Prisma probe calls the getter twice within a simulated request and observes one SQL statement and one provider request. Its native EXPLAIN uses an existing `sessions_user_id_idx` index and reports 0.014 ms execution on the small local fixture. That is a single database execution observation, excluding connection/network/pool costs; it is not a production latency, cost or page-speed claim. No index or cross-request private cache was added.

This enforces row existence and `not_after` at request admission. It does not cancel an already authorized in-flight operation, implement provider inactivity/single-session policy outside that column, or revoke previously issued Storage signed URLs. Provider endpoints, fictional demo access and independent invitation/recovery capabilities have their own boundaries. This is not a blanket claim about every token consumer. No production session replay or provider-version-equivalence test was performed; local Postgres is 17.11 versus the previously inspected production 17.6.

## Release and rollback gates

Every authenticated request now needs SELECT on `auth.sessions(id,user_id,not_after)` under its effective runtime identity. The [review-only runtime-role proposal](../runtime-role/README.md) already supplies those exact columns and passed this local run. The existing bounded role's live catalog lacked them; a credential-only cutover or a release without confirming the actual role's grants can break sign-in. Verify the effective runtime connection and hosted provider/operator compatibility before release. Do not broaden Auth privileges or bind an operator credential to hide a permission failure.

A separate cutover blocker was found by source review: `app/api/auth/student-claim/route.ts` reads `auth.users`, including its invitation-token predicate. The proposed bounded role deliberately cannot read that table. This legacy path was not exercised by the 37-case run. Preserve the denial and refactor/test that capability through a provider-supported flow before credential cutover; do not add a general Auth-user/token grant. Remaining worker/support/scheduling coverage and credential/operator gates still apply.

Release requires a reviewed compatible artifact and the audit's explicit production permissions/credential/deployment approval. No approval was requested or inferred here. Roll back the application patch independently if a regression requires it, retaining earlier unrelated fixes. Such a rollback restores the demonstrated session-deadline gap and must be recorded. If runtime-role SQL/bindings are also changed in a later approved release, follow their separate tested inverse order: restore compatible binding/artifact before removing grants. Do not silently rotate credentials or remove the live-session check to accommodate an unverified runtime role.

Primary source: [Supabase session guidance](https://supabase.com/docs/guides/auth/sessions), reviewed against the installed Auth/SSR clients. Supabase documents that JWTs may outlive logout, deadline/inactivity checks occur on refresh, and stricter application authorization can check the session record. The observed logout behavior here remains explicitly version/fixture scoped.

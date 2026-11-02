# Voting room navigation ? November 1, 2026

## Scope and routes

Recruiting ? Decisions now contains Overview, Voting room and Decision letters. Scheduled decisions and legacy voting history remain available under their existing permissions. Old workspace `tool=voting` and `tool=letters` links normalize to the corresponding Decisions tab, retaining query context. Dedicated room and QR URLs remain compatible.

The Voting room landing reuses live session actions and the isolated Demo adapter. Leaders see Start/Resume; eligible members see Join/Rejoin; ended sessions expose an authorized summary. Lists return safe round/cycle labels, applicant counts, state, last activity and the caller?s entry role, never applicant identities or ballot choices. Backend membership, eligibility, club scope, anonymous policy and current access checks remain authoritative.

Applicants offers an authorized checkbox-selection shortcut to the same setup. Stable IDs are stored in tab-local session storage bound to user, club and Demo scope; the URL contains only an opaque selection key. A read-only server action revalidates the selection and groups compatible cycle/round scopes. Stale selections are explained; mixed scopes require an explicit choice. Navigation creates nothing. Explicit creation retains its existing UUID/body across retries and locks until navigation succeeds. The created draft still requires the existing leader preview/start action before voting opens.

Back to Decisions preserves the authoritative session club/cycle/round. Leaving does not end voting. Tab navigation uses the existing pending-save/unsaved-work guard. Letter preparation and explicit publication remain separate; navigation sends no communications.

## Validation

- 28 foundation/setup/Demo/navigation tests passed; Demo resolution/list reads make zero live calls or snapshot writes.
- New four unit regressions and two real-component browser workflows cover authorization, safe projections, selected/stale/mixed scopes, no creation on navigation, single explicit creation, return/resume, member-only entry, reload, Back/Forward and list failure/retry.
- Existing meeting/transition browser checks passed, including pending-command revision locking, privacy, reduced motion, Undo and stationary controls. Existing club-action workflows passed. Fixture list hydration was corrected to honor the same current-member participant filter as Prisma.
- Type checking and production build passed. Build used a disconnected loopback database, not production. Static generation logged its expected unavailable database read but completed successfully.
- Changed-file lint passed after removing an unnecessary checkbox-label click handler; repository warnings remain pre-existing.
- Local desktop/mobile screenshots are synthetic real-component fixtures, not hosted full-shell acceptance.

## Integrated validation update

Current main greeting work (#107/#108) was preserved. Integrated CI passed 13/14 jobs; validation exposed an old navigation expectation and two fixtures missing the newly required router boundary. Those fixture-only corrections retain the original review/authorization assertions; all 33 affected tests passed locally. An additional shortcut regression checks the actual Applicants handler, stable selection storage, no write on navigation and denial to review-only users. Final protected validation remains required.

## Release gate

No schema, dependency, database configuration or migration changes. Protected CI, merge, matching automatic Vercel deployment and authenticated synthetic production entry-point checks are pending. Do not infer hosted verification from local fixtures. Physical touch hardware is unavailable. Record actual release evidence after deployment; preserve earlier implementation evidence under its original revision.

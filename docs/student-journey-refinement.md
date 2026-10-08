# Student journey refinement

Implemented October 7–8, 2026 using the supplied reel review. The referenced
`docs/outclass-reel-review.md` is absent from this checkout; the attached review
was used. This change builds on the existing landing refinement.

## Experience

- Discover retains search, categories, reported acceptance/fund-size/time filters,
  featured clubs, saved clubs, and profile entry. The campus illustration/header,
  covers, and mobile toolbar are more compact. The available-application shortlist
  is expandable rather than another full section preceding the directory.
- Recruitment filters show all clubs, open applications, and deadlines within
  seven days. Deadline sorting puts open, published deadlines first. Search/filter
  counts reflect the current search and other filters. Deadline sorting bypasses
  the default featured introduction so the first results follow the chosen order.
  Filter values survive refresh in the URL, and clearing filters removes those values
  while retaining workspace context. Categories use relevant existing Lucide icons.
- Shared recruitment presentation shows actual published deadlines in Eastern Time,
  distinguishes expired/unavailable/unclaimed/unknown states, and prevents a cached
  open flag from advertising a passed deadline. Unknown dates do not imply urgency.
- Cards retain club-owned imagery, names, descriptions, saving, and disclosure;
  they now include recruitment state, deadline, and time commitment when supplied.
- Club profiles lead with identity, recruitment facts, and a consistent action.
  New applicants start Applications; existing drafts continue there; submitted
  applications open unified Status. Requirements, directory provenance, meetings,
  member workspace links, subscriptions, and all marketing sections remain.
  Back links distinguish Discover, Saved clubs, and the public club entry. The
  public/QR club entry also retains unified Status and shared-profile navigation.
- Applications show real database deadlines as well as sample deadlines. Draft
  progress counts valid required responses using the same validation rules as
  submission; there is a direct action to the next response needing attention.
  Mobile save/submit controls wrap within the viewport above the bottom navigation.
- Shared student labels are Draft, Submitted, In review, Interview, Accepted,
  Not selected, and Waitlisted. Database enums, custom round names, archived
  submitted questions, and legacy internal tracker values are unchanged.
- Status remains one place for review, interviews, and decisions. Its timeline
  distinguishes earlier pipeline positions and the recorded current round from
  future context, without asserting every earlier round occurred. Drafts never
  mark recruitment stages as completed. Submitted responses remain accessible.
- Booking preserves dates, rooms, timezone selection, booking/rescheduling,
  cancellation confirmation, and server conflict checks. Selected times show the
  date and timezone before confirmation. Past bookings are labeled as recorded
  interviews; an invitation with no available slots has useful feedback.

Explore / Apply / My Clubs and the existing navigation architecture remain intact.
Existing design tokens, Caslon display typography, UVA illustrations, navy/orange
branding, progress components, badges, buttons, and reduced-motion support are reused.

## Architecture

No schema migration, new dependency, or authentication/authorization change.
Directory metadata continues to come from its existing explicit public projection.
Its deadline serialization now accepts the strings returned by Next's JSON cache,
fixing directory failures after a cache hit.
Drafts, submissions, attachments, bookings, and permissions retain existing server
validation. Demo projections now supply deadline/open fields in the same shape as
live applications; Demo Mode remains isolated from real server operations.

## Verification

- `npm run test`: 845 tests, 838 passed, seven environment-dependent skips,
  zero failures. New tests cover recruitment boundaries, filtering/sorting, URL
  round trips, required-response validation/readiness, terminology/custom rounds,
  Eastern Time daylight-saving behavior, cached deadline serialization, and public club navigation.
- Typecheck and production build passed. Lint passed with zero errors and 25
  existing warnings outside changed code.
- Real authenticated Chrome journey at 1440×900 and 390×844 against a dedicated
  local Supabase/Postgres project: search/filter/sort → refresh → club profile →
  validation → save/reload draft → submission → unified Status → invitation →
  book/reload/reschedule → Calendar. Answers, status, and bookings were checked
  directly in the disposable database. A fixture update issues the interview
  invitation; student saves/submission/booking use real UI and server actions.
- Screenshots were reviewed at each stage. Narrow-screen and automated
  accessibility checks at 1280×720, 390×844, and 320×740 passed with no horizontal
  overflow and zero axe WCAG A/AA violations on Discover, Applications, and Status.
  These checks include reduced motion and existing-application profile → Status
  navigation. Low-contrast student mode/category/filter labels and interview
  guidance were corrected with existing foreground tokens.

The browser runner `scripts/verify-student-journey-browser.cjs` validates its local
project/hosts/ports before creating any fixture. It provisions a fresh local
student per run so earlier test bookings cannot create artificial conflicts.
Screenshots/results and a permission-restricted local session file go under the
OS temporary directory's `outclass-student-journey` folder.

To repeat with optional external Playwright/Chrome tooling:

1. `node scripts/prepare-profile-e2e.cjs`
2. `node scripts/run-profile-local.cjs build`
3. `node scripts/run-profile-local.cjs start`
4. In another terminal, set `OUTCLASS_PLAYWRIGHT_MODULE` to the installed Playwright
   module path and run `node scripts/verify-student-journey-browser.cjs`.

Do not run a production build over the same directory as an active development
server. No production records were modified and no deployment was performed.

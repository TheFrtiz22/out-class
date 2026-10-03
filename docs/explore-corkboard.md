# Explore and Corkboard — Prompt 35

## Consolidation

There is one student Explore view (`components/views/explore-view.tsx`) and one Corkboard view (`components/views/corkboard-view.tsx`). Explore retains the existing directory's search, category counts/chips, optional filters, sorting, curated clubs, available clubs, public events, profile rendering, and application handoff. The old Categories-only branch and unused split navigation map were removed; reusable directory components and data remain.

Canonical destinations are `/?workspace=student&view=explore` and `/?workspace=student&view=corkboard` (the embedded preview uses `/preview`). Existing `discover`, `discovery`, and `categories` view bookmarks resolve to Explore and replace the URL. Existing tracker and membership section scopes are retained. Desktop navigation, global search, member navigation, and mobile navigation share the new destination names. Phones and tablets expose Home, Explore, Corkboard, Apply, and More; the More sheet retains Calendar, My Clubs, and other destinations.

## Persistence and ownership

`CorkboardClub` references existing users and clubs, with a composite owner/club primary key, save timestamp, cascade foreign keys, and club index. Migration `20261003020000_corkboard` enables RLS and denies browser-role CRUD. Authenticated server actions derive ownership from the session, reject forged payloads, reuse the directory's public-only projection, and use idempotent upsert/delete operations. No private recruiting data is added to saved profiles. Applications, subscriptions, memberships, and voting are independent of saves.

The shared Corkboard provider loads from `workspace-api`, optimistically adds/removes items, prevents duplicate pending writes, ignores stale reads, and rolls back failed mutations. It refreshes after writes, on window focus/pageshow, and on explicit Refresh. Another device sees the server state on load/refocus/refresh; there is no realtime channel or polling. Switching accounts immediately hides the previous account's data.

Corkboard intentionally saves clubs. Public events/opportunities remain available in the same linked club profiles. It does not create a competing event or club directory. Existing device-local subscriptions retain their separate meaning.

## Demo and tutorials

The existing Demo Mode adapter stores deterministic club saves only in the demo store and never invokes live Corkboard actions. Reset restores two saved clubs. Older saved demo states gain the field without resetting other data. Save/remove, reload, and profile navigation use the same UI components as live mode.

The student tutorial keeps its eight indices and progress schema version. Explore replaces old browsing terminology; the existing Corkboard step now describes real functionality. Existing users do not restart tutorials.

## Verification

- Focused persistence, provider, navigation, and Demo Mode tests: 36 passed.
- Full suite: 423 tests, 421 passed, two existing skipped tests, zero failures.
- Migration verification: fresh and legacy paths, all 20 migrations; all 43 tables deny browser-role CRUD with RLS enabled.
- Actual rendered pages in an isolated local demo fixture: Explore/Corkboard at 1440, 768, 390, and 320 pixels, no horizontal overflow; Corkboard cards remain readable at narrow widths. Pointer save/removal, reload persistence, shared profile navigation, old bookmark redirection, and the mobile More sheet pass. Production authentication was not bypassed or modified.
- TypeScript, production build, and `git diff --check` are run separately from tests.

The migration has not been applied to a remote database. Live hosted authentication/database behavior requires the normal deployment migration and environment; database restart persistence, uniqueness, foreign keys, and access restrictions are verified locally with PGlite, and server ownership contracts with the existing test harness.

## Changed files

- `actions/club-directory.ts`
- `app/layout.tsx`
- `components/app-shell.tsx`
- `components/club-workspace.tsx`
- `components/clubs/club-discovery.css`
- `components/clubs/club-profile-editor.tsx`
- `components/clubs/corkboard-button.tsx`
- `components/clubs/discovery-card.tsx`
- `components/clubs/explore-directory.css`
- `components/dashboard-layout.tsx`
- `components/landing/product-stories.tsx`
- `components/personal-clubs.tsx`
- `components/product/design-patterns.tsx`
- `components/qr/public-club-page.tsx`
- `components/shell/mobile-navigation.tsx`
- `components/shell/navigation.tsx`
- `components/shell/product-shell.tsx`
- `components/views/application-tracker-view.tsx`
- `components/views/club-profile-view.tsx`
- `components/views/corkboard-view.tsx`
- `components/views/discover-view.tsx`
- `components/views/explore-view.tsx`
- `components/views/student-dashboard-view.tsx`
- `contexts/corkboard-context.tsx`
- `docs/demo-mode.md`
- `docs/discovery-club-profiles.md`
- `docs/explore-corkboard.md`
- `docs/support-impersonation-tutorials.md`
- `lib/application-state.tsx`
- `lib/corkboard.ts`
- `lib/demo/seed.ts`
- `lib/demo/store.ts`
- `lib/demo/validate.ts`
- `lib/product-navigation.ts`
- `lib/student-home.ts`
- `lib/student-navigation.ts`
- `lib/tutorials.ts`
- `lib/views.ts`
- `lib/workspace-api.ts`
- `prisma/migrations/20261003020000_corkboard/migration.sql`
- `prisma/schema.prisma`
- `tests/club-workspace.test.cjs`
- `tests/corkboard.test.cjs`
- `tests/demo-mode.test.cjs`
- `tests/explore-corkboard-ui.test.cjs`
- `tests/student-home.test.cjs`
- `tests/workspace-navigation.test.cjs`

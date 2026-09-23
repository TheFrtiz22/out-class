# Interaction polish and command search

## Command palette

The shell's existing page finder now uses the installed cmdk primitives. Cmd/Ctrl + K opens or closes it; arrow keys browse, Enter selects, Escape dismisses. Header buttons remain available on desktop/mobile. The palette does not open over other dialogs and is absent from focused Interview/Voting Mode.

Navigation destinations remain unchanged. Signed-in users can search public clubs and their own applications. In the leader workspace, authorized presidents/recruitment leads can also find submitted applicants and recruitment rounds in their clubs. Applicant selection opens the existing detail drawer; round selection sets the existing round filter; application selection uses the existing application-focus handoff. Public club results open the existing `/club/[id]` route.

`actions/workspace-search.ts` authenticates every request and derives club access on the server. It excludes student drafts from leader results, selects minimal result fields, limits queries/results, and never accepts a client-supplied membership scope. Full names match across first and last name fields. The UI debounces queries, discards stale responses, clears results on close/account changes, provides loading/retry feedback, and retains page navigation during record-search failures. No private results enter localStorage. Preview users get page navigation only.

Unsaved application responses are guarded before in-app palette navigation; full-page club navigation retains the existing native unload warning. Record navigation is blocked while an application save is in progress.

## Shared interaction audit

- Buttons: immediate restrained pressed feedback; disabled/focus semantics retained. No spring/bounce animation.
- Links, selects, disclosure controls: clear focus outlines without layout movement.
- Tabs, dropdown/select items, table rows, command items: shared token-based color/background transitions.
- Inputs and textareas: consistent focus/border transitions.
- Sidebar, dialogs, status transitions, subscription controls, toasts, and save/submit flows: retain existing accessible state, confirmation, error, and persistence behavior rather than adding decorative movement or changing business logic.
- Loading: reusable accessible workspace skeletons replace text-only applicant/interview loading states; command results have their own restrained skeleton.
- Empty/error states: palette explains missing matches or sign-in requirements and offers retry. Existing application/profile/calendar/leader empty states and retry boundaries remain intact.
- Reduced motion overrides all new motion; no layout-driven animation, new dependency, or information-architecture change.

## Files

`components/shell/navigation-search.tsx`, `components/dashboard-layout.tsx`, and `actions/workspace-search.ts` implement command search. `lib/application-state.tsx` and the live leader workspace support scoped in-memory applicant/round handoff. `components/applications/application-form.tsx` exposes unsaved/saving state to navigation guards. `app/globals.css` provides shared interaction feedback. `components/workspace-loading.tsx` supplies reused skeletons. `tests/workspace-search.test.cjs` verifies authorization, bounded queries, and full-name search.

## Validation and boundaries

Build passes. Test suite: 62 pass, four existing club-customization fixture failures. Two existing nullable-context errors remain in `lib/club-customization.tsx`. Lint is unavailable because ESLint is not installed.

Browser checks with isolated server-action fixtures cover palette keyboard navigation, authorized applicant/round handoffs, modal isolation, mobile layout, failure/retry, Escape, and reduced motion. Actual search against configured Supabase/Postgres remains unverified locally. This is bounded text search, not a global fuzzy-search service; production indexing should follow measured query performance as data grows.

# OutClass contextual loading feedback — October 28, 2026

## Problem and goal

Blank content accompanied by plain “Loading applicants…” text looks frozen during the real, sometimes slow, guarded reads. Loading feedback must make it apparent that the intended destination is being prepared without pretending requests are complete, obscuring errors, or slowing the critical path.

## Implemented in this branch

- `components/ui/skeleton.tsx`: replace Tailwind's generic pulse with a quiet, continuous compositor-transform shimmer through `styles/interface-primitives.css`.
- `components/ui/loading-state.tsx`: shared visible status plus accessible screen-reader announcement and decorative placeholders. `rows`, `cards`, `applications`, `applicants`, `workspace`, and compact `inline` layouts. Responsive at mobile widths.
- `components/workspace-loading.tsx`: default workspace-shaped skeleton, while allowing more specific layouts.
- `styles/interface-primitives.css`: styling for stable header, segmented filters, list rows, application cards, pipeline steps and two-column workspace; reduced-motion and forced-colors treatments.
- Applicant pipelines, student applications, selected club tabs, club workspace, recruiting review filter, interview entry, screening rules and saved flags now use matching loaders.
- Personal clubs/activity, club membership, events, tasks, assigned rooms, interview kits, club profiles and scheduling also replace text-only waits with appropriate loaders.
- All new skeleton geometry is decorative (`aria-hidden`); an active loader has one `role=status` and one accessible label. Errors and retries remain separate alert states.

## Rules for any further conversions

1. Prefer a loader with the same shape and approximately the same occupied space as the destination: rows for tables/lists; applications for drafts; applicants for recruiting pipeline; workspace for complex panels.
2. Use a visible but understated status label only during an active request. Do not display a skeleton for success, empty, permission-denied, or failed reads. Keep visible existing data during background refresh when it is safe to do so.
3. Do **not** add artificial minimum waiting times, fake percentages, rotating “almost done” copy, hidden API calls, or hover-blocking fullscreen overlays. Actual latency is a separate performance problem.
4. For long operations with real milestones, use truthful phase-specific status (e.g. “Checking your access” → “Loading interview rooms”) only if those transitions genuinely occur.
5. Use one status region; keep skeletons aria-hidden. Use meaningful focus/keyboard outcomes after a request. Respect reduced motion and forced colors.
6. Don't animate the global page layout, width/height or shadows. Limit shimmering items to the visible loading viewport.
7. Keep existing code/data read ownership and auth boundaries. A loading animation should never delay navigation, overwrite saved drafts or suppress a real error.
8. Verify transitions at 1440x900, 1280x800, 768x1024, 390x844, 320px and 200% zoom. Test slow network, no network, retry, and quick responses without flashing or scroll jumping.

## Remaining audit

This branch covers high-traffic entry points and shared primitives, **not every possible async action**. Next, audit individual admin panels, meetings, voting, invitations, account forms, uploads and nested drawers for custom status paragraphs. Save/submit actions should use disabled controls and genuine busy feedback rather than replacing whole pages with skeletons. A follow-up can add a delayed mount for sub-150ms waits only if browser evidence demonstrates a visible flash; no delay is introduced here.

## Validation gate

Run `node --test tests/interface-primitives.test.cjs`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and browser screenshots under throttled network. Do not merge until CI completes and any errors are resolved. No performance gains are claimed by these purely presentational changes.

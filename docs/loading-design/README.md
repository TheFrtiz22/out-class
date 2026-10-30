# Quiet loading feedback

PR #99 was merged on October 29, 2026 (`77eb7af3`). This change starts from `bc22b0a3`, the `main` inspected at the start of the October 30 work. Main subsequently advanced to `7456c4c7` (#102); that voting-control change was also inspected and has no overlapping implementation files. The glowing pill lived in `components/ui/glowing-loading-pill.tsx`, with styles in `styles/loading.css`; `styles/interface-primitives.css` owns shared control geometry.

## Choice

[Browser comparison of three alternatives](evidence/study/alternatives.png): A, the open arc, is easiest to read at 14–16px, with less visual density than the offset segments or radial spokes. It uses the existing native Regular Phosphor CircleNotch from `@/components/icons`. Motion is a constant one-second rotation on the wrapper. No glow, container, border, new dependency, timer, or additional request.

- **Pages and workspaces:** retain the existing contextual skeletons; announce one hidden loading label and remove the separate visible status row.
- **Sections and authorization checks:** transparent 16px indicator beside the existing concise status. Authorization text remains conditional on the existing verification state.
- **Actions:** a 14px indicator centered in the existing button. Its original text and icons remain in layout and in the accessible name, with opacity zero while busy, so dimensions do not change. Existing disabled conditions, handlers, refs, and focus behavior remain intact.
- **Refreshes:** existing authorized content stays mounted; the refresh action shows activity in place.
- **Autosave and notifications:** reuse the same indicator, retaining their existing live-region ownership. Toasts preserve their existing 20px icon size.
- **Skeleton motion:** one slow, token-colored sheen per preview instead of a separate animated layer on every block. Reduced motion stops rotation and removes the sheen. Forced colors removes the sheen and retains system-color placeholder outlines.

The branded entry screen remains separate from contextual loading. Request, authentication, permission, data, error, and completion logic is unchanged.

## Browser evidence

The browser audit visits the actual app with authenticated synthetic local accounts. Playwright holds real workspace reads/server actions until the screenshot is captured, then releases them and verifies the placeholder disappears. It also checks refresh preservation, pending button dimensions, member-dialog failure recovery, reduced motion, and forced colors. No artificial delay or bypass is added to product code.

Each viewport has loading and loaded screenshots for applicant pipeline, student applications, recruiting overview, application settings, member directory, interview workspace, and a formal decision letter. Viewport widths: **1440, 1280, 768, 390**. Screenshots use 900px viewport height and capture the full page.

- [Before evidence and measurements](evidence/before/results.json)
- [After evidence and measurements](evidence/after/results.json)
- [Validation results](VALIDATION.md)
- Comparison sheets: [1440px](evidence/comparison-1440.jpg), [1280px](evidence/comparison-1280.jpg), [768px](evidence/comparison-768.jpg), [390px](evidence/comparison-390.jpg)
- Pending actions: [refresh](evidence/after/refresh-1440-pending.jpg), [member dialog on mobile](evidence/after/member-dialog-390-pending.jpg), [reduced motion and forced colors](evidence/after/refresh-390-reduced-forced.jpg)

The interview comparison exposed a pre-existing schedule-list placeholder for a three-column room. The final interview placeholder now reserves the room header, candidate panel, questions, and notes at the same 1024px column breakpoint. The fixture has no private PDF resume; its existing unavailable-resume message remains visible after loading.

## Reproduce locally

Use the existing reserved `outclass-dashboards-e2e` synthetic fixture; these scripts reject other database/app targets through `readConfig`. They never load application `.env` credentials.

```sh
node scripts/prepare-loading-design-fixture.cjs
node scripts/serve-visual-unification.cjs build
node scripts/serve-visual-unification.cjs start 3116
# In another terminal:
node scripts/check-loading-design.cjs after
```

For comparison, build unchanged `bc22b0a3` in a separate checkout, run its app at reserved port 3115, then run this checkout's audit with `LOADING_PORT=3115 node scripts/check-loading-design.cjs before`. Do not build into a directory currently being served. `LOADING_ONLY=actions` or a comma-separated list of screen names, and `LOADING_WIDTHS=1440,390`, can target a follow-up check.

The fixture helper adds one synthetic waitlist letter and records only its application ID in the local fixture file. Existing fictional applications, memberships, and permissions are preserved. Screenshots and audit results contain no session credentials.

# Public site cleanup (PUBLIC-SITE-1), evidence

Branch `ui/public-site-cleanup` from `origin/main` 8ffe7722. Everything here was produced signed out, in a
fresh browser context per page, against local production builds (`next build` + `next start`) and a
disposable loopback Postgres seeded from `docs/club-profile-design` (38 clubs; 33 claimed). No hosted
service, credential or production data was used.

| Folder / file | What it is |
|---|---|
| `before/` | `origin/main`: every page in scope at 1440 and 390 (`<page>-<width>.jpg`), reduced motion and forced colors for `/`, `/club/[id]`, `/login`; `report.json` (status, title, headings, axe, sizes, overflow). |
| `phase1/` … `phase4/` | The same audit after each phase (subset of pages where only some changed). |
| `after/` | Final audit of all 22 page variants. |
| `vitals-before.json`, `vitals-after.json` (Phase 4), `vitals-final.json` | LCP / CLS / INP / first content; see `performance.md`. |
| `keyboard.json` | Keyboard-only run (header menu, audience toggle, sign in, sign up). |
| `content-fix-dry-run-local-fixture.json` | Review-format output of `scripts/clean-public-club-profiles.cjs` on the local fixture (what a production dry run produces for review). |

Re-run:

```bash
OUTCLASS_CHROMIUM=/opt/pw-browsers/chromium OUTCLASS_AUDIT_URL=http://127.0.0.1:<port> OUTCLASS_AUDIT_OUT=docs/public-site/after node scripts/public-site-audit.cjs
```

```bash
OUTCLASS_CHROMIUM=/opt/pw-browsers/chromium OUTCLASS_AUDIT_URL=http://127.0.0.1:<port> node scripts/public-site-keyboard.cjs
```

## Final audit summary (`after/report.json`)
- 22 page variants × 1440 and 390: 0 axe violations (WCAG 2.2 AA tag set).
- Forced colors (`/`, `/club/[id]`, `/login`): axe reports `color-contrast` on all three (before: on `/` and
  `/login`). Computed styles in that mode are black text on white for every flagged node (checked in
  Chromium), so these are axe false positives from authored gradients, not real contrast failures.
- One `h1` in server HTML on every page, except the `/q/<unknown>` 404 whose body renders after hydration
  inside the focus frame (the 404 status and title are correct).
- No horizontal overflow at 390. No visible text below 12px. Body copy on phones ≥ 14px.
- Tap targets: all ≥ 44px tall except the visually hidden "Skip to content" link in the focus frame and an
  existing 16px checkbox (with a clickable label) in the shared Corkboard filter.
- Unique titles in the form "<Page> · OutClass"; og:image on every page; `/q/<unknown>` and unknown paths return 404.

## Owner decisions applied after review (2026-11-07)
Club leaders remain the default homepage audience; Explore stays private; employer logos are hidden
(not deleted); Privacy and Terms are formal legal text kept off the public site (404 until
`LEGAL_PAGES_PUBLIC`). Screenshots in `before/` … `phase4/` show the intermediate states (students as the
default, public Explore, plain-language legal pages); `after/` is the final state.

## Known gaps
- WebKit/Safari not run (not installed in the container).
- Signed-in pages were not rendered (no Supabase Auth here); signed-in Explore, club pages for members and
  the accept-invitation flow after sign-in are covered by the existing unit and env-gated E2E tests only.
- Performance numbers are lab measurements on a local server, not field data.

# Interview résumé viewer

> October 5 audit update: [Current audit repairs and release handoff](interview-audit-fixes.md) supersedes the stage migration counts, missing setup integration and anonymous-review exclusions below.

This stage extends the existing application/round document and annotation actions. It adds no schema or migration and does not deploy anything.

## Format support and dependencies

Uploads already require a validated PDF signature and a maximum size of 10 MB. Text PDFs use Mozilla PDF.js **6.4.299**, pinned in `package.json`/`pnpm-lock.yaml`. The viewer renders a canvas and a selectable text layer; the browser iframe is used only for the small thumbnail. The full viewer and PDF.js load when the résumé overlay opens. One page renders at a time, with page navigation and 50–200% zoom. Canvas rasterization is capped at 12 million pixels.

PDF.js is Apache-2.0; the adapted text-layer CSS retains attribution. Its release requires Node 22.13+ or 24+. The repository now requires Node 22.13+. The optional Node canvas dependency has its own MIT license/native binaries; server anchor validation uses PDF.js's Node-compatible entry point. Preserve the package's license notices, including font and codec notices, when distributing generated assets. See [Mozilla setup documentation](https://mozilla.github.io/pdf.js/getting_started/) and the installed package LICENSE.

`scripts/copy-pdfjs-assets.cjs` copies the matching worker, CMaps, fonts, codecs, color profiles and license into ignored `public/pdfjs/`. `postinstall`, `predev` and `prebuild` generate them. Deployments must include that generated directory and allow same-origin module workers and local assets under their CSP. No CDN, external viewer or OCR service receives a document. Only library files and fictional demo PDFs are public.

Scanned/image-only pages render safely but explicitly disable text highlighting. General notes and freshly authorized download remain available. Encrypted/damaged/unsupported PDFs show a clear text-viewing failure and retain general notes/download. There is no password collection or OCR. External URLs and non-PDF legacy references cannot be securely version-pinned by the existing backend; the panel explains that an authorized private PDF upload is required. They are never fetched, publicly exposed or passed to another viewer. There are no annotations for a missing document version.

## Interaction and access

The existing Radix dialog supplies modal semantics, focus trapping, Escape and focus return to the thumbnail. Explicit Minimize to questions and Close controls preserve the separately mounted question draft. Desktop puts comments beside the PDF. Mobile has Document/Panel comments buttons, a right-edge General résumé notes icon with a visible label, and contained scrolling.

Select actual PDF text and choose Comment on selection. A keyboard/touch alternative finds a unique exact phrase on the current page. Repeated matches require more context or direct selection. Highlights store page, UTF-16 text offsets, exact quote, prefix/suffix and page-relative rectangles; rendering also checks text anchors against the pinned page. Geometry scales with zoom. Server writes verify quote/context/offset/page against the immutable database PDF, and normalized rectangles must remain within page bounds. They are never resolved against the student's current upload.

Comments show their original author and render as plain text. Server-projected `canEdit` controls editing/deletion; the backend independently authorizes every operation. Only the author or an explicit president/vice-president moderator can modify a comment. Moderation preserves author identity, restricted revision evidence and append-only metadata audit. General panel responses contain no deleted/original moderation content. Existing round anonymity, applicant exclusion, current membership and assignment checks still apply after an interview ends.

Interview management also has a Résumé moderation tab for explicit presidents/vice-presidents. Its narrowly projected queue lists up to 100 newest preserved documents, including past rounds, and excludes the moderator's own application, other clubs, drafts and documents forbidden by either current or recorded round anonymity. It needs no panel assignment and returns no question notes, annotation evidence, storage paths or PDF bytes. Ordinary board/admin members do not receive it. Opening a row still reauthorizes the document and annotations.

Shared annotations refresh every five seconds while visible, and on focus/visibility return or explicit refresh. A local comment draft retains its original revision while refreshed shared rows change. Conflicts preserve entered text, display the latest content and require an explicit revision review before retry. New comments keep a stable creation UUID across retries. Each mutation affects one row; peers' comments are never submitted as a replacement collection. Access failure removes annotations and the rendered document, aborts thumbnail loading and revokes its object URL. Retry rechecks current access. The enforceable boundary cannot recall bytes someone already downloaded.

Document requests use `/api/interview-resumes` with application/round/document IDs, private/no-store responses and authorization on every fetch/range. No storage paths or signed storage URLs reach this viewer. Instead of refreshing an expiring five-minute link, open/download/refresh reauthorize against the same pinned document ID. Downloads fetch fresh authorized bytes, then create a short-lived local blob URL. Viewer cleanup destroys the worker and aborts document loading.

The viewer's lazy-load error boundary supplies a fresh-chunk retry without reloading the surrounding question workspace. Server anchor extraction uses local CMaps/fonts, has an eight-second asynchronous deadline, runs outside database locks and rechecks authorization inside the subsequent write transaction. Deployment tracing explicitly includes its Node worker and text resources.

## Demo and verification

Demo adapters only use local persisted state and bundled fictional PDFs. The image-only fixture is `public/demo/sample-scanned-resume.pdf`. Demo anchors must match the known fixture; image-only documents reject invented text. Storage events refresh other tabs, and the Web Locks API serializes demo annotation writes before rereading the latest local state. Browsers without Web Locks retain ordinary single-tab demo behavior; live concurrency always uses database revisions and transactions.

Automated checks cover pinned-PDF anchor validation, forged/context/page/bounds rejection, image-only pages, general notes, missing document IDs, applicant/outsider/cross-club/revoked access, explicit VP moderation, author attribution/audit privacy, geometry at different zooms, failed-save text/UUID retention and polling conflicts. Existing tests cover independent concurrent comments, stale edit/delete revisions, replacement uploads, anonymous reads, private download/range authorization, SQL history/immutability and demo isolation.

Local browser acceptance uses a temporary fixture route, removed afterward, without a database or real applicant documents. Checks include direct PDF text selection, exact-phrase keyboard entry, saved/reopened highlights, shared comments between two tabs, conflict draft retention, 100/150% geometry, mobile layouts, Escape/focus return and question-draft preservation. Live Supabase Auth/Storage with two separate authenticated panel accounts remains a staging acceptance prerequisite; mocked actions and local demo tabs do not establish that deployment integration.

The browser also verified image-only viewing/general notes and removal of the displayed PDF, thumbnail and shared comments after fixture grants were revoked, while retaining the question draft. There was no external OCR or real-document access. Temporary viewport changes were restored and the fixture/dev server removed/stopped.

The previous backend deployment gates still apply: reconcile Prisma migration history/drift, confirm private storage and the reviewed explicit office/panel grants, and validate deployment CSP/runtime/assets in verified disposable staging. No production migration, mutation or deployment is authorized by this stage.

## Changed files in this stage

| Area | Files |
| --- | --- |
| Viewer and entry points | `components/interview-resume-viewer.tsx`, `components/interview-resume-viewer.css`, `components/interview-resume-loader.tsx`, `components/interview-applicant-panel.tsx`, `components/interview-resume-moderation.tsx`, `components/interview-management-tabs.tsx` |
| Anchors and moderation reads | `lib/resume-anchors.ts`, `lib/resume-anchor-validation.ts`, `lib/interview-access.ts`, `actions/interview-resumes.ts`, `lib/workspace-api.ts` |
| Isolated demo | `lib/demo/interview-foundation.ts`, `lib/demo/resume-fixture.ts`, `lib/demo/store.ts`, `contexts/demo-context.tsx`, `public/demo/sample-scanned-resume.pdf` |
| Dependency/build assets | `package.json`, `pnpm-lock.yaml`, `scripts/copy-pdfjs-assets.cjs`, `next.config.mjs`, `.gitignore`, `eslint.config.mjs` |
| Tests and handoffs | `tests/resume-annotations.test.cjs`, `tests/resume-viewer-ui.test.cjs`, `tests/interview-foundation.test.cjs`, `tests/interview-foundation-demo.test.cjs`, `tests/helpers/interview-harness.cjs`, this document and follow-up links in the backend/question UI handoffs |

## Final check results

- `npm test`: 517 tests, **515 passed**, zero failures, two existing external-service integration skips.
- `npm run typecheck`: passed.
- `npm run lint`: passed, zero errors and 30 existing warnings; no new viewer warnings.
- `npm run build`: passed, including generated local viewer assets and server runtime tracing.
- `npm run test:migrations`: all 22 migrations passed on fresh/legacy disposable PGlite databases; all 47 tables enforce RLS and deny browser-role CRUD. No new migration was added in this stage.
- Desktop/390px mobile browser acceptance: passed with the isolated fictional text/image PDFs. Two separate live accounts, native PostgreSQL concurrency and actual hosted Auth/Storage remain staging verification prerequisites.

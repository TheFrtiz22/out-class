# Public landing redesign

## Scope and preserved boundaries

The relevant pre-change inspection covered the Next.js 15 App Router, the React 19 AppShell's view-based navigation, public routes, Supabase auth entry points, Prisma/Postgres integrations, existing primitives/tokens, and CSS/IntersectionObserver motion. The existing app was run before implementation. Production landing content was inspected alongside the supplied reference.

This change is limited to public landing components, their styles, licensed local imagery, and presentation-model tests. Routes, AppShell, authentication/session code, server actions, API handlers, Prisma schema, database records, authenticated views, and dependency manifests are unchanged. The existing logo is reused. The primary CTA opens the existing student onboarding wizard; student/club sign-in retain their existing callbacks. No waitlist endpoint is invented.

## Component architecture

- `components/views/landing-page-view.tsx`: composes public sections and retains signup/info dialogs.
- `components/landing/landing-navbar.tsx`: transparent fixed navigation; IntersectionObserver controls the scrolled surface; mobile disclosure supports Escape and returns focus.
- `components/landing/landing-hero.tsx` and `hero.css`: editorial composition, campus context, actual profile CTA, and hero-to-product transition.
- `components/landing/campus-backdrop.tsx`: responsive, high-priority local WebP image with reserved geometry. Source widths are 960px and 1592px (~106KB and ~256KB).
- `components/landing/recruitment-demo-data.ts`: fictional applicants and deterministic presentation stages. No production imports or persistence.
- `components/landing/recruitment-demo.tsx` and its stylesheet: stable-key cards, reviewers/votes, lane counts, and an approximately 20-second cycle. A 500ms clock changes phases rather than rendering every animation frame. It pauses offscreen, in hidden tabs, and on request. Reduced motion provides a useful static decision summary. A fixed accessible description avoids repeatedly announcing animation changes.
- `components/landing/process-timeline.tsx`: four linked steps using existing stagger/reveal primitives; vertical on mobile.
- `components/landing/product-stories.tsx`: retained profile, discovery, apply, tracking, and club stories, with alternating desktop composition and accessible existing Radix tabs for applicant, rubric, and interview previews.

Existing CSS motion, IntersectionObserver, Radix, Lucide, Georgia display typography, Geist functional typography, and design tokens are reused. No animation or other application dependency was added. Browser automation and formatting tools were installed only in a temporary directory.

## Photograph license

The locally served Rotunda photograph is by terren in Virginia, licensed CC BY 2.0. A visible footer credit links the source and license and notes adaptation. See `public/images/campus/README.md` for full provenance. The photograph is resized/converted, responsively cropped, and blended with CSS overlays; it is not an official endorsement.

## Verification

- Production build succeeds. Existing Next configuration skips type/lint validation during builds, so these were also run independently.
- TypeScript: four existing diagnostics, unchanged before/after: membership-role mismatch in `unified-student-profile-view.tsx`, missing `scheduleLocations` export in `application-state.tsx`, and two nullable-context errors in `club-customization.tsx`. No new diagnostics.
- Lint was attempted: the repository declares `eslint .`, but ESLint is not installed/configured. No new lint configuration was introduced in a landing redesign.
- Node tests: 17 passed / 21 total. All three added recruitment-demo tests pass. The same four pre-existing club-customization tests fail with missing fixture data; baseline was 14 passed / 18 total.
- Chromium: all requested widths (1440, 1280, 1024, 768, 390) inspected, no horizontal document overflow or landing client/hydration errors. Verified signup dialog, student and club auth entry screens, review/interview tabs, mobile menu/anchors, scrolled navbar, pause/replay, offscreen pause, and static reduced-motion behavior.
- Existing `/preview` student dashboard, profile, leader dashboard, and interview workspace render without client errors. Public club/check-in/voting/design-system routes return HTTP 200; unauthenticated `/api/users/me` returns the expected 401.

## Local preview and limits

Preview runs on `http://localhost:3000`. This machine initially had no Node runtime; a temporary official Node 22 runtime and pnpm were used without changing the dependency manifest or lockfile.

The checkout has no configured Supabase environment. The preview process uses explicit nonproduction placeholders (`http://127.0.0.1:54321`, with a non-secret placeholder key) solely to let auth screens render. No environment file was written. Real sign-in, email verification, account creation, database writes, application submission/editing, reviews, votes, and interview persistence cannot be validated against a live backend here. Screen smoke tests and isolated existing unit tests are not a claim of live end-to-end coverage. Supply the actual local environment configuration and restart the preview before testing persisted workflows.

Pre-existing type/test/lint issues, live-backend integration verification, and existing placeholder legal content remain outside this presentation change.

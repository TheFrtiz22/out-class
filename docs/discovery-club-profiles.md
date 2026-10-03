# Explore and club profiles

Prompt 35 consolidates the directory into Explore and adds persisted Corkboard saves. See [Explore and Corkboard](explore-corkboard.md) for the current architecture and verification. The verification below records the earlier directory implementation.

## What changed

- `components/views/explore-view.tsx`: prominent multi-keyword search; category browsing with actual counts; optional commitment, acceptance, and fund-size filters; alphabetical/reported-acceptance sorting; removable filters and clear-all; organization rows instead of a repeated card wall; explicit loading, unavailable, and empty states. Selection preserves filters and returns keyboard focus to the club.
- `components/views/club-profile-view.tsx`: professional organization identity, description, optional club-supplied banner, visible application/subscription controls, dates/events, published required questions, self-reported statistics, and supported leadership. Existing customization visibility and branding controls are retained for preview profiles. Database profiles are never overwritten by browser customization fixtures.
- `components/clubs/`: scoped styles, logo fallbacks without unnecessary missing-image requests, a reusable Applied → Review → Interview → Decision timeline, and a device-local subscription control.
- `lib/club-directory.ts`: pure filtering and status-to-timeline mapping. Drafts and unknown custom stages are not displayed as submitted applications.
- `actions/club-directory.ts`: a public-field-only Prisma directory/profile query and idempotent authenticated draft start. Existing answers/status are never reset; concurrent starts use an empty upsert update branch and session-derived identity.
- `app/club/[clubId]/page.tsx` and `components/qr/public-club-page.tsx`: preserve existing URLs, resolve persisted club IDs or slugs, retain clearly labeled sample profiles, and pass existing student data into the existing application/calendar workflow. Public signup/sign-in controls reuse current views.
- Small integration changes in `lib/application-state.tsx`, `lib/data.ts`, `lib/views.ts`, and `components/dashboard-layout.tsx`: preserve server application IDs on handoff, allow genuinely missing club facts, remove unsupported personalization copy, and avoid a duplicate page heading while viewing a club.

## Data honesty and boundaries

Prisma already models club identity, descriptions, logos/banners, category, acceptance rate, AUM, application questions, rounds, and public events. Those fields now power browsing and persisted club profiles. The directory query explicitly excludes applicants, member identities, emails, and evaluations. Only public events are selected.

There is no authoritative recruitment-window field or recommendation service. Accordingly, no fabricated “Recruiting now,” popularity, or personalized recommendations are shown. Existing curated flags may drive a section labeled “Curated selection,” never individualized recommendations. Unknown acceptance and commitment remain unknown; default discovery no longer silently excludes acceptance rates over 25%.

Club-entered figures are labeled as self-reported and unverified. Existing sample figures are separately labeled as illustrative. Leadership remains visible where the existing preview directory supports it; private database member identities are not newly published without a public-directory setting.

Subscriptions previously only toggled local component state. They now survive profile navigation/reloads in storage scoped to the current account/device, with explicit text that email updates are not available. There is still no backend subscription/delivery model, and no delivery promise is made.

The previous club-profile form discarded its text fields. It is replaced by a direct entry into the existing application workspace. Starting a persisted club application now creates or resumes its draft safely. The application editor, submission/review logic, authentication implementation, and schemas are not redesigned here; their existing integration gaps remain separate work. This is not a claim that all recruitment workflows are now fully persisted.

## Verification

- Production build passes; existing build configuration skips lint/type checking, so these were attempted separately.
- TypeScript: the same three pre-existing diagnostics (profile membership role mismatch and two nullable customization-context diagnostics); no new errors.
- Lint: unavailable because the existing `eslint .` script has no installed/configured ESLint.
- Node tests: 30 passing / 34 total; the same four pre-existing club-customization failures. All seven added discovery tests pass, including safe public selection and non-destructive draft starts.
- Browser: inspected discovery and club profiles at 1440, 1024, 768, and 390px with no horizontal overflow. Verified search, return-to-results state, subscription persistence, auth handoff, existing preview application handoff, and reduced motion. Test records were injected only into isolated browser responses; no database fixtures were created.
- The checkout lacks working Supabase/database configuration. Live database reads/writes and authentication cannot be certified locally; query and mutation contracts were tested with isolated mocks. The real directory displays an explicit retry state when the database is unavailable.

No new dependencies or database migrations were added.

## September 2026 profile editor

The workspace Settings screen now uses `ClubProfileEditor`: collapsible sections, section shortcuts, desktop live preview, full preview on all screen sizes, discard, dirty-navigation protection, and explicit publishing. `MarketingProfile` and `MarketingSections` are shared with the Discover detail view and public club route.

Clubs can publish identity, category, logo/cover, accent color, acceptance/AUM/member visibility, custom metrics, outcomes, accolades, member benefits, eligibility, commitment, dues, featured projects, a video link, gallery, FAQs, public contact/socials, and additional links. Empty sections are omitted. Existing recruitment/application flows stay in the public profile.

Publishing uses the existing `club.settings` permission and audited transaction. `Club.marketing` holds validated public JSON; core fields remain in existing columns. Apply `20260929000000_club_marketing` through the established Prisma migration process before deploying this version. Demo publishing uses the isolated demo store and is reflected by the demo directory. No live deployment or production database mutation is performed by this change.

Uploads are resized in the browser and stored as bounded raster data URLs (350 KB per image, up to eight images including logo and cover). HTTP(S) image URLs are also supported. Links reject executable protocols. This fits the existing 4 MB action limit without adding a storage service. Clubs with larger media libraries should use externally hosted image URLs.

Verification includes profile schema and URL/image validation, permission-gated publishing and audit, public-directory propagation and hidden statistics, an actual PostgreSQL-compatible migration round trip, and desktop/mobile editor interaction checks with an isolated local fixture.

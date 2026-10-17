# Club directory and profile design

The approved photo-led design is implemented in the existing Explore/Corkboard cards, public profile header and shared Appearance preview. Apply, save, navigation, recruitment availability and authorization still use their canonical controls.

## Presentation and data

- Responsive cards use 190px banners, overlapping club logos, larger names, prominent selectivity/fund/member statistics and up to six member destinations. Public profiles show every recorded destination and its context.
- Thirteen locally bundled employer marks improve explicitly recorded placements. Unrecognized names remain readable text tiles. A mark never adds a placement claim. `employer-marks.json` records source URLs and original image hashes. Source images remain unchanged; CSS whitespace cropping is a progressive enhancement.
- Search includes recorded employers and still combines with category/recruitment/acceptance filters.
- Optional marketing JSON fields: `bannerPosition` (0–100% x/y), `acceptanceNote`, `acceptanceSource`, `acceptanceApproximate`, `outcomesNote`. These fields have backward-compatible defaults and require no SQL migration. Leaders can edit them through Appearance.
- Missing rates show “Not disclosed” when acceptance display is enabled. VCG's 3% is explicitly Spring 2026. FBIF's ~3% is approximate, with no cohort specified. Eleven other researched profiles have no numeric club acceptance rate. VVF's McIntire-admission percentage is not a club admission rate.
- Photographs remain genuine club-source assets. Missing banners use a brand-color surface; no invented club photographs or employers are inserted.

## Reviewed Admin import

Admin → Clubs → Import researched club profiles is available for the current single-school installation. Select `profiles.json` from this directory and the prepared package's image files. The package contains the 13 Yes/Likely clubs, evidence, image assignments and public copy. Image files are in the previously delivered club research archive; they are intentionally not duplicated as 31 MB of repository content.

The UI previews each create/update before publication. It resolves exact slugs, verifies existing IDs/names/school and rejects suspended targets. An existing VVF is updated in place. Duplicate package slugs, path escapes and preassigned image URLs are rejected. Files are checked before any writes.

Every save/upload uses existing server actions with fresh Admin verification, transaction-time authorization, optimistic versions, private asset ownership validation and audit events. There is no SQL import or authorization shortcut. Newly created clubs stay hidden until their media assignment succeeds. All imported clubs have native applications closed and no deadline. No leader is appointed, no invitation is created and no email is sent.

The import is intentionally not one global transaction across uploads and clubs. It stops on an error. Earlier completed clubs remain; an interrupted new club can remain hidden, and unassigned uploaded assets may remain. Reselect the package to review current state before retrying. Do not replay a stale plan. Memberships, applications, letters and history are never deleted by this flow. No seed runs during build or startup.

## Verification

- Focused marketing, directory, import, Admin, asset and Corkboard checks: 43 passed.
- Full suite: 1,204 passed, 28 gated skips, zero failures. The final added employer-search assertion is also included in the separate 43 focused checks.
- TypeScript and production build passed.
- Migration regression runner: all 56 existing migrations passed fresh/legacy checks; 78 protected tables retain RLS/browser denial. This change adds no migration.
- Lint: zero errors, 28 existing warnings.
- Rendered real component fixtures at 1440px and 390px: 13 cards, no horizontal overflow, no broken images. Public profile fixtures passed at both widths. Original source photography and employer marks were used; this is isolated rendering evidence, not a hosted browser certification.
- Evidence: `/workspace/scratch/7ff1dba85fd4/club-design-verification/`; build/test logs `/tmp/club-*`.

## Live content progress (2026-10-17)

Admin browser actions created VCG (`vcg-uva`), discoverable with native applications closed. No leader was granted. SEED's attempted save returned to reauthentication and is not present in the subsequent read-only inventory. Remaining profile/image imports are not claimed complete.

Synthetic applicant booking was closed and suspended. Synthetic interview improvements was closed but its suspension is not yet confirmed. Scheduling Release QA was already suspended. The other synthetic clubs remain hidden, with remaining lifecycle work pending. No record was hard-deleted. AIF/MII were preserved. Browser access stopped responding during the next retirement action; read-only production inventory, rather than click submission, establishes the confirmed state above.

Code publication and live content import are separate steps. The design is not claimed deployed merely because this branch builds.

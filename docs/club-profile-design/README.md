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

Every save/upload uses existing server actions with fresh Admin verification, transaction-time authorization, optimistic versions, private asset ownership validation and audit events. There is no SQL import or authorization shortcut. Newly created clubs stay hidden until their media assignment succeeds. Newly created clubs have native applications closed and no deadline. Existing clubs retain their reviewed application-open setting and deadline. No leader is appointed, no invitation is created and no email is sent.

The import is intentionally not one global transaction across uploads and clubs. It stops on an error. Earlier completed clubs remain; an interrupted new club can remain hidden, and unassigned uploaded assets may remain. Reselect the package to review current state before retrying. Do not replay a stale plan. Memberships, applications, letters and history are never deleted by this flow. No seed runs during build or startup.

## Verification

- Focused marketing, directory, import, Admin, asset and Corkboard checks: 43 passed.
- Full suite: 1,204 passed, 28 gated skips, zero failures. The final added employer-search assertion is also included in the separate 43 focused checks.
- TypeScript and production build passed.
- Migration regression runner: all 56 existing migrations passed fresh/legacy checks; 78 protected tables retain RLS/browser denial. This change adds no migration.
- Lint: zero errors, 28 existing warnings.
- Rendered real component fixtures at 1440px and 390px: 13 cards, no horizontal overflow, no broken images. Public profile fixtures passed at both widths. Original source photography and employer marks were used; this is isolated rendering evidence, not a hosted browser certification.
- Evidence: `/workspace/scratch/7ff1dba85fd4/club-design-verification/`; build/test logs `/tmp/club-*`.

## Full Commerce expansion (2026-10-17)

`commerce-inventory.json` maps all 34 Commerce-related CIOs in McIntire’s official directory to prepared profiles. Common Cents, Profit with Purpose, Virginia Mergers & Acquisitions Group and UVA Credit and Restructuring Club bring the verified scope to 38. Governance representatives and the invitation-only honor society are outside this recruiting-club inventory. “McIntire Data Science & Analytics (MDSA)” has no verified current organization identity and is held for confirmation.

Use the original 13-row `profiles.json` and the additional 25-row `commerce-expansion.json` as separate reviewed imports. The 30-row package limit remains unchanged. Both packages use genuine source imagery; all 38 profiles have banner assignments and 22 have verified logo assignments. Where a club-specific photograph is unavailable, the documented McIntire campus image provides context without claiming to depict club members. `commerce-image-evidence.json` records the new source assets and hashes. The downloadable archive contains both batches and their shared image directory.

The directory now offers All clubs, Applications open, Not currently open, and Closing soon. Availability uses the canonical OutClass recruitment projection, including expiry and published intake requirements; it does not assert that external applications are closed. Filters combine with search/category settings and survive URL round trips. Mobile availability controls use a two-by-two grid.

`logoOnBrand` is a backward-compatible marketing option for original white/transparent logos. It changes the presentation background without altering the source artwork. Appearance, public profiles and directory cards retain the same option. No migration is needed.

See `commerce-expansion.md` for the exact implementation manifest, verification and remaining operational work.

## Live content checkpoint

The last independently verified inventory had six visible real clubs: AIF, MII, VVF, VCG, SEED and TAMID. All six synthetic clubs were hidden, application-closed and suspended, preserving their records and history. VCG/SEED/TAMID had native applications closed and no leadership grants. New photo uploads had failed; submitting a browser file-selection action was not counted as a successful upload.

The expanded 38-profile catalog is prepared, not claimed imported. Admin password/MFA freshness and the browser extension’s file access setting are needed to continue canonical uploads and saves. The connection recovered; Admin Clubs again showed six visible real clubs and six suspended synthetic clubs. MII has an open intake. The attempted workspace file path was not found by Chrome on the user’s Mac; files must first be downloaded/unpacked there. The older deployed import must not be used for existing clubs until this follow-up’s recruitment-preservation fix is installed. No live club writes were attempted in this expansion pass. PR #45 has since merged independently; a merged PR alone is not proof of the current serving artifact. The expansion is on a new branch from current main `342659796ea8e4d7fb089ff0a942334c34496740`.

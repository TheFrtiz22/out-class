# Complete Commerce catalog and recruitment availability

## Result

The prepared catalog now covers all 34 Commerce-related CIOs in McIntire’s official directory plus Common Cents, Profit with Purpose, Virginia Mergers & Acquisitions Group and UVA Credit and Restructuring Club: **38 verified organizations**. Inclusion no longer depends on a spring recruiting classification.

`commerce-inventory.json` maps every listed CIO to a profile key. The original 13 profiles remain in `profiles.json`; `commerce-expansion.json` supplies 25 additional profiles, including in-place enrichment of AIF and MII. The two batches preserve the existing 30-row import maximum. The verified inventory excludes student-government representatives and the invitation-only honor society. The previously mentioned “McIntire Data Science & Analytics (MDSA)” could not be verified as a current organization and is documented as unresolved rather than invented.

## Application availability

Explore offers All clubs, Applications open, Not currently open and Closing soon. The new non-open filter is the complement of canonical OutClass application availability: closed, expired or unpublished intake is not open. It combines with category/search and survives URL round trips. Counts are computed within the other selected filters. Mobile controls use a two-by-two grid.

Visible copy distinguishes OutClass application availability from recruitment through external club websites. No external application date is inferred from directory eligibility or an old “applications open” heading. The public directory query does not have a six-club limit: the six previously visible clubs reflected incomplete live content population.

## Sources, statistics and images

Every profile links to research sources. Unknown rates remain null; no prestige ranking or estimated acceptance rate is inserted. VCG’s 3% remains explicitly Spring 2026; FBIF’s ~3% remains approximate with an unspecified cohort. AIF, MII and Portico placements are selected documented destinations, not placement rates. Client names, sponsors, speakers and competition judges are not relabelled as placements. Conflicting or undated AUM figures are qualified instead of asserted as precise current balances.

All 38 profiles have banner assignments and 22 have verified logos. There are 55 unique assigned image files across the two packages. Actual club-source photographs are used where available. Otherwise, a documented McIntire campus photograph provides context without pretending to depict members. Historical affinity-group photographs have their dates/context recorded in evidence. Source images are unchanged. Image decoding, the 5 MiB per-asset bound, per-file hashes and archive integrity were checked.

The `logoOnBrand` marketing flag defaults to false, requires no migration and makes original white logos legible on the club’s brand color. The Appearance editor, directory logo and shared public profile honor the option.

The expanded archive retains its historical filename `outclass-spring-club-profiles.zip`; its README explicitly describes the full Commerce scope. It contains the two reviewed JSON batches, shared images, research inventory, image provenance and checksums. Archive SHA256: `1b2452ba8cb5f0203c79a42a35cd43d2696f2166f61e8bd6255d56dd85fcc213`.

## Existing infrastructure

Canonical fresh-Admin save/upload actions, optimistic versions, transaction-time authorization, private Storage references and audit attribution remain authoritative. This change adds no migration, server action, role, privilege, invitation or email producer. Imports keep newly created clubs’ applications closed, preserve existing recruitment settings/deadlines, appoint no leader and preserve existing memberships, accounts, applicants and history. No seeding occurs during build/startup.

## Integration and verification

PR #45 merged independently during this task. This follow-up branches from current main `342659796ea8e4d7fb089ff0a942334c34496740`; its changed paths had no textual overlap with main’s newer cleanup, branding, Demo or scheduler repair work. The exact manifest is `commerce-expansion-manifest.txt`.

Final focused checks passed: **32**, including source-package coverage, availability partitions/expiry/URL behavior, import preflight/version protection and preserving an existing open intake/deadline. TypeScript validation and the final production build passed after the preservation fix. Lint reported **zero errors, 26 existing warnings**; diff checks passed. The final production build includes the preservation change.

The integrated full suite passed **1,212 tests with 29 gated skips and zero failures** before the final open-intake preservation patch; the final 32 focused checks include that patch. Final-source CI remains required. This distinction prevents counting the earlier full run as verification of a later edit.

Initial parallel attempts were interrupted by memory pressure and missing/corrupt local Chrome files. Those attempts are not counted passing. A fresh extraction from the previously obtained official npm package restored the browser, with GPU disabled for this environment and normal multiple-context behavior retained. The two existing autosave browser tests then passed, followed by the integrated full-suite run at concurrency four. No source assertion or skip condition was weakened. Logs are in `/workspace/scratch/7ff1dba85fd4/commerce-verification/`.

## Live-content checkpoint and remaining work

The last independently verified live inventory contained AIF, MII, VVF, VCG, SEED and TAMID. All six synthetic clubs were hidden, application-closed and suspended without deleting history. New imagery had not saved successfully. The expanded catalog is **prepared, not claimed live**.

The browser connection recovered and Admin Clubs again confirmed six visible real clubs, six suspended synthetic clubs and MII’s open recruitment. The old importer unconditionally closed applications; this follow-up now preserves reviewed existing settings and deadlines, with an open-intake regression test. Do not run the older deployed importer against MII.

A file-chooser attempt using the workspace path returned “file or directory could not be found.” That path is not present on the user’s Mac. First download and unpack the archive on the Mac, then use the resulting actual local files. Browser-assisted upload also requires Chrome → Extensions → ChatGPT extension → Details → Allow access to file URLs, plus current OutClass Admin password/authenticator verification. Credentials stay in the browser. After the follow-up is deployed and the files/authentication are available, verify one successful private image upload, review both imports against current records, publish, and independently verify all visible clubs and media. AIF/MII/VVF must be updated in place, not recreated.

No live club writes, email sends, credentials/settings changes, main merge or production deployment were performed in this expansion pass. The existing production email disablement and five recovery files remain outside the changed scope. Final hosted rendering and import completion remain unverified.

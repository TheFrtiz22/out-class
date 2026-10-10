# Spring launch club profiles

Research checked October 9, 2026. Copy is concise original text. These are explicit disposable-local fixtures, not a production seed or a claim of partnership approval.

| Club | Sources | Factual coverage |
| --- | --- | --- |
| Enactus at UVA | https://www.enactusatuva.com/ ; https://www.enactusatuva.com/client-services ; https://www.enactusatuva.com/why-join-enactus | McIntire affiliation, pro-bono consulting, Charlottesville businesses, social entrepreneurship, consulting services and skill development. Logo reuses the repository asset. |
| Portico Impact Fund | https://www.porticoimpactfund.com/about ; https://www.porticoimpactfund.com/coverage-groups | Experiential finance education, socially responsible equity research, sector coverage, charitable giving. Logo sourced from the official site's Squarespace image CDN. |
| Common Cents at UVA | https://thecourseforum.com/club/ACAD/207/ ; https://lists.virginia.edu/sympa/lists/business/finance ; https://www.commoncents.org/ | UVA chapter existence and financial-literacy mission; broader budgeting, credit and investing education. The national site is linked by the UVA listing. No assertion that its current Penn events apply to UVA. Chapter logo comes from the UVA Presence CDN linked by the listing. |
| TAMID Group at UVA | https://www.uvatamid.org/what-we-offer | Education, consulting, investment research and fellowship opportunity. Logo from https://www.uvatamid.org/Images/TAMID-Logo.png. No guarantee of travel or internships. |

All profiles intentionally omit unverified officers, headshots, member counts, acceptance rates, GPA thresholds, AUM, performance, placement statistics, meeting cadence, current deadlines and dues. Recruitment remains the existing Club availability/deadline plus active pipeline; external application dates do not set native availability. People blocks remain empty until leaders configure verified content. Cover images remain editable; brand gradients provide a clean fallback without invented photography.

## Canonical data and local fixture

`Club.marketing` JSON holds ordered, optional structured sections alongside existing marketing fields. There is no new Club, marketing, participant or recruitment table. Admin and authorized leaders use the same profile schema and editor. Platform metadata stays Admin-only; membership/claims/invitations and suspension keep their existing workflows. Profiles resolve by canonical ID/slug, retain direct access for unlisted clubs and exclude suspended clubs, and use the canonical public Corkboard reader. Discover uses the same Club records.

Run only against the explicitly guarded disposable project:

```sh
node scripts/seed-spring-club-profiles-local.cjs /absolute/path/to/outclass-corkboard-e2e/config.json
```

The script rejects hosted URLs and ports other than the designated local project. It refuses ambiguous matches, reuses existing names/slugs, creates missing local rows through elevated Admin actions, and preserves recruiting configuration. Official logo downloads are normalized and uploaded through the authorized server action; database fields contain immutable references. Re-running reuses existing club-asset logos. It does not set `marketingApprovedAt` or create leaders.

## Club asset Storage

Migration: `prisma/migrations/20261009234601_private_club_assets/migration.sql`.

The private `club-assets` bucket accepts JPEG/PNG/WebP, maximum 5 MiB. Restrictive PUBLIC policies on objects and buckets deny browser access to this bucket even if an old permissive owner policy is present. The four named legacy owner/public policies are removed. Other buckets and application records are unchanged. When provider Storage is absent, the migration emits a notice; uploads remain fail-closed until its Storage block is reapplied after provisioning.

Server uploads require full elevated Admin authentication or `club.settings` with transaction-time active-user, active-membership, club scope and suspension checks. Locks retain revocation boundaries through the upload; Admin is checked again afterward. Image bytes are signature-checked and decoded with Sharp, bounded to 25 megapixels, rejected if animated/malformed, resized within 1600 pixels and re-encoded to WebP without source metadata. The client also optimizes uploads. The resulting layout is `club-assets/<clubId>/<uuid>.webp`. Original filenames never determine object paths.

Profile assignment verifies club ownership and stored-object existence inside the authorized transaction. Existing historical images remain unchanged unless explicitly edited. Replacement/removal updates the database reference authoritatively and does not delete old objects. Failed storage never changes a profile; failed upload transaction attempts best-effort deletion only of its newly generated object. A cleanup failure leaves an orphan rather than a broken profile. Upload retries can leave unreferenced immutable objects; garbage collection is intentionally deferred. Profile save retries use an optimistic version token in Admin; leader saves retain existing behavior.

Delivery uses `/api/club-assets?reference=...` without exposing service credentials or privileged URLs. Public delivery requires a currently referenced asset on a non-suspended club; unlisted profiles retain existing direct-link access. Unpublished previews require the same elevated Admin or leader capability. Authorization is rechecked after downloading; responses are no-store and nosniff. The bucket itself remains private.

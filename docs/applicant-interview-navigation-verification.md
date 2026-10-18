# Applicant interview records navigation

Recruiting → Applicants now contains **Résumé moderation** (existing president/vice-president capability) and **Submitted reviews** (existing explicit leadership capability). All Applicants stays the default applicant destination. Desktop and mobile drawer use the existing Applicants group; the mobile bottom item recognizes both new destinations through that group. Interviews retains rooms, master kit, scheduling and access setup.

The existing moderation/review components and protected services are reused. Optional applicant, historical round and recruitment-cycle filters are applied inside those authorized discovery queries before the existing 100-record limit. They do not grant access. Review detail reads still reauthorize, with the original anonymous projection and immutable submitted content. Moderation still uses the preserved document, author/moderator checks and existing audit path. No note, document, review or annotation mutation implementation changed.

Applicant details offer capability-gated record links with the selected application. Resume moderation is withheld from anonymous applicant details. Links preserve applicable query filters. Submitted review selection persists its record ID in the URL. The Applicants breadcrumb returns to the applicant workflow with relevant scope retained.

Old `tool=interviews&interviewTab=resumes|reviews` bookmarks redirect to `tool=resumes|reviews` under Applicants on direct requests and same-workspace navigation. Applicant/application IDs, round/cycle and selected review/document context are preserved; stale interview-entry keys are removed. Current submitted-review entry/notification projections use the new destination. The redirect grants no rights: the resulting workspace and original services enforce current access.

## Verification

- Unit/action regressions cover legacy URLs, retained context, office-specific menu visibility, Applicants mobile grouping, authorized query filters and denial for applicant-only access.
- Demo discovery uses the same filters and no live calls; saved Demo data is not reset or migrated.
- Real Chromium tests render the actual sidebar/mobile navigation and existing review/moderation components with isolated synthetic adapters. They verify applicant selection, read-only review, refresh, Back, old-link redirects, document scope, mobile active state/no overflow, and revoked-capability denial. The PDF content is a synthetic viewer stub; the annotation implementation is unchanged.
- Existing exact interview-entry and closing-review privacy/revocation regressions are retained. Final checks and deployment observations are recorded in the PR and private `OutClass-staging-verification/applicant-review-navigation-20261018/` release evidence.

No database migration, environment changes or production applicant mutations are required. Application rollback is compatible with the previous production deployment.

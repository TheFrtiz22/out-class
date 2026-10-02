# Organization onboarding UI polish

Reviewed October 2, 2026 on `feature/club-onboarding` using the isolated local
Supabase/Next E2E environment. Production and unrelated OutClass pages were not
changed.

## Presentation changes

- Roster preview/outcome and member-directory tables become labeled, stacked rows
  below 640 px. Desktop/tablet retain tables. Native captions, column headers,
  row markup, filtering, pagination, and server results remain intact.
- Invitation actions wrap on phones; tablet cards stack actions below the content
  instead of compressing organization names. Existing Buttons, ClubLogo, colors,
  display typography, border tokens, and card styles are reused.
- Consistent field spacing, focus rings for summaries/selects/links, 44 px actions,
  wrapping organization titles and member email addresses, and mobile dialog
  scrolling. The CSV file control links to its instructions and exposes errors.
- Decline confirmation exposes its expanded state and named confirmation group.
  Existing confirmation decisions, dialogs, business rules, and actions remain.
- Invitation landing pages show OutClass branding and readable existing permission
  labels rather than raw capability keys. Settings, checklist, email controls,
  empty member search, and import results share existing card and spacing tokens.

## Browser review

Chrome at desktop **1440 × 900**, tablet **834 × 1112**, and mobile **390 × 844**:

| Screen | Review |
| --- | --- |
| Dashboard invitations | MEMBER and OWNER cards; wrapped actions; existing tutorial dismissed for unobstructed review. |
| Settings → Organizations | Active membership, both invitation roles, decline confirmation and cancellation. |
| Invitation landing page | Long organization name, readable access labels, claim/decline controls. |
| Members | Active and invited rows; search empty state; member sheet, labels, role/group controls; invitation delivery controls. |
| CSV preview | Actual Chrome file picker; ready, missing-year warning, invalid, duplicate, and already-member rows. Mobile rows keep readable names and errors. |
| Setup checklist | Actual persisted completion; responsive item grid and continuation links. |
| Superadmin onboarding | School loading; four associated field errors; scrolling mobile dialog; successful creation, pending invitation, and selectable link. |

No page-level horizontal overflow was found on these screens at the three widths.
Chrome's accessibility tree retained table captions/column headers on mobile and
exposed labeled controls, errors, confirmation groups, and sheet/dialog titles.
Existing file-drop and busy/replay interaction tests passed. No browser automation
bypassed client handlers or server authorization.

Screenshots were saved to `/tmp/outclass-polish/` for this review, including
`settings-mobile.png`, `roster-mobile-detail.png`, and each screen/breakpoint.
This is an accessibility basics review, not a complete assistive-technology audit.

## Validation

- Production `npm run build` passed using isolated local configuration.
- `npm run typecheck` passed.
- `npm run lint` passed: zero errors, the existing 31 warnings.
- Complete `npm test` with real HTTP E2E and native PostgreSQL concurrency enabled:
  **392 passed, zero failed or skipped**.
- Real HTTP scenarios A–H passed after the presentation changes.
- No server action, authorization, schema, invitation state transition, or import
  processing behavior changed.

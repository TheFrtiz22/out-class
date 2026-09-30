# Authenticated OutClass launch-quality audit

September 28, 2026. Scope: the redesigned authenticated product; no new features, database changes, or landing-page redesign.

## Result and evidence limits

Local validation passes. The main authenticated navigation and live workspace boundaries are coherent. Two small launch regressions were fixed: contextual focus and misleading notification copy. Production readiness still depends on deploying/reconciling the database and Storage changes and testing actual accounts, devices, and provider services.

Evidence combines source review, 218 automated tests, real SQL migration tests in isolated PGlite, and an isolated local Demo browser fixture using the current components. Server tests mock authentication/database responses where indicated. These are not authenticated end-to-end sessions for every production persona. No production records, grants, messages, decisions, migrations, or provider settings were changed.

## Regressions fixed

- ProductShell keyed focus only by sidebar destination. Switching Recruiting Overview → Club Overview reused the destination ID and could leave keyboard focus behind. It now keys focus by club, primary mode, and destination. A behavioral regression test verifies mode and club changes, with no repeated focus on unchanged context.
- Notifications implied a connected delivery feed and an authoritative “all caught up” state. Copy now explicitly states that delivery is not connected and Demo/local preview updates stay in the browser. Existing notification actions and data behavior are unchanged.

Changed implementation: components/shell/product-shell.tsx and components/views/inbox-view.tsx. Added tests/product-shell-focus.test.cjs. This report replaces the outdated pre-redesign audit.

## Coverage matrix

| Area | Findings and evidence |
| --- | --- |
| Personal navigation | Explore / Applications / My Clubs remain primary modes. Context menus contain Discover/Categories/Calendar; All Applications/Interviews/Decisions; membership-supported club destinations. No duplicate entries within a primary/context menu. Profile and notifications remain utilities. Browser checked mobile Explore, Applications, My Clubs and contextual navigation. |
| Manager navigation | Recruiting / Club replaces student modes. Club identity and the existing one-account workspace selector remain visible. Quiet Review Tools contains Anonymous Review and persisted Auto-Reject Rules. Browser checked member → MII leader switching, recruiting overview, Applicants and Interviews. |
| Discovery | Directory-backed categories/search/claimed state remain intact; no persistent Saved destination or invented deadlines. Source/tests cover query/filter data; mobile browser shows real-shaped Demo directory cards and search controls. |
| Applications / interviews / decisions | Shared persisted application/status/round and booking data, draft locks, unsaved protection and respectful decisions remain covered. Attachments use the authorized saved-answer download route. Browser checked application rows/timeline and member landing; backend tests cover stale writes and attachment authorization. Acceptance does not imply membership. |
| Profile / calendar / notifications | Profile saves remain section-scoped. Calendar derives live booking/attendance/meeting records; local scheduling/RSVP tools are not authoritative writes to those records. Notification delivery has no backend, now explicitly disclosed. Actual storage, identity-provider and email flows require staging QA. |
| Applicants / List / Kanban | One shared pipeline, filtering, privacy projection and drawer. Status and round actions retain expected-state checks. Browser exercised keyboard List/Kanban switching, anonymous-round filtering, empty lanes, and the same applicant drawer. No local stage store or drag/drop mutation is used for the live board. |
| Anonymous review / Review Tools | Server allowlist projection, reveal reason/audit, hidden attachments and appointments remain tested. Browser confirmed pseudonyms, prepared anonymous content and withheld files/appointments. Persisted rules expose save → preview → explicit reversible flags, with no automatic decision changes. |
| Interviews / kits / focused mode | Existing permission-gated kits, snapshots, private notes, autosave/revisions, completion and failure recovery remain covered by dedicated tests. Browser checked interview entry, kit controls and the focused shell transition, which removes normal app navigation. No live collaborator presence is claimed. |
| Club overview / meetings | Overview uses actionable live data rather than vanity metrics. Meeting audience/resource/attendance/issuer/revision guards remain covered. Member browser showed actual permitted next meeting and recap links. |
| Club tasks / members | Assignment targeting, submission/review locks, reopen, signed files, access delegation and owner safeguards remain covered. Layout source retains mobile rows and bounded drawers. Legacy revisionless task writes remain disabled. |
| Announcements / settings | Announcements are clearly preview-only with no fabricated delivery/history. Persisted public settings are separated from access/recruitment and collapsed local builders. |
| Member visibility / QR | Ordinary-member sidebar has only Overview/Meetings/Tasks; confirmed in the TAMID Demo member workspace. Server tests cover current membership, targeting, private resources, QR expiry/issuer revocation and duplicate check-in. Cross-device QR operation was not tested against deployed services. |
| Permission personas | Automated integration matrix covers ordinary student, applicant, member, limited/broad manager, anonymous reviewer, MII Demo and super-admin boundary, including forged club IDs/client roles. Live API access rejects Demo context; platform administration remains a separate protected route with audited read-only impersonation. Browser directly exercised student/member/MII leader only. |
| Errors / loading / stale updates | Authenticated components retain actionable loading/empty/error states. Tests cover failed/stale mutations and privacy-safe reloads across applications, rounds, rules, interviews, tasks and meetings. Local browser confirms loading transitions, empty Kanban lanes and no-flags state. |

## Responsive, accessibility and keyboard evidence

Local browser checked narrow mobile and larger tablet/desktop layouts. Measured CSS widths included 320, 433, 853 and 1422px (browser zoom affects requested desktop viewport sizes). Checked surfaces had document scroll width equal to viewport width; the anonymous applicant drawer measured 320px at the narrowest width. This is representative sampling, not an exhaustive every-screen/device certification.

Keyboard Enter opens primary/context destinations, switches Kanban and opens the applicant drawer. Escape closes it and returns focus to the originating applicant card. Context navigation uses an accessible sheet, labeled workspace selector, and a skip link. Normal data tables adapt to mobile lists; Kanban stacks; drawer contents scroll.

Reduced-motion emulation was enabled during mobile checks. Shared CSS overrides animation/transition durations and scrolling, while preserving presence completion events. Source review also checked native labels, pressed/current states, named dialogs and live status/error output. Screen-reader speech output, touch-only iOS behavior, high zoom and automated color-contrast coverage still need dedicated device QA.

The local browser reported a Grammarly-injected body-attribute hydration warning. No application exception was observed during these sampled workflows; extensions were not disabled or modified.

## Remaining preview/local-only features

- Announcement composition/list examples: no publishing, recipients or delivery.
- Notifications: Demo/local state; no authoritative notification persistence or delivery.
- Existing scheduling builder/student booking previews: browser-local; not the source of live slots/bookings. The MII Demo scheduler updates its isolated Demo graph.
- Collapsed branding/application-builder/legacy management previews in settings: do not publish public profiles, questions, permissions or invitations.
- Legacy local recruiting board/targets, plus /live-voting and /vote: no production ballots or cross-device voting authority. The live Applicants List/Kanban and saved application decisions are separate production workflows.
- Demo seed data and changes, including recruiting-rule flags, stay in the browser and reset canonically.

Auto-Reject Rules are no longer preview-only configuration: saved rules, previews and review flags have a backend. No rejection is executed automatically.

## Remaining backend/integration gaps

- Announcement/broadcast persistence and delivery; notification persistence and delivery.
- Production collaborative voting/ballots and realtime interview collaboration. Current interview notes are private persisted notes, not a shared realtime editor.
- Wiring the legacy scheduling/editor previews to authoritative management APIs, where desired. Existing live application/booking/kit data is not a preview.
- File malware scanning and automatic orphan/retention cleanup are not implemented.
- Actual deployed migration drift, Storage policies, auth/email configuration and recovery behavior remain unverified here. Follow database-deployment.md; do not replay the archived Supabase history or blindly baseline an existing database.

These gaps were not filled during this audit because doing so would add features or require service/deployment work outside this pass.

## Obsolete components safe to remove later

Repository import search found no runtime consumers for:
- components/shell/navigation.tsx — replaced by ProductShell's contextual navigation.
- components/ui/sidebar.tsx — unused sidebar primitive family.

The unused ClubManagerView import in components/app-shell.tsx can also be removed later; the component itself is still referenced by explicitly labeled settings previews.

Do not delete LocalLeaderDashboardView, its pipeline/speed-review components, ClubManagerView, InterviewSchedulerView, BroadcastMessagesView or live-voting preview components wholesale: legacy/preview routes still use them. Removing those requires a deliberate route cleanup. No components were deleted in this audit.

## Validation and performance

- npm run validate: 218/218 tests pass; lint 0 errors / 28 existing warnings; typecheck passes; production build passes.
- All 11 migrations tested on fresh and populated legacy isolated databases; all 27 application tables enforce RLS/browser-role denial. Separate Storage SQL tests verify the restrictive resume policy against broad legacy grants.
- git diff --check passes.
- Production build: shared first-load JS 103 kB; root 471 kB; club workspace 389 kB; preview 472 kB. Compilation reported 2.3 seconds on this machine. These are build observations, not field latency/Lighthouse scores.
- The broad AppShell import graph remains the clearest performance concern. Route-level splitting of infrequently used preview/manager tools should be considered separately and measured on throttled mobile hardware.

## Highest-risk manual QA before launch

1. Reconcile/deploy reviewed migrations and Storage policies on staging; test real anon/member/reviewer/manager tokens against private resumes, application attachments and task files. Verify direct Storage reads fail while authorized short-lived downloads work.
2. Test concurrent browsers and revoked permissions during applicant decisions/round moves, rule preview/apply, interview autosave/completion, meeting edits and task submission/review/reopen.
3. Test QR on a second physical device: expiry, rotated token, revoked issuer, duplicate check-in and private member resources.
4. Verify owner safeguards, invitation acceptance/expiry, claiming, platform-admin separation and expired impersonation with independent real accounts.
5. Test OAuth/session recovery and actual password-recovery email delivery/redirects.
6. Run iOS Safari/Android touch and screen-reader checks, keyboard-only dialog flows, 200–400% zoom, and throttled cold-load performance on large club datasets.

No production launch certification is implied by passing local tests.

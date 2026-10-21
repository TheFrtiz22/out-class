# Club management UX audit

Reviewed 2026-10-21 before implementation. Scope: live club workspace, legacy/demo entry points, and their shared editors. The pasted brief ends at “Consistent headers”; the preceding ten phases define the implementation scope.

| Workspace / source | Administrator's task and first action | Default-view problem | Implementation / preserved behavior |
| --- | --- | --- | --- |
| `club-workspace`, `manager-overview`, `recruiting-overview` | Identify work and open the relevant queue | Operational actions compete with configuration destinations | Keep navigation, permission-filtered metrics and existing routes; add direct operational shortcuts |
| `meeting-workspace`, `events/club-meetings-workspace` | New meeting; inspect upcoming meetings | Creation and editing are disclosures; optional fields dominate | Focused creation/edit dialogs, essentials first, optional editor tabs, existing revision checks, drafts and attendance |
| `organization-member-management`, `club-members` | Add member; search directory | Email infrastructure, eligibility and CSV forms precede members; invitations mixed into directory | Action toolbar, separate invitation workspace, role/year filters, importer dialog, member settings sheet; retain selection and per-record safeguards |
| `invitation-email-controls`, `invitation-schedules`, `roster-csv-importer` | Review, invite, then explicitly dispatch | Long infrastructure copy and scheduling disclosures | Place delivery/schedules in invitations; explicit scheduling action; preserve preview, cooldown, duplicate handling and no email on import |
| `availability/interviewer-eligibility` | Configure role defaults or selected members | Club defaults always appear above directory | Defaults in Members → Settings; overrides in details/selection; preserve round > individual > role precedence |
| `club-tasks`, `tasks/task-manager-workspace`, `task-assignment-builder`, `task-audience-builder`, `task-review-workspace` | Create task; choose recipients; review work | Composer shows all four sections; nested project/roster disclosures | Details → Assignment → Review; keep exact server recipient preview, random selection, formats, projects and revision-safe review |
| `club-announcements`, `recipient-audiences`, `communication-schedules` | Compose and publish | Groups and scheduled communication infrastructure precede published list | Message-first composer with explicit preview/confirmation; audiences and schedules in focused management sheets; preserve delivery preferences |
| `live-leader-workspace`, `live-voting/board-decision-mode`, `live-voting-launcher` | Review applicants, start voting, review decisions | Persistent voting buried under “Interview kits & board review”; local preview is a different implementation | Promote persistent voting; retain fullscreen mode, history, immutable ballots, privacy and explicit publication; do not substitute the local preview |
| `interview-pipeline-builder-view`, `interview-management-tabs`, `interview-kit-editor`, `interviews/pipeline-interview-status` | New round, manage kit, set availability | Every round is an expanded form; privacy settings mixed into setup | Round overview with focused details/review and explicit setup actions; privacy settings separate; deferrable scheduling remains deferrable |
| `interviews/room-manager`, `availability/admin-overview`, `availability-button` | Set availability; create rooms; preview and approve panels | Availability hidden in Schedule options; collection is an expanded disclosure | Promote availability and scheduling stages; keep room persistence, constraint validation, preview/approval/publication backend |
| `club-settings-workspace`, `views/club-management-portal-view`, `events/club-events` | Configure club or manage an event | Settings already separated; portal uses local sample records; events already have focused workflow | Keep existing settings hierarchy and event editor; clarify action language; do not route live data into the sample portal |
| Decisions / `decision-schedules`, applicant sheets | Review outcomes and explicitly publish | Publication needs a clear selection summary | Add accurate selected-category/unresolved summary; preserve existing confirmation, letters, notifications and atomic publication rules |

Implementation checklist:

- [x] Shared accessible action dialog/sheet behavior, focus return, cancel, saving and unsaved protection.
- [x] Meetings: creation/edit actions, essential fields, optional content and list refresh.
- [x] Members: directory first, add/invite/import/settings, contextual bulk eligibility, member editing.
- [x] Voting: visible persistent entry, focused setup, history and publication review.
- [x] Tasks: details/assignment/review with exact recipient preview and existing review queue.
- [x] Announcements: message-first composer, preview, separate audience/schedule management.
- [x] Rounds/scheduling: overview, guided round setup, visible availability and preserved scheduler.
- [x] Dashboard/settings/events consistency and all remaining club-side disclosures reviewed.
- [x] Type/lint/build and relevant behavior/browser checks, with limitations recorded.

Boundary: no new database schema, auth model, voting implementation, scheduler, messaging system, or email-send-on-import behavior.


## Verification and review

Story: visible club actions open focused workflows, use the existing permission-checked actions, then refresh the affected workspace. Operational changes remain separate from private drafts, email dispatch, and decision publication.

| Boundary | Evidence |
| --- | --- |
| Browser → action → refreshed UI | Desktop/mobile browser coverage for meeting create/edit and draft recovery, member add/invitations/settings, task audiences and submission review, round creation → kit → scheduling, announcement recipient confirmation, and recoverable voting drafts. |
| Existing authorization and data behavior | Complete suite: **1,278 passed, 34 skipped, 0 failed** (1,312 tests). Existing tests cover immutable ballots, privacy, role safeguards, exact task recipients, duplicate CSV handling, scheduling constraints, publication, and retained history. |
| Database protections | `npm run test:migrations`: all **57 migrations** pass on fresh and legacy fixtures; **78 tables** enforce RLS and deny browser-role CRUD. No database/schema changes were made. |
| Compilation | `tsc --noEmit` and production `next build` pass. |
| Code quality | ESLint: 0 errors, 26 existing warnings. `git diff --check` clean. React review covered hook order, draft ownership, permissions, form semantics, focus restoration, loading/error/success states, mobile overflow, and lazy workflow entry points. |
| Accessibility spot-check | Axe WCAG A/AA scans found **0 violations** in eight default/workflow states across members, meetings, announcements, and voting. Keyboard/focus and mobile checks also run in the browser suite. |
| Visual review | Desktop and 390px screenshots reviewed for meetings, members, task assignment, kits, round scheduling, and announcement confirmation. Disposable local screenshots are under `/tmp/outclass-ux-qa`. |

Remaining disclosures were reviewed by purpose: compact applicant filters and specialized historical/diagnostic content can remain secondary disclosures. Public FAQs and platform administration are separate surfaces. The legacy local club-management portal and local voting preview remain separate from live persistence; neither is substituted for the live workflows.

Limits: browser runs use disposable loopback fixtures. Scheduling and voting exercise their existing canonical actions against isolated data; members, meetings, and announcements use an in-memory action adapter, with server authorization/persistence covered separately by the existing action and migration tests. The 34 skipped tests require optional runtime/database environments. No hosted club records, real emails, or student decisions were changed. No deployment was performed.

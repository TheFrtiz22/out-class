# Club workspace

`/club/[clubId]/workspace` is the club's main authenticated destination. A single `section` query parameter selects Overview, Members, Meetings, Tasks, Recruitment, or Settings; there is no separate navigation tree per tool. Student navigation remains unchanged. The prominent workspace selector lists the same user's memberships as Student, club Leader, or club Member contexts. Switching never grants capabilities or changes login.

## Visibility and boundaries

`lib/club-workspace.ts` centralizes navigation availability. All current members have Overview, Meetings, and Tasks. Members appears for `members.manage` or `leaders.manage`; Settings requires `club.settings`. Recruitment exposes only tools supported by the user's capabilities. A ballot-only permission does not pretend that a standalone multi-device voting service exists. Decisions stay in the existing applicant workflow, with its existing permissions and persistence.

`actions/club-overview.ts` requires current membership before querying club data. It returns the next meeting, up to five outstanding personal assignments, and permitted attention counts. Club submission-review counts require `tasks.manage`. Recruitment counts require applicant access; review-only users receive counts from anonymous rounds only. No applicant identities or application responses are included in the overview. Round settings have a separate `recruitment.manage`-protected read so managers without applicant access can configure privacy without receiving applicants.

The existing meeting, task, membership, profile, interview, and recruitment actions remain the authority for reads and writes. Grouping controls in this workspace does not relax their checks. Direct links to unavailable sections show an access state rather than mounting their tools. Recruitment components synchronize the selected club before mounting; their legacy internal club selectors are suppressed when embedded to prevent divergence between the route and displayed data.

## Existing features

- Meetings keeps the shared meeting model and audience filtering. Ordinary members initially see Member Meetings and can select Recruitment / Interest. Standalone meeting and attendance URLs remain valid.
- Tasks reuses the existing member/manager interface. Overview review links open the team view. Existing task URLs remain valid.
- Members reuses member management and links to the existing granular access editor; its return link leads back to the club's Members section.
- Recruitment reuses applicants, review, decision mode, round privacy/test configuration, and interview kits. Interview mode temporarily replaces workspace navigation and retains its guarded exit behavior.
- Existing local-only scheduling builders remain labeled as previews. They have not been promoted into a live slot-publishing system by this navigation change.
- Settings contains permitted profile controls. Local preview builders remain available through the legacy settings view, not mixed into the new persistent profile form.

## Demo

The existing demo identity remains a student and an MII manager only. Entering MII synchronizes that perspective before recruitment adapters run. Returning to Student uses `/?workspace=student`; explicit demo perspective changes clear that one-time navigation hint so it cannot trap later switching. Overview adapters derive attention information from the current demo snapshot and never call real actions. Demo member information is explicitly fictional; real invitations/access changes remain outside demo mode.

## Validation and deployment

No schema migration or new environment variables are introduced. This workspace depends on the previously implemented task/meeting migrations and existing auth/demo configuration. Tests cover capability-driven navigation, member query isolation, anonymous count restrictions, round authorization, and isolated demo overview updates. Production-browser fixture checks cover sections at 320/390/768/1440 widths, interview entry/exit, and the Student return URL. Actual Supabase-authenticated multi-club switching still needs a deployed-account smoke test; browser fixtures do not establish live authentication coverage.

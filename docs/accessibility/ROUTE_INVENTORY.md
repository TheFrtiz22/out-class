# Route inventory

Evaluation date: 2026-10-20. All 44 App Router pages and 249 TSX components are recorded in [COVERAGE.csv](COVERAGE.csv). State detection is mechanical inventory, not evidence of successful interaction or full source review. API handlers are not user interfaces and remain covered by the existing authorization/business tests.

- `/about` → `app/about/page.tsx`
- `/applications/[applicationId]/decision` → `app/applications/[applicationId]/decision/page.tsx`
- `/auth/student-claim` → `app/auth/student-claim/page.tsx`
- `/check-in` → `app/check-in/page.tsx`
- `/club/[clubId]` → `app/club/[clubId]/page.tsx`
- `/club/[clubId]/tasks` → `app/club/[clubId]/tasks/page.tsx`
- `/club/[clubId]/workspace` → `app/club/[clubId]/workspace/page.tsx`
- `/club-access/[clubId]` → `app/club-access/[clubId]/page.tsx`
- `/club-claims/[clubId]` → `app/club-claims/[clubId]/page.tsx`
- `/corkboard` → `app/corkboard/page.tsx`
- `/decisions` → `app/decisions/page.tsx`
- `/design-system` → `app/design-system/page.tsx`
- `/forgot-password` → `app/forgot-password/page.tsx`
- `/interviews/book` → `app/interviews/book/page.tsx`
- `/interviews` → `app/interviews/page.tsx`
- `/invitations/[id]` → `app/invitations/[id]/page.tsx`
- `/live-voting` → `app/live-voting/page.tsx`
- `/login` → `app/login/page.tsx`
- `/meetings/[id]` → `app/meetings/[id]/page.tsx`
- `/meetings` → `app/meetings/page.tsx`
- `/` → `app/page.tsx`
- `/platform/[section]` → `app/platform/[section]/page.tsx`
- `/platform/claims` → `app/platform/claims/page.tsx`
- `/platform/clubs` → `app/platform/clubs/page.tsx`
- `/platform/events` → `app/platform/events/page.tsx`
- `/platform/login` → `app/platform/login/page.tsx`
- `/platform` → `app/platform/page.tsx`
- `/platform/school-requests` → `app/platform/school-requests/page.tsx`
- `/platform/view-as` → `app/platform/view-as/page.tsx`
- `/preview` → `app/preview/page.tsx`
- `/request-school` → `app/request-school/page.tsx`
- `/reset-password` → `app/reset-password/page.tsx`
- `/saved-clubs` → `app/saved-clubs/page.tsx`
- `/settings/account` → `app/settings/account/page.tsx`
- `/settings/availability` → `app/settings/availability/page.tsx`
- `/settings/interviews` → `app/settings/interviews/page.tsx`
- `/settings/notifications` → `app/settings/notifications/page.tsx`
- `/settings/organizations` → `app/settings/organizations/page.tsx`
- `/settings` → `app/settings/page.tsx`
- `/settings/profile` → `app/settings/profile/page.tsx`
- `/signup` → `app/signup/page.tsx`
- `/uva` → `app/uva/page.tsx`
- `/vote` → `app/vote/page.tsx`
- `/voting/[sessionId]/join` → `app/voting/[sessionId]/join/page.tsx`

The homepage also dispatches student and club tools through `components/app-shell.tsx` and the `workspace`, `view`, and club workspace query parameters. A route-only scan does not cover those views. The workflow matrix in ACCESSIBILITY_AUDIT.md identifies those gaps.

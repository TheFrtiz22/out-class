# OutClass typography audit

## Original families and locations

- Geist: loaded through next/font in app/layout.tsx; default sans family in app/globals.css and tailwind.config.js, inherited by all routes.
- Georgia, Times New Roman, generic serif: display stack in styles/tokens.css; used in landing/hero, explore/discovery, recruiting overview, manager overview, shell and interview CSS, and SectionHeading editorial mode.
- Geist Mono: root font loader; platform-console, interview timer, branding color input, speed review scores/keyboard hints and chart values.
- Fallbacks: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif and monospace; Tailwind default serif stack is available but was not explicitly used.
- styles/globals.css was an unused duplicate of the global setup. It now forwards to the canonical entry point.

Original explicit family declarations/utilities occur in:

- `app/club-access/[clubId]/page.tsx`
- `app/club-claims/[clubId]/page.tsx`
- `app/design-system/page.tsx`
- `app/error.tsx`
- `app/globals.css`
- `app/invitations/[id]/page.tsx`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/platform/claims/page.tsx`
- `app/platform/login/page.tsx`
- `app/platform/page.tsx`
- `app/settings/organizations/page.tsx`
- `components/club-announcements.tsx`
- `components/club-profile-settings.tsx`
- `components/club-tasks.tsx`
- `components/club-workspace-settings.tsx`
- `components/club-workspace.tsx`
- `components/clubs/club-discovery.css`
- `components/clubs/explore-directory.css`
- `components/clubs/manager-overview.css`
- `components/clubs/recruiting-overview.css`
- `components/dashboard-layout.tsx`
- `components/demo-workspace.tsx`
- `components/interview-kit-session.tsx`
- `components/landing/hero.css`
- `components/landing/recruitment-demo.css`
- `components/live-voting/board-decision-mode.tsx`
- `components/live-voting/member-voting-pad.tsx`
- `components/live-voting/proctor-presentation-view.tsx`
- `components/meeting-workspace.tsx`
- `components/member-overview.tsx`
- `components/organization-memberships.tsx`
- `components/organization-ownership-requests.tsx`
- `components/organization-setup-checklist.tsx`
- `components/password-recovery.tsx`
- `components/personal-clubs.tsx`
- `components/platform-console.tsx`
- `components/platform-organization-onboarding.tsx`
- `components/qr/meeting-check-in.tsx`
- `components/shell/authenticated-product.css`
- `components/ui/chart.tsx`
- `components/ui/section-heading.tsx`
- `components/views/application-tracker-view.tsx`
- `components/views/branding/color-picker.tsx`
- `components/views/calendar-view.tsx`
- `components/views/inbox-view.tsx`
- `components/views/interview-workspace-view.tsx`
- `components/views/interview/interview-mode.css`
- `components/views/landing.css`
- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `components/views/leader-dashboard/speed-review-mode.tsx`
- `components/views/student-home.css`
- `components/views/unified-student-profile-view.tsx`
- `styles/globals.css`
- `styles/tokens.css`
- `tailwind.config.js`

## Universal hierarchy

Geist is the only loaded family. Display and legacy mono aliases resolve to Geist. Numeric alignment uses tabular numerals.

| Role | Size | Weight |
|---|---|---|
| Page title | 28–36px responsive | 600 |
| Section heading | 22–28px responsive | 600 |
| Card / empty title | 18px | 600 |
| Modal / drawer | 22px | 600 |
| Body | 16px | 400 |
| Compact body / table | 14px | 400 |
| Label / button / navigation | 14px | 500 |
| Caption | 12px | 400–500 |
| Form input | 16px mobile / 14px desktop | 400 |

Source of truth: styles/tokens.css and styles/typography.css. Shared classes: oc-page-title, oc-section-heading, oc-card-heading, oc-modal-title, oc-body, oc-body-small, oc-caption, oc-label, oc-button, oc-nav and oc-table.

Marketing hero, miniature previews and presentation metrics retain context-specific scales through tokens. Existing layout, colors, spacing and functionality are outside this migration. Existing Tailwind text utilities remain shared size tokens for supporting copy and responsive contexts.

## Changed files

- `app/club-access/[clubId]/page.tsx`
- `app/club-claims/[clubId]/page.tsx`
- `app/club/[clubId]/page.tsx`
- `app/design-system/page.tsx`
- `app/error.tsx`
- `app/globals.css`
- `app/invitations/[id]/page.tsx`
- `app/layout.tsx`
- `app/live-voting/page.tsx`
- `app/not-found.tsx`
- `app/platform/claims/page.tsx`
- `app/platform/login/page.tsx`
- `app/platform/page.tsx`
- `app/settings/organizations/page.tsx`
- `components/applications/application-tracker.css`
- `components/claim-review.tsx`
- `components/club-access-editor.tsx`
- `components/club-announcements.tsx`
- `components/club-members.tsx`
- `components/club-profile-settings.tsx`
- `components/club-tasks.tsx`
- `components/club-workspace-settings.tsx`
- `components/club-workspace.tsx`
- `components/clubs/club-discovery.css`
- `components/clubs/club-profile-editor.tsx`
- `components/clubs/explore-directory.css`
- `components/clubs/interview-kit-editor.css`
- `components/clubs/manager-overview.css`
- `components/clubs/marketing-profile.tsx`
- `components/clubs/recruiting-overview.css`
- `components/customization/profile-builder.tsx`
- `components/customization/recruitment-pipeline-builder.tsx`
- `components/dashboard-layout.tsx`
- `components/demo-workspace.tsx`
- `components/interview-kit-session.tsx`
- `components/interviews/booking-link-page.tsx`
- `components/interviews/booking-picker.tsx`
- `components/interviews/create-room-dialog.tsx`
- `components/interviews/room-manager.tsx`
- `components/interviews/scheduling.css`
- `components/landing/hero.css`
- `components/landing/recruitment-demo.css`
- `components/live-voting/board-decision-mode.tsx`
- `components/live-voting/live-voting-launcher.tsx`
- `components/live-voting/member-voting-pad.tsx`
- `components/live-voting/mobile-join-screen.tsx`
- `components/live-voting/proctor-presentation-view.tsx`
- `components/live-voting/voting-lobby.tsx`
- `components/meeting-workspace.tsx`
- `components/member-overview.tsx`
- `components/motion/scroll-motion.css`
- `components/organization-invitation-card.tsx`
- `components/organization-member-management.tsx`
- `components/organization-memberships.tsx`
- `components/organization-ownership-requests.tsx`
- `components/organization-setup-checklist.tsx`
- `components/password-recovery.tsx`
- `components/personal-clubs.tsx`
- `components/platform-console.tsx`
- `components/platform-organization-onboarding.tsx`
- `components/qr/event-qr-dashboard.tsx`
- `components/qr/leads-table.tsx`
- `components/qr/meeting-check-in.tsx`
- `components/qr/qr-code-card.tsx`
- `components/roster-csv-importer.tsx`
- `components/shell/authenticated-product.css`
- `components/shell/navigation.tsx`
- `components/shell/product-shell.tsx`
- `components/shell/responsive-workspace.css`
- `components/student-profile-card.tsx`
- `components/tasks.css`
- `components/tutorial-walkthrough.tsx`
- `components/ui/alert-dialog.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/chart.tsx`
- `components/ui/dialog.tsx`
- `components/ui/empty-state.tsx`
- `components/ui/empty.tsx`
- `components/ui/label.tsx`
- `components/ui/section-heading.tsx`
- `components/ui/sheet.tsx`
- `components/ui/table.tsx`
- `components/views/application-tracker-view.tsx`
- `components/views/auth-view.tsx`
- `components/views/branding/color-picker.tsx`
- `components/views/branding/media-uploader.tsx`
- `components/views/branding/profile-preview-card.tsx`
- `components/views/calendar-view.tsx`
- `components/views/club-management-portal-view.tsx`
- `components/views/club-manager/application-builder-view.tsx`
- `components/views/club-manager/broadcast-messages-view.tsx`
- `components/views/club-manager/events-meetings-view.tsx`
- `components/views/club-manager/interview-pipeline-builder-view.tsx`
- `components/views/club-manager/interview-room-panel-matrix-view.tsx`
- `components/views/club-manager/interviewer-availability-view.tsx`
- `components/views/club-manager/roster-roles-view.tsx`
- `components/views/inbox-view.tsx`
- `components/views/interview-scheduler-view.tsx`
- `components/views/interview-workspace-view.tsx`
- `components/views/interview/interview-mode.css`
- `components/views/interview/workspace-question-card.tsx`
- `components/views/interviewer-dashboard.tsx`
- `components/views/landing.css`
- `components/views/leader-dashboard-view.tsx`
- `components/views/leader-dashboard/live-applicant-views.tsx`
- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `components/views/leader-dashboard/pipeline-view.tsx`
- `components/views/leader-dashboard/speed-review-mode.tsx`
- `components/views/member-portal-dialog.tsx`
- `components/views/scheduler/create-schedule-dialog.tsx`
- `components/views/scheduler/slot-card.tsx`
- `components/views/scheduler/student-booking-preview.tsx`
- `components/views/screening-dashboard-view.tsx`
- `components/views/student-home.css`
- `components/views/student-onboarding-wizard.tsx`
- `components/views/unified-student-profile-view.tsx`
- `docs/typography-audit.md`
- `lib/design-system.ts`
- `styles/globals.css`
- `styles/tokens.css`
- `styles/typography.css`
- `tailwind.config.js`

## Verification

TypeScript type checking passed. ESLint passed with 31 existing warnings. Production build passed. Desktop/mobile scales were checked in source; authenticated screens have not undergone browser visual QA.

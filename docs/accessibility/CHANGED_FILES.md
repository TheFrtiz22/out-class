# Changed files

At the original audit delivery, all changes were local to `accessibility/wcag22-audit` and nothing had been merged or deployed. The production database/auth settings and schema source were preserved. Existing migrations and test-only Auth/MFA settings were used in the reserved disposable test stack, which is cleaned up by the runner. Exact original source hashes are in [SOURCE_MANIFEST.json](evidence/SOURCE_MANIFEST.json); tracked-file changes are also retained in [source-changes.patch](evidence/source-changes.patch). The later user-authorized local main merge, additional browser-test setup repair and repeated validation are recorded in [MERGE_VERIFICATION.md](MERGE_VERIFICATION.md).

| File | Significant change |
|---|---|
| `.github/workflows/deploy.yml` | Public/component and real authenticated accessibility CI jobs; upload raw evidence even on failure. |
| `.gitignore` | Ignore generated local browser reports and test-server logs under test-results. |
| `app/platform/claims/page.tsx` | Remove nested main landmarks while preserving the shared admin shell and recovery behavior. |
| `app/platform/events/page.tsx` | Remove nested main landmarks while preserving the shared admin shell and recovery behavior. |
| `app/platform/school-requests/page.tsx` | Remove nested main landmarks while preserving the shared admin shell and recovery behavior. |
| `app/platform/view-as/page.tsx` | Remove nested main landmarks while preserving the shared admin shell and recovery behavior. |
| `app/request-school/page.tsx` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/admin/admin-directory.tsx` | Named/scoped table and pagination wrapping at 320px. |
| `components/admin/admin-recovery.tsx` | Remove nested main landmarks while preserving the shared admin shell and recovery behavior. |
| `components/applications/application-form.tsx` | Persistent submission/upload feedback, linked validation summary and associated file-input errors/help. |
| `components/applications/question-field.tsx` | Native required fields alongside existing invalid/help semantics. |
| `components/auth/login-auth-panel.tsx` | Preserve email-form Escape handling and document user-initiated OTP autofocus for accessibility linting. |
| `components/availability/availability.css` | Grid/header/state structure, keyboard/tap alternatives, focus, cancellation and named edit modes. |
| `components/availability/my-availability.tsx` | Grid/header/state structure, keyboard/tap alternatives, focus, cancellation and named edit modes. |
| `components/availability/weekly-calendar.tsx` | Grid/header/state structure, keyboard/tap alternatives, focus, cancellation and named edit modes. |
| `components/club-workspace-switcher.tsx` | Visible-name-compatible account/search/workspace controls and readable rail headings. |
| `components/clubs/corkboard-button.tsx` | Visible-name-compatible controls, full textual event dates, group semantics and equivalent flyer instructions. |
| `components/clubs/profile-image-input.tsx` | Remove unused hidden readonly URL fields in upload mode and expose upload focus. |
| `components/events/club-events.tsx` | Visible-name-compatible controls, full textual event dates, group semantics and equivalent flyer instructions. |
| `components/events/event-discovery-actions.tsx` | Visible-name-compatible controls, full textual event dates, group semantics and equivalent flyer instructions. |
| `components/events/public-event-board.tsx` | Visible-name-compatible controls, full textual event dates, group semantics and equivalent flyer instructions. |
| `components/events/smart-event-card.tsx` | Visible-name-compatible controls, full textual event dates, group semantics and equivalent flyer instructions. |
| `components/interview-kit-session.tsx` | Document user-initiated off-script editor autofocus for accessibility linting. |
| `components/interview-resume-preview.tsx` | Keyboard expansion with conditional button/scrollable-region semantics. |
| `components/interviews/booking-picker.tsx` | Persistent reservation/reschedule/cancel feedback, date announcements and focus after action removal. |
| `components/landing/feature-orbit.css` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/landing/feature-orbit.tsx` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/landing/journey-scenes.tsx` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/landing/journey.css` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/landing/public-footer.css` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/landing/public-foundations.css` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/landing/public-navigation.css` | Presentation semantics and named groups; preserve appearance while allowing spacing/reflow. |
| `components/live-voting/member-voting-pad.tsx` | Stable candidate/status announcements and embedded landmark structure. |
| `components/live-voting/session-join.tsx` | Stable candidate/status announcements and embedded landmark structure. |
| `components/product/metric-strip.tsx` | Use natural content names or include all visible words in explicit names. |
| `components/shell/authenticated-product.css` | Visible-name-compatible account/search/workspace controls and readable rail headings. |
| `components/shell/floating-header-controls.tsx` | Visible-name-compatible account/search/workspace controls and readable rail headings. |
| `components/shell/navigation-search.tsx` | Visible-name-compatible account/search/workspace controls and readable rail headings. |
| `components/shell/product-shell.tsx` | Visible-name-compatible account/search/workspace controls and readable rail headings. |
| `components/tasks/task-assignment-builder.tsx` | Remove unconditional autofocus from task title to avoid unexpected initial focus movement. |
| `components/ui/card.tsx` | Explicitly render title children so accessibility lint can verify heading content. |
| `components/views/branding/color-picker.tsx` | Replace an unassociated field label used as a group heading with text. |
| `components/views/club-management-portal-view.tsx` | Document user-initiated inline title editor autofocus for accessibility linting. |
| `components/views/club-manager/broadcast-messages-view.tsx` | Remove nested interactive audience controls; expose pressed states and selected trigger value. |
| `components/views/explore-view.tsx` | Use natural content names or include all visible words in explicit names. |
| `components/views/leader-dashboard/pipeline-view.tsx` | Make candidate name a native profile action while preserving dragging and stage-select alternatives. |
| `components/views/student-dashboard-view.tsx` | Use natural content names or include all visible words in explicit names. |
| `components/views/student-onboarding-wizard.tsx` | Keyboard résumé upload, named removal, graduation label and readable progress text. |
| `components/views/unified-student-profile-view.tsx` | Use natural content names or include all visible words in explicit names. |
| `eslint.config.mjs` | Recommended accessibility rules, project control mappings and documented narrow accommodations. |
| `package.json` | axe/lint development dependencies and repeatable public/authenticated commands. |
| `pnpm-lock.yaml` | axe/lint development dependencies and repeatable public/authenticated commands. |
| `scripts/run-accessibility.cjs` | Start/stop localhost public/component app with hosted service targets overridden; run the fast accessibility suite. |
| `scripts/run-onboarding-e2e.cjs` | Add --a11y selection to the existing guarded disposable Auth/MFA/PostgreSQL runner. |
| `tests/accessibility/accessibility.test.cjs` | Public routes and actual component semantics, axe, keyboard, focus, spacing/reflow and reduced-motion checks. |
| `tests/accessibility/authenticated.test.cjs` | Real signed-in student/owner/MFA-admin pages and persisted application submission with axe/reflow checks. |
| `tests/accessibility/fixture.cjs` | Render actual components/styles with fictional records and explicitly mocked action transport for fast tests. |
| `tests/campus-events-ui.test.cjs` | Keep regression assertions aligned with visible names and canonical identity behavior. |
| `tests/product-shell-focus.test.cjs` | Keep regression assertions aligned with visible names and canonical identity behavior. |
| `tests/settings-navigation-e2e.test.cjs` | Keep regression assertions aligned with visible names and canonical identity behavior. |

Documentation added: ACCESSIBILITY_AUDIT.md, WCAG_2_2_AA_MATRIX.md, ACCESSIBILITY_REMEDIATION.md, MANUAL_ACCESSIBILITY_TESTS.md, ACCESSIBILITY_MAINTENANCE.md, PUBLIC_ACCESSIBILITY_STATEMENT_DRAFT.md, THIRD_PARTY_CONTENT.md, EVIDENCE.md, ROUTE_INVENTORY.md, COVERAGE.csv, this file and retained evidence. All implementation findings and pending limits are described in the remediation register.

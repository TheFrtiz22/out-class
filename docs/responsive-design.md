# Responsive design pass

## Layout contract

Audited at 320, 430, 768, 1280, 1440 and 1920 CSS pixels. The existing student bottom navigation remains below 1024px with visible Home, Discover, Applications, Calendar and Profile labels. Notifications remain a one-tap header action. The navigation drawer contains account controls and leader destinations. Desktop navigation and existing view IDs are unchanged.

Applicant management now uses a divided, full-width list below 768px. Each entry includes identity, education, status, round, score and review state from the same authorized dataset as the desktop table. Search and filters are shared; mobile has explicit sorting and direction controls. The same applicant drawer handles evaluations and status updates. Closing it restores focus to the visible representation of the applicant. Table density controls only appear with the table.

Detailed roster permission comparisons retain a horizontally scrollable region with keyboard access and guidance to use a larger screen. This does not add persistence to the existing roster preview.

## Shared controls and overlays

- Dialog and sheet close buttons have 44px targets.
- Confirmation dialogs scroll within the dynamic viewport and use the shared overlay/modal stack.
- Sheets are limited to the dynamic viewport height; overlays contain overscroll.
- Mobile inputs use 16px text to avoid automatic iOS form zoom without disabling user zoom.
- Coarse-pointer form controls, buttons, tabs and menu options have a 44px minimum height.
- Safe-area viewport support and side/bottom insets complement existing bottom-navigation padding.
- The viewport requests keyboard-driven content resizing where supported. Native device keyboard behavior still needs physical iOS/Android testing.

## Public site

The recruitment demonstration uses an immediately readable final snapshot at 800px and below, with three representative candidates on small phones. It does not run the desktop interval or wait for staged cards. Desktop choreography is retained; reduced-motion remains respected. Existing mobile scroll-depth disabling, shorter section movement, responsive campus imagery and non-sticky mobile storytelling remain intact.

## Validation scope

Browser checks use local Chromium and isolated fixture transport, never real applicant writes. Six-width layout checks cover public landing, discovery and club profile, home, applications, profile, calendar, notifications, populated applicant management, interview mode, voting mode, and secondary public/admin destinations. Application forms and profile dialogs also run at short viewport heights. Functional checks cover search/filtering, applicant review, status confirmation, interview save-before-next, voting failure recovery, application save/submit, agenda and notification interactions, and keyboard dismissal.

The standalone database-backed club route can only be checked in its unavailable state locally; the populated club profile component is checked through the fixture-backed directory. OAuth callback and API routes have no standalone responsive UI. No live database, actual OS keyboard, or physical safe-area device validation is claimed.

Final check results are recorded in the task completion report. Existing unrelated failures are four club-customization test fixtures, two nullable-context TypeScript errors, and missing ESLint tooling. No dependencies or database semantics changed.

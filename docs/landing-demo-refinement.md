# Focused landing product demonstrations

The homepage contains eleven simulated product demonstrations inside `FeatureOrbit`: five student scenes and six club leader scenes. Both hero variants also contain six rotating text cards; those are feature statements rather than product workflows and retain their existing design and playback. The old `recruitment-demo-data.ts` model is not mounted on the homepage.

## Before and after

Every new vignette takes **6.6 seconds**: 2.3 seconds to read the prepared state, 0.9 seconds of cursor travel, 0.6 seconds of hover, a 0.14 second click, a 0.26 second response, then a 2.4 second result hold. Completion stays visible until Replay. These are focused excerpts of existing product workflows, using fictional local sample data.

| Track | Demo | Previous action sequence | New principal action → visible result |
| --- | --- | --- | --- |
| Student | Discover | Type search → select club → open profile | View club → club focus and open recruitment appear |
| Student | Apply | Type answer → save draft → review → submit | Submit reviewed application → submitted status and review confirmation |
| Student | Interview | Open invitation → select time → confirm | Confirm prepared time → confirmed booking with date, time and room |
| Student | Track | Select application → open interview details | View application → confirmed interview and next step appear |
| Student | Belong | Accept offer → My Clubs → member workspace | Accept offer → active membership and workspace access confirmation |
| Leader | Set Up | Edit profile → type description → save | Save prepared description → public profile update confirmed |
| Leader | Recruit | Type question → save → applicants tab → select applicant | Save prepared required question → application setting confirmed |
| Leader | Review | Select applicant → evaluation tab → score menu → choose score → save | Save prepared evaluation → scores and note recorded for the team |
| Leader | Interview | Review rooms → Auto-Fill → edit session → replacement menu → select replacement → review → publish | Auto-Fill Panels → staffed **unpublished draft** with zero hard conflicts |
| Leader | Decide | Read evaluations → select acceptance → record | Record selected acceptance → offer pending the student’s response |
| Leader | Manage | Announcement tab → publish → confirm → tasks → open submission | Assign reviewed task → welcome brief assigned to three named recipients |

Application review, interview time selection, task recipient review, and decision selection are explicitly prepared starting states. Scheduling ends at a proposal; owner approval and publication are outside this demonstration. An accepted recruitment decision creates an offer, while student offer acceptance creates membership. No backend or real product workflow changed.

## Structure and presentation

- `demo-timelines.ts` defines a single-action timeline and a specific result for every scene.
- `demo-clock.ts` retains finite playback, pause/resume, offscreen and hidden-tab suspension, and reduced-motion completion.
- `product-motion.tsx` uses the same elapsed time for the product result, cursor and progress. It no longer simulates typing, changes between multiple pages, or scrolls miniature interfaces to find controls. One coordinator selects the active settled scene with prominence hysteresis.
- `journey-scenes.tsx` shares one `Focus` structure: a screen title, a close product crop, a focal button, and a reserved result area. Unrelated navigation and dashboard content have been removed. Interface icons continue to come from `@/components/icons` and Phosphor.
- `FeatureOrbit` keeps native scroll-driven rotation and its existing upright reading interval. Laptop/desktop copy sits beside a taller, narrower product surface. Tablet and phone use the vertical composition. Very narrow screens (under 380px), short viewports and reduced motion use the readable stacked fallback.

At 1440×900, panels are approximately 700×680px (previously 1040×504px). At 1366×768, panels are approximately 700×552px (previously 1040×430px). At 390×844, panels are 350×550px (previously 350×430px). Product text is generally 14–24px on desktop and 13–21px on phones; focal buttons use 14–15px text and 48–52px height. The navy, paper, orange accents, typography and artwork remain the existing OutClass system.

## Validation

The enhanced browser suite in `scripts/verify-autoplay-demos.cjs` checks both tracks independently, selecting each chapter through the actual orbit geometry. For every scene it verifies the starting and completed states, no vertical or horizontal interface clipping, readable button type, a fully visible focal button, pinned frame fit, a visible aligned cursor click, fixed frame dimensions, one active clock, progress, Pause/Resume, Replay, and completion without looping.

It also checks audience persistence and URL precedence, hydration, inert observational controls, repeated replay, hidden-tab suspension, reverse scrolling, small scroll movements, resizing while moving and paused, audience cancellation, reduced-motion static previews and absence of API mutations.

Final validation passed against the production build in Chrome: **143 scene/viewport cases across 13 sizes**, independently covering both tracks. Sizes: 1920×1080, 1440×900, 1366×768, 1024×768, 900×760, 899×900, 768×1024, 768×900, 390×844, 380×844, 360×844, 360×800 and 320×844. The separate lifecycle, keyboard, audience, and reduced-motion checks passed, with zero browser errors, hydration warnings or API mutations. Representative completed screens were visually inspected at desktop, tablet and phone widths.

All **43 relevant tests**, standalone typecheck, lint and the final production build passed. Lint reports 26 existing warnings outside the changed demonstration code and no errors.

Run against a local server on port 3015:

```sh
node --test tests/product-motion.test.cjs tests/feature-orbit.test.cjs tests/journey-navigation.test.cjs tests/landing-perspective.test.cjs tests/public-navigation.test.cjs tests/student-journey.test.cjs tests/recruitment-demo.test.cjs
OUTCLASS_LANDING_QA_DIR=/tmp/outclass-focused-demo-qa node scripts/verify-autoplay-demos.cjs
npm run lint
npm run typecheck
npm run build
```

Browser screenshots and machine-readable results are written to the chosen QA directory.

# Landing demonstration optimization

Both landing audiences retain their original sections, fictional product data,
SEO-visible headings, automatic playback, progress, Pause/Resume and Replay.
No dependency, account workflow, database or deployment changes are required.

## Playback

| Audience | Demonstration | Before | After | Shorter |
| --- | --- | ---: | ---: | ---: |
| Student | Discover | 13.76s | 7.99s | 42% |
| Student | Apply | 20.08s | 11.67s | 42% |
| Student | Interview | 12.86s | 7.09s | 45% |
| Student | Track | 9.84s | 6.06s | 38% |
| Student | Belong | 12.86s | 7.09s | 45% |
| Club leader | Set Up | 15.06s | 8.89s | 41% |
| Club leader | Recruit | 17.88s | 10.17s | 43% |
| Club leader | Review | 20.10s | 11.05s | 45% |
| Club leader | Interview Scheduling | 27.94s | 14.24s | 49% |
| Club leader | Decide | 12.86s | 7.09s | 45% |
| Club leader | Manage | 20.10s | 11.05s | 45% |

The simple two-step status preview finishes in 6.06 seconds. Scheduling retains
all seven actions, including draft adjustment, plan review and owner confirmation,
so it takes 14.24 seconds. No consequential workflow step is skipped.

Most savings come from idle time: introduction 1200 → 400ms, pre-click hover
420 → 100ms, normal outcome hold 1800 → 850ms, final hold 2600 → 1600ms,
and response fade 480 → 260ms. Normal cursor travel changes modestly from
760 → 650ms; nearby menu actions use 420ms. A smoothstep path accelerates
and decelerates to rest, with the existing subtle arc and a 120ms click.
Typing remains visible and preserves the complete answer/description.

The six-card hero carousel changes from 5400ms idle + 480ms transition per card
to 3200ms + 360ms: approximately 35.28 → 21.36 seconds per full cycle.
Its motion, hover/focus pause, manual navigation and reduced-motion behavior remain.

## Responsive layout

The demo interface uses a viewport-aware height (`clamp(236px, 31svh, 320px)`),
a compact toolbar/context/caption, and ordinary readable 11–13px interface text.
The resulting desktop frame heights are approximately:

| Viewport | Frame height | Viewport share |
| --- | ---: | ---: |
| 1366 × 768 | 378px | 49% |
| 1440 × 900 | 419px | 47% |
| 1920 × 1080 | 460px | 43% |

Desktop frames are roughly 730px wide. Headline, description and complete frame
fit together at all three laptop/desktop sizes. A single column serves tablet
and phone. On a 390px phone the preview is 350px wide and approximately 498px
tall; controls retain 44px touch targets. Headlines retain the existing typeface,
navy/orange palette and section order.

Content scrolls within the preview instead of shrinking the whole UI. The same
clock reveals a target before its click. View changes reveal the next page or
final result, and action footers stay visible. Hidden views no longer reserve
the tallest layout, so replay and state changes do not shift the enclosing frame.
The observed baseline frames were approximately 717–994px tall across the audited
viewports; updated frames are approximately 378–498px.

## Performance and accessibility

One prominence coordinator continues to run only one demonstration at a time.
Offscreen or hidden-tab time is excluded; completed demos remain stopped until
Replay. Frame-by-frame work uses direct progress/cursor updates instead of React
state updates. Targets are measured at action/view changes or resize, not every
frame, and unchanged scroll positions are not written repeatedly. Reduced motion
shows a completed, static preview with Replay still available. The observational
interface stays inert and outside the keyboard tab order; the readable summary,
progress semantics and real playback controls remain accessible.

## Reproducing verification

Final verification: all 11 journey demos passed at 1366×768, 1440×900,
1920×1080, 768×1024 and 390×844, including every visible cursor target and
unchanged frame dimensions throughout playback. Additional checks passed for
moving/paused resize, hidden tabs, offscreen resume, repeated Replay, keyboard
navigation and reduced motion at 320×844, 1024×768 and 844×390. Both hero
variations passed desktop/phone autoplay, Pause, Previous/Next and text-fit checks.
The screenshot gallery contains 39 before/after pairs (33 journey + 6 hero).

The full automated suite completed with 1,163 passes and 25 skips. Its single
pre-existing failure is `tests/loading-experience.test.cjs`, which expects the
old `/brand/14-favicon.svg` instead of the current premium-board favicon.
Typecheck and the final production build pass; lint passes with 28 existing
warnings and no errors. No deployment was performed.

Start the local app on port 3015, then run:

```sh
node --test tests/product-motion.test.cjs tests/journey-navigation.test.cjs tests/landing-perspective.test.cjs tests/public-navigation.test.cjs tests/recruitment-demo.test.cjs tests/student-journey.test.cjs
OUTCLASS_LANDING_BASE_URL=http://127.0.0.1:3015 OUTCLASS_LANDING_QA_SCREENSHOTS=0 node scripts/verify-autoplay-demos.cjs
OUTCLASS_LANDING_BASE_URL=http://127.0.0.1:3015 node scripts/verify-hero-previews.cjs
OUTCLASS_DEMO_AUDIT_URL=http://127.0.0.1:3015 node scripts/audit-landing-demos.cjs after
npm run lint
npm run typecheck
npm run build
```

The visual audit writes measurements, screenshots and an `index.html` comparison
gallery under `/tmp/outclass-demo-optimization`. Journey captures show the page's
native reduced-motion completed presentation so comparisons are repeatable.
Hero reference screenshots apply the original HEAD hero stylesheet in the browser;
they do not roll back source files. Browser playback verification checks every
real target at every action on desktop, tablet and phone, including target
visibility, click alignment, unchanged frame size, progress, replay and pause.
It also exercises hidden tabs, offscreen resume, audience switching, mid-movement
and paused resizing, keyboard behavior and reduced motion in narrow/landscape views.

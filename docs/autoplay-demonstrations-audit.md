# Autoplay product demonstrations

October 14, 2026 · Branch `codex/cinematic-product-demos` · Local implementation only.

## Audit before implementation

Inspected the public production homepage and the existing source before editing.
The page already had five student chapters and six club leader chapters, a shared
audience hook, semantic chapter mapping, floating navbar handoff, native section
reveals, replay/pause controls, and the interactive public footer. The audience
default was Students, with URL/legacy-fragment selection but no saved public
audience preference. The main, desktop compact, and mobile compact selectors
already shared one state and must continue doing so.

Each old demonstration owned a finite requestAnimationFrame controller with
roughly twenty interface beats. Most ran for 2.7–4.2 seconds; interview scheduling
ran for 6.6 seconds. There was no shared prominence arbitration, cursor, or
timeline progress bar. The miniature controls were real local sample controls.
The hero's separate marketing carousel and native scroll reveals were inspected
and preserved. No motion library or new dependency is necessary.

Inspected the corresponding authenticated source, including:

- `components/views/club-manager/application-builder-view.tsx`: required questions,
  saved recruitment settings, shared profile and club-specific answers.
- `components/views/application-tracker-view.tsx` and
  `components/interviews/booking-picker.tsx`: application progress, invitations,
  selecting a time and explicitly confirming a booking.
- Application review/evaluation views: identified application detail and rubric
  scoring. Anonymous rounds hide identity and free-text/attachment content, so
  the public review walkthrough uses an identified round throughout.
- `components/interviews/room-manager.tsx` and
  `components/interviews/panel-preview-workspace.tsx`: confirmed availability,
  room/session settings, Auto-Fill proposal, manual replacement, review of the
  exact plan, and separate owner confirmation before publication.
- Recruitment offer and membership workflows: recording acceptance issues an
  offer; membership starts only when the student accepts it.
- `components/organization-member-management.tsx`,
  `components/club-announcements.tsx`, and task/submission views: roster,
  announcement confirmation/publication, and reading submitted member work.

All examples remain fictional, using Jordan Avery and Jefferson Investment
Society. No authenticated functionality, API mutation, schema, or account role
behavior was changed.

## Public audience preference

New visitors start with Club Leaders. Manual selections persist as
`outclass-landing-audience=students|club-leaders` in localStorage and a matching
public preference cookie. The cookie lets the server render the returning
visitor's selected audience immediately. Explicit audience query parameters or
legacy audience fragments win for that navigation, without overwriting the saved
manual choice. Legacy fragments retain their existing precedence over a query.

A small pre-paint CSSOM gate hides only mismatched public landing markup for a
storage-only preference or legacy fragment until the layout effect resolves it.
It does not mutate React-owned HTML, suppress hydration errors, or affect auth
screens. Blocked preference storage still permits an in-memory manual choice.
Existing account/workspace guards run before public preference processing.

## Shared playback

`demo-timelines.ts` defines actions and absolute phases. `demo-clock.ts` is the
single finite clock for cursor motion, typed text, UI response opacity, progress,
and completion. Movement lasts 760ms, hover 420ms, press 160ms, response 480ms,
ordinary results 1.8s, and final results 2.6s. Text entry has its own readable
duration within the same timeline. Track is deliberately shorter; scheduling has
seven actions and needs more time.

| Audience | Demonstration | Seconds | Main sequence |
| --- | --- | ---: | --- |
| Students | Discover | 13.76 | Search → select club → open profile |
| Students | Apply | 20.08 | Response → save draft → review → submit |
| Students | Interview | 12.86 | Invitation → time → confirm |
| Students | Track | 9.84 | Application progress → booking details |
| Students | Belong | 12.86 | Accept offer → My Clubs → member workspace |
| Leaders | Set Up | 15.06 | Approved profile → description → save |
| Leaders | Recruit | 17.88 | Required question → save → pipeline → applicant |
| Leaders | Review | 20.10 | Applicant → evaluation → score menu → 4/5 → save |
| Leaders | Interview Scheduling | 27.94 | Availability → rooms → draft → adjust → exact-plan review → owner approval |
| Leaders | Decide | 12.86 | Evaluation → acceptance → record offer |
| Leaders | Manage | 20.10 | Announcement → confirmation → publish → tasks → submission |

The cursor measures each actual rendered target, including dropdown options, and
uses a restrained curve with deceleration. It remeasures after a resize, clamps
to the interface, and never intercepts input. A three-pixel bottom progress bar
uses the same elapsed time. Replay cancels the old frame and resets UI, typed
values, cursor, press state, and progress. Completion remains at 100% without
looping.

One journey coordinator chooses the most prominent visible frame, with hysteresis
and a short-viewport threshold. Offscreen, hidden-tab, and explicit pauses retain
the elapsed position. Paused and completed clocks have no pending playback frame.
React receives only meaningful UI/status changes, while cursor/progress update
imperatively. UI fades also use clock values, so they freeze with the cursor.

Only the observation surface is inert and hidden from assistive technology.
Every demo has an accessible static description. Pause/Resume, Replay, website
CTAs, navigation, audience selectors, and footer controls remain real controls.
Reduced motion shows the completed interface and keeps Replay available without
starting motion. Hidden views reserve space to avoid frame height changes.

## Verification

- Full automated suite: 1,116 passed, 24 skipped, no failures.
- Targeted public navigation, auth boundary, SEO, audience preference, and finite
  clock tests pass. Lint, typecheck and production build pass; lint reports the
  repository's existing warnings.
- Existing floating navigation browser suite passes nine widths, both controls,
  keyboard handoff, direct chapter links, account routes and rapid/reverse scroll.
- Existing scroll cue suite passes ten viewport sizes, keyboard activation,
  history/focus, native fragment navigation and reduced motion.
- Existing footer browser suite passes seven viewport sizes, dialogs/focus,
  same-document audience navigation, cursor repulsion, spring return, bounds,
  zero idle/offscreen writes, reduced motion and Back to Top.
- Chrome and WebKit: all eleven scenes pass at 1440×1000, 390×844 and 768×1024
  (66 scene/viewport checks). Every
  action is checked against its rendered target before its UI response. Progress,
  cursor and response opacity stay frozen together during Pause. Frame height
  remains stable, final progress stays at 100%, and there is no horizontal overflow.
- Replay stress, audience cancellation, single prominent playback, offscreen
  pause, reverse/rapid scrolling, first paint, saved preference and URL precedence
  pass. Reduced motion passes at 320×844, 1024×768 and 844×390 for both audiences.
- Keyboard testing confirms Tab skips the inert interface and Enter operates
  Replay; actual on-screen mouse clicks cannot operate miniature controls.
- A separate storage-only first-paint probe shows only Students when that saved
  preference differs from server markup. A mid-response-fade pause also preserves
  the exact UI opacity, cursor transform and progress for three simulated seconds.
- All eleven desktop, tablet and phone screenshots were visually inspected,
  including review menus, typed fields, schedule adjustments and final approval.
- A separate native-clock scheduling run shows all seven presses and eight UI
  states in order, one active demonstration, and completion after 28.48 seconds
  for the 27.94-second definition. The clock deliberately limits a large frame
  hitch rather than skipping several actions.

Tab visibility is tested by simulating `document.hidden` and dispatching the
browser visibility event; it is not a physical OS tab-switch recording. The
browser suites run against a local production build, use fictional information,
and observe no page errors, hydration errors or API mutation requests.

Evidence, including per-action desktop/phone captures and all tablet completed
states, is saved outside the repository:

- [Chrome results](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-autoplay/chrome/autoplay-verification.json)
- [WebKit results](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-autoplay/webkit/autoplay-verification.json)
- [Native playback](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-autoplay/native-playback.json)
- [Desktop owner approval](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-autoplay/chrome/1440-action-7-leader-interview.png)
- [Phone owner approval](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-autoplay/chrome/390-action-7-leader-interview.png)

The compatibility entry point `scripts/verify-landing-journeys.cjs` now runs
`scripts/verify-autoplay-demos.cjs`; its former editable-miniature checks were
replaced because the requested public interfaces are now observational.

Three fresh local production Chrome loads transferred 283,646 encoded bytes of
JavaScript and 49,092 bytes of CSS. Compared with the saved footer baseline,
that is +3,620 bytes JavaScript (1.29%) and +1,273 bytes CSS (2.66%). Median script
work over five seconds viewing the first demo was 26.94ms. The new default leader
journey contains six scenes, so DOM counts differ from the previous student
default. These local measurements are not field Core Web Vitals or a paired
performance benchmark.

No deployment was performed.

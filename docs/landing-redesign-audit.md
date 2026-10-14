# Landing redesign: dual-audience audit and implementation

Audit date: October 14, 2026. Branch: `codex/landing-unified-journeys`.

## Existing experience

The public entry uses `LandingPageView`, the campus photograph/feature carousel,
launch-club directory, `ProductJourney`, final invitation, and shared public footer.
SEO metadata and structured data live in `app/page.tsx` and `lib/seo.ts`.
Those routes and metadata do not need changes.

Students have Discover, Apply, Interview, Track, and Belong. Discovery filters a
list but never opens a profile. Application progress ends in submission without
showing the actual review/submit action. Interview shows an already chosen time,
not the booking picker. Track and Belong have consistent sample club context, but
acceptance incorrectly appears to turn into membership without an offer response.

Leaders have Set Up, Review, Interview, Decide, and Belong. Set Up mixes questions
and rounds; there is no dedicated active-recruitment view. Review shows rubric
values without selecting an applicant or saving an evaluation. Interview shows
collaborative notes but omits availability, rooms, auto-fill draft, owner approval,
and publication. Decisions appear from vote totals without the leader's action.
Management has tasks but little roster/access context. The hero and introduction
continue describing students when leaders are selected.

Both use cream/navy branding, DM Sans/Libre Caslon, identical frames and sample
identities. Alternating columns and abrupt linen/paper/navy/blue surfaces interrupt
continuity. Fixed desktop frames contain substantial empty space. Mobile avoids
horizontal overflow, but scenes remain passive and key interactions are absent.

## Shared architecture and baseline

`useLandingPerspective` owns both controls; `useJourneyNavigation` handles their
floating-header handoff, including focus transfer and hysteresis. Preserve this.
Switches keep absolute scroll position, which only works because both currently
have five chapters. Semantic chapter mapping is needed for six leader chapters.

`ProductMotion` uses a finite visibility-based clock, pause/replay, reduced-motion
final states, and hidden-tab/offscreen suspension. Preserve its lifecycle and
reduce React publications from 25/second to meaningful progress beats. Simple
state transitions can use CSS and existing icons; no new animation dependency.

Browser baseline: both complete journeys at 1440, 768, and 390 px; no page errors
or horizontal overflow. Desktop page heights: students 5960 px, leaders 5890 px.
Mobile heights: students 7173 px, leaders 7196 px. Each audience has five scenes.
Screenshots and same-machine production performance measurements are retained
under `/tmp/outclass-redesign-qa`; dev transfer sizes are not production budgets.

## Product references and truthfulness

Inspected the actual shell, discovery, application editor/tracker, My Clubs,
recruitment review settings, club workspace, booking picker, panel preview and
publication workspace, claiming policy, and durable recruitment-offer workflow.

- Shared student profile plus club-specific answers; explicit Save draft,
  Review & submit, and Submit application.
- Booking: select a date and a time, then explicitly confirm.
- Claims require approval; pending claims grant no management access.
- Panel auto-fill creates an unpublished proposal. Review & Publish opens final
  approval; Confirm & Publish Panels is an explicit owner action.
- Accepted decisions issue membership offers. Students must accept the offer
  before ordinary membership appears in My Clubs.
- Anonymous review is configurable per round; identity visibility must not be
  implied when anonymous mode is selected.
- Members, access permissions, meetings, tasks, and announcements are supported.

Marketing samples remain fictional and local. No marketing scene imports actions,
auth clients, ORM clients, or production mutation endpoints.

## Controlled implementation plan

1. Shared foundation: scoped motion tokens, continuous warm background, stable
   product frames, connected chapter rail, semantic audience-position mapping,
   equal audience-specific hero/introduction, and six leader chapter links.
2. Student scenes: search/list → selected profile; attached profile → saved draft
   → review/submit; invitation → time choice → confirmation; interview → decision;
   accepted offer → explicit response → My Clubs/member workspace.
3. Leader scenes: approved workspace/profile → questions/rounds → active pipeline
   → selected applicant/rubric → availability/rooms → auto-fill proposal → final
   approval/publication → recorded decision/offer → roster/member tasks.
4. Both audiences: desktop/tablet/phone screenshots, all manual demo actions,
   slow/fast/reverse scroll, both toggles, direct/legacy anchors, keyboard, reduced
   motion, offscreen playback, unchanged navigation, performance comparison,
   relevant tests, full lint/typecheck and production build. No deployment.

## Completed redesign

The existing hero, navigation handoff, launch-club section, invitation, footer,
signup/login routes, and SEO remain in place. Chapters now share a continuous warm
surface, consistent product chrome, readable inline demos, linked next steps, and
the same sample club/applicant. The leader hero and introduction tell the leader
story rather than retaining student copy.

Students have five interactive stages. Leaders have six, with a separate Recruit
stage and a five-step interview demonstration: Availability → Rooms → Auto-Fill
Proposal → Final Owner Approval → Published Schedule. Offers and membership are
explicitly separate. Anonymous examples hide the candidate identity. All actions
inside the demos use local sample state; no production actions are imported.

Both toggles use one state. Equivalent tasks retain their relative reading
position, including Student Interview ↔ Leader Interview and Belong ↔ Manage.
Native history updates prevent a delayed server navigation from overriding that
position. Chapter URLs retain their audience and existing campaign parameters.
Question/answer edits and confirmed interview times carry between relevant scenes
and audiences. No new dependencies or authenticated dashboard changes were needed.

Motion uses scoped 160 ms interaction, 260 ms state, and 440 ms scene tokens with
one easing curve. Examples publish at most twenty progress beats, finish once,
pause offscreen/in hidden tabs, and support pause/replay. Keyboard inspection pauses
automatic playback. Reduced motion starts with a readable completed example and
still supports deliberate interactions; manually chosen states survive scrolling.

## Final verification

Production browser QA passed in Chrome and Playwright WebKit at 1440×1000,
390×844, 320×844, 540×844, 768×1024, 1024×768, and 844×390. All eleven stages were
checked in both engines, including manual inputs, saved drafts, submission,
alternative booking times, anonymous evaluation, draft return/edit, explicit panel
publication, waitlist/accept decisions, membership offers, access, announcements,
and submissions. Finite automatic playback, pause/resume/replay, fast jumps,
reverse scrolling, keyboard operation, reduced motion, legacy links, direct leader
chapter entry, stable header geometry, and delayed audience switching passed.

- No horizontal overflow, browser page errors, or marketing API mutations.
- Existing Get Started, Log In, Request Your School, About, and UVA routes returned
  HTTP 200; the navigation links retain their original destinations.
- Existing navigation regression checks passed across nine viewport widths.
- Existing scroll-indicator checks passed across ten viewport sizes, keyboard,
  native history, navbar clearance, and reduced motion.
- Full unit suite: 1,091 passed, 15 environment-dependent tests skipped. Focused
  final motion/navigation/public-boundary/SEO suite: 42 passed after the last fixes.
- Standalone typecheck, full lint, and production build passed. Lint retains 28
  warnings in untouched files; changed implementation files have no lint warnings.
- Fresh anonymous browser checks of the live public page confirmed the audited
  five-stage student/five-stage leader baseline and student-only leader hero copy.
- Screenshots of both full journeys and every individual stage were captured and
  visually reviewed. No deployment was performed.

## Before / after performance

Same machine, local production server, Chrome, 1440×1000, three fresh browser
contexts per version. Values below are medians. Script/task measurements cover
five seconds after scrolling into Discover; encoded bytes use Resource Timing.

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Encoded JavaScript | 273.7 kB | 277.2 kB | +1.3% |
| Encoded CSS | 45.6 kB | 46.8 kB | +2.7% |
| Initial DOM elements | 1,017 | 1,259 | +23.8% |
| First contentful paint | 88 ms | 88 ms | Unchanged median |
| Demo script work / 5 seconds | 32.0 ms | 27.8 ms | −13.3% |
| Total browser task work / 5 seconds | 188.5 ms | 225.3 ms | +19.6% |

The richer interfaces reserve alternative states to avoid layout jumps, adding
DOM/layout/paint work. Animation JavaScript work decreased; the added encoded JS
is 3.5 kB, with no additional dependency. Only the selected audience is mounted,
and offscreen examples do not advance. These small local samples are comparative
diagnostics, not field Core Web Vitals or a physical-device mobile benchmark.

## Reproduce and inspect

Run `node scripts/verify-landing-journeys.cjs` against the local dev server.
Set `OUTCLASS_LANDING_BASE_URL` to the local production preview and
`OUTCLASS_LANDING_BROWSER=webkit` for WebKit. The script accepts loopback hosts
only and does not submit production account or school-request forms.

Screenshots and raw performance/verification JSON are saved in:

`/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-redesign/`

The `chrome` and `webkit` directories contain full-journey captures at tablet,
phone, and landscape widths, individual desktop/phone stage captures, the panel
proposal before approval, and the equivalent Interview audience handoff.

- [Student journey — desktop](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-redesign/chrome/verified-1024-student-full.png)
- [Club leader journey — desktop](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-redesign/chrome/verified-1024-leader-full.png)
- [Student journey — phone](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-redesign/chrome/verified-320-student-full.png)
- [Club leader journey — phone](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-redesign/chrome/verified-320-leader-full.png)

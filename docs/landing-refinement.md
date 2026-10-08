# Phase 1: landing refinement

Implemented October 7, 2026 against the supplied OutClass reel review. The requested
`docs/outclass-reel-review.md` was absent; the attached review was read in full.

## Changes

- Combined the slogan and practical introduction into one hero. The single h1
  preserves “One profile. Every opportunity.”, followed by UVA context and a
  concrete discovery/application/interview explanation.
- Retained the football/Lawn split panels, diagonal seam, sunset Rotunda underlay,
  existing image assets, wordmark, Caslon family, and brand palette. Panels open
  behind readable content as the hero scrolls away. Removed the extra pinned
  introduction and the animation that concealed the product explanation/actions.
- Added a native “Explore the demo” link to the existing public student preview
  at `/preview?view=student-dashboard`. Kept profile creation and leader entry
  callbacks intact; no Demo Mode access rules or data operations changed.
- Reused the existing custom discovery scene as a compact, immediately populated
  hero example. Its caption identifies illustrative/sample information. No iframe,
  new illustration, animation dependency, or second application/provider tree.
- Adjusted hero typography, copy width, CTA spacing, preview sizing, and responsive
  stacking. Added a short-landscape treatment. Kept the `#landing-content` anchor;
  the scroll cue now goes directly to the product overview.
- Kept walkthrough interface content visible when playback initializes or a
  perspective changes. Completion checks/confirmations still enter at their
  original beats; status changes, progress, text, selection, voting, pause/resume,
  finite playback, visibility handling, and reduced-motion behavior remain.

Changed implementation files: `landing-intro.tsx`, `landing-hero.tsx`, `intro.css`,
`hero.css`, and `journey.css`, all under `components/landing/`.

## Verification

- Full Node suite: 837 tests, 830 passed, seven environment-dependent skips,
  zero failures. Targeted landing/motion/SEO/login/loading suite: 36 passed.
- `npm run lint`: zero errors, 25 existing warnings outside changed files.
- `npm run typecheck`: passed after regenerating the stale local Prisma client
  using the existing schema. No schema or database changes.
- `OUTCLASS_PUBLISH_BUILD=1 npm run build`: passed.
- Real Chrome checks at 1440×900, 1280×720, 390×844, 320×740, 844×390, and
  reduced-motion desktop: HTTP 200, no page exceptions, no horizontal overflow,
  one slogan h1, loaded hero images, and zero axe WCAG A/AA findings.
- Hero actions fit above the fold at each checked size. Desktop preview also fits;
  mobile stacks the complete preview below the actions.
- Clicked the demo link and reached the existing Home view. Opened and dismissed
  the profile-creation dialog.
- Verified every initial and switched student/leader scene has visible interface
  content, in normal and reduced motion; chapter headings clear sticky controls.
- Checked the 720×450 layout (the CSS viewport equivalent of 200% zoom on
  1440×900) for overflow. This is a layout check, not a substitute for every
  browser/text-zoom combination.

Optional JavaScript-disabled dev probing exposed the existing Next streaming
boundary's hidden segment behavior. This change does not alter the application
shell/streaming architecture or claim a fully JavaScript-free product. The hero's
example itself requires no playback or timer to populate; reduced motion renders
complete static walkthroughs.

Unrelated pages, backend behavior, demo scenarios, and the pre-existing
`loc-history.svg` working-tree edit were not changed. No deployment performed.

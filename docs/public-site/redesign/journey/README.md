# Homepage journey: evidence

Built from the "Sound familiar?" and "How OutClass works" sections of `../Main.mockup.html`.

## What replaced what

- **Sound familiar?** (`components/landing/scattered-tools.tsx`): tilted light-glass cards naming the
  scattered tools, `aria-hidden`, beside the "Recruitment season, minus the open tabs." copy. On phones
  the cards wrap instead of scattering, so nothing runs off the page.
- **How OutClass works** (`components/landing/journey-tabs.tsx`): replaces the scroll-pinned
  `FeatureOrbit`. It uses the `Tabs` primitive (Radix) with a segmented glass `TabsList`:
  - arrow keys, Home and End move and select
  - `aria-selected` on the tabs
  - exactly one `tabpanel`
  Each step shows:
  - the step number in upright navy Caslon
  - the title, description and detail from `journey-content.ts`
  - a light-glass sample card, labelled "Sample data"
- **Deep links**: `journeyChapters`, `equivalentJourneyStage` and `journeyChapterHref` are kept.
  - `#journey-N` anchors stay in the server HTML, so old links still scroll to the section, and the tab
    for step N of `?audience=` is selected (out of range selects the last step).
  - Choosing a tab writes the `journeyChapterHref` link with `replaceState`.
  - Switching audience keeps the task: Interview stays Interview; Decide becomes Track.
- **Audience switch**: the section has no switch of its own; the hero sets the audience. The
  `useJourneyNavigation` sentinel stays, so the header's compact switch still appears while reading the
  section, as before.
- **Bare deep links**: a `#journey-N` with no `?audience=` resolves the audience as `useLandingPerspective`
  does (query, then stored preference, then the current audience).

## Deviations

- The step number is navy, not the mockup's orange (owner decision; orange stays limited to the two places
  in the spec).
- Kickers are muted ink, not the mockup's orange-brown, per the spec's orange rule.
- Sample chips use the success, info, muted and navy tokens; the mockup's orange "active" chip is info blue.

## Checks (`scripts/check-journey-tabs.cjs`, production build)

All of these pass:
- **Keyboard**: arrows, End/Home and wrap-around; Tab moves to the panel; Shift+Tab returns to the
  selected tab.
- **One tabpanel** that is `aria-labelledby` the selected tab.
- **Deep links**: `?audience=leader#journey-4` opens Interview, `student#journey-3` Interview,
  `student#journey-5` Belong, `leader#journey-1` Set Up, and `student#journey-9` Belong. Each one
  scrolls to the section.
- **Stored preference**: a bare `#journey-3` opens Interview with a stored student preference and Review
  with a stored club-leader preference.
- **hashchange** to `#journey-5` selects Decide.
- **360, 390 and 1440, both audiences**: horizontal overflow 0, no transitions or animations under
  reduced motion, and axe 0 on both sections.

Screenshots: `scattered-*` and `about-*` for each audience at 1440 and 390.

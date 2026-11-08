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
  - the step number in upright Caslon
  - the title, description and detail from `journey-content.ts`
  - a light-glass sample card, labelled "Sample data"
- **Deep links**: `journeyChapters`, `equivalentJourneyStage` and `journeyChapterHref` are kept.
  - `#journey-N` anchors stay in the server HTML, so old links still scroll to the section, and the tab
    for step N of `?audience=` is selected (out of range selects the last step).
  - Choosing a tab writes the `journeyChapterHref` link with `replaceState`.
  - Switching audience keeps the task: Interview stays Interview; Decide becomes Track.
- **Kept**: the existing audience switch block ("Two sides of the same opportunity.") and its header
  handoff (`useJourneyNavigation`), so readers can still change audience inside the section.

## Deviations

- The step number is `--brand-ink`, not `--brand-orange`: orange is 2.51:1 on the linen canvas and fails
  axe's 3:1 large-text minimum. The spec's orange rule now names this exception.
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
- **hashchange** to `#journey-5` selects Decide.
- **360, 390 and 1440, both audiences**: horizontal overflow 0, no transitions or animations under
  reduced motion, and axe 0 on both sections.

Screenshots: `scattered-*` and `about-*` for each audience at 1440 and 390.

# Browser comment fixes — October 31, 2026

Implements the six annotated browser comments against main `14561d12`.

1. **Landing feature cards:** increase desktop card height and use a consistent gap between category and statement. Longer statements stay inside the card with aligned left edges. Smaller screens retain the previous compact card heights. Carousel controls and motion behavior are unchanged.
2. **Recruitment overview:** remove the oversized “Recruitment, in focus” masthead, tagline, and queue headline. Keep one compact Recruitment page title. Move active-cycle names, intake status, deadline, and refresh into a plain row directly above the pipeline. The loading and loaded views now share their page header.
3. **Student Home:** remove “Your campus, in motion” and the decorative circle. Use a compact Home heading, date, and short personal greeting.
4. **Application writing:** remove the horizontal progress bar. Keep required-response counts, autosave feedback, intake-closed notices, validation, and submission controls.
5. **Corkboard controls:** move Saved Clubs and the view selector alongside search and filters. Controls align on one row on desktop and use a compact two-row arrangement on phones. Existing saved-club and event-view behavior stays intact.
6. **Corkboard heading:** replace the repeated page/section introductions with “Virtual Corkboard” and “Check out events on Grounds.”

## Browser verification

The audit runs the actual local production app with authenticated synthetic student and owner accounts. It checks all six student and six leader carousel statements at each viewport, including their text bounds and left alignment. It also verifies that the quotes/circle/progress bar are gone, intake feedback remains visible, search/view/saved controls share a toolbar, desktop centers align, view switching works, and Saved Clubs still opens and closes.

**24 screen/viewport states pass**, including **48 carousel statement checks**, at 1440, 1280, 768, and 390px. No horizontal overflow or browser page errors were recorded. [Measurements](evidence/results.json).

| Screen | 1440px | 1280px | 768px | 390px |
| --- | --- | --- | --- | --- |
| Landing, student | [View](evidence/landing-student-1440.jpg) | [View](evidence/landing-student-1280.jpg) | [View](evidence/landing-student-768.jpg) | [View](evidence/landing-student-390.jpg) |
| Landing, leader | [View](evidence/landing-leader-1440.jpg) | [View](evidence/landing-leader-1280.jpg) | [View](evidence/landing-leader-768.jpg) | [View](evidence/landing-leader-390.jpg) |
| Recruitment | [View](evidence/recruiting-1440.jpg) | [View](evidence/recruiting-1280.jpg) | [View](evidence/recruiting-768.jpg) | [View](evidence/recruiting-390.jpg) |
| Home | [View](evidence/home-1440.jpg) | [View](evidence/home-1280.jpg) | [View](evidence/home-768.jpg) | [View](evidence/home-390.jpg) |
| Application form | [View](evidence/application-1440.jpg) | [View](evidence/application-1280.jpg) | [View](evidence/application-768.jpg) | [View](evidence/application-390.jpg) |
| Virtual Corkboard | [View](evidence/corkboard-1440.jpg) | [View](evidence/corkboard-1280.jpg) | [View](evidence/corkboard-768.jpg) | [View](evidence/corkboard-390.jpg) |

## Reproduce

Use the existing reserved local dashboard fixture. The audit reads its guarded config and never loads application `.env` credentials or uses production accounts.

```sh
node scripts/serve-visual-unification.cjs build
node scripts/serve-visual-unification.cjs start 3116
# Another terminal:
node scripts/check-header-refinements.cjs
```

Application-writing tests also check closed-intake draft editing, autosave, manual saves, validation, and submission confirmation. No authentication, authorization, request, or database behavior is changed.

## Validation

- TypeScript check: passed.
- Production build: passed with type and lint checks enabled.
- Lint: no errors; 22 existing warnings.
- Focused application, landing, dashboard, and student-journey tests: 30 passed.
- Additional event/UI tests: 4 passed, 1 environment-gated test skipped.
- Existing task/empty-state/saved-club browser regression: passed after updating its exact expected heading to Virtual Corkboard. No behavioral assertions were removed.
- Production browser audit: 24/24 screen states and 48/48 carousel statements passed, with no page errors or horizontal overflow.
- Full regression suite: 1551 cases; 1499 passed, 0 failed, 52 environment-gated cases skipped.

The authenticated dashboard integration test also checks the remaining-review count in the existing review queue, replacing its expectation for the intentionally removed masthead headline. Its database persistence, permission, and workflow assertions are retained.

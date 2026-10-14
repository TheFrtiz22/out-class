# OutClass public footer redesign

Implemented locally on `codex/interactive-public-footer`. No deployment or new dependencies.

## Reference and design

Inspected the [Framer Footer Field reference](https://thistle-timing-694660.framer.app/footer-field) in Chrome, including its individual letter transforms before, during and after cursor proximity. A nearby letter moved approximately 23px vertically while distant letters stayed still, then returned to its resting position. The reference was recreated with native React and requestAnimationFrame; it is not embedded.

OutClass uses its existing Libre Caslon display font for the oversized uppercase wordmark, DM Sans for navigation, deep navy `#142d4e`, warm cream `#fff7ec` and restrained orange accents. The rendered wordmark spans approximately 93% of the available field width. The existing final invitation and the footer now share one navy surface, with subtle dividers separating navigation, wordmark and information.

## Preserved behavior

- Existing home, overview, About, UVA, FAQ and Request Your School destinations remain available.
- Added audience links and the existing `/signup` and `/login` routes to grouped navigation.
- Contact, Privacy and Terms retain their existing dialogs. No policy pages or placeholder destinations were invented.
- Closing a dialog now restores keyboard focus to its opening footer control.
- Audience links reuse the existing landing perspective hook, preserve campaign parameters and stay in the current document. An edited sample application answer survives a footer audience round trip.
- Back to Top scrolls smoothly to the hero, uses instant scrolling with reduced motion and returns focus to the home control. It preserves audience and campaign parameters.
- The existing independence notice is in the bottom information row. About, UVA and Request Your School retain their additional University of Virginia disclaimer.
- Public navigation, authentication routes, SEO configuration and authenticated dashboard components were not changed.

## Interaction and accessibility

Eight character transforms are driven by a damped spring (stiffness 180, damping 26). The proximity radius adapts to typography, between 95 and 220px. Vertical displacement is capped at 22px; horizontal displacement is limited to 45% of that amount to protect spacing and legibility. No rotation, font-size animation or letter-spacing animation is used.

Letter geometry is cached and refreshed only for resizing or font readiness. Pointer movement does not update React state. The frame loop stops when the spring settles. Tracking is attached only while the field is visible, the document is active, reduced motion is off and the device has a fine hover pointer. Observers, listeners and frames are cleaned up on unmount.

The visible letters are hidden from assistive technology, with one readable OutClass text label. Touch and reduced-motion layouts use the static wordmark. Controls have at least 44px height and visible focus indicators. Native text selection and page scrolling are retained.

## Verification

`scripts/verify-public-footer.cjs` passed against the local production build in both Chrome and Playwright WebKit, at 1920×1080, 1440×1000, 1024×900, 768×1024, 390×844, 320×844 and 844×390. Both audiences were checked at every size.

Verified proportional sizing, no horizontal overflow, matching CTA/footer backgrounds, identical audience footer content, real navigation destinations, FAQ anchor, dialog focus restoration, same-document audience changes, local repulsion, unaffected distant letters, damped return, fast mouse movement, field boundaries, touch behavior, reduced motion and smooth/instant Back to Top. Observed zero letter-style writes while settled and offscreen. No browser errors or API mutations were recorded in the final runs.

The browser suite waits for streamed markup and initial requests to settle before changing pages. Early test runs that navigated before settlement exposed temporary duplicate streamed footer markup and WebKit cancellation messages from the existing session-check request; these were test navigation timing issues.

The complete student and leader journey browser suite also passed on the production preview, including sample interactions, responsive layouts, audience switching, keyboard controls and finite playback. The relevant public, SEO, audience and motion regression tests passed: 42 tests, zero failures. Typecheck, production build and lint passed; lint reports 28 existing warnings outside the new footer components.

## Runtime size

Three fresh local Chrome loads measured a median of 280,026 bytes of encoded JavaScript and 47,819 bytes of CSS. The saved measurements for the preceding landing redesign were 277,188 and 46,842 bytes respectively: an increase of 2,838 bytes of JavaScript (1.02%) and 977 bytes of CSS (2.09%). These are local resource measurements, not field Core Web Vitals or a paired performance benchmark. The footer adds no continuous animation workload when settled or offscreen.

## Review artifacts

- [Desktop footer](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/chrome/footer-1440-student.png)
- [Phone footer](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/chrome/footer-390-student.png)
- [CTA transition](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/cta-transition.png)
- [Cursor-active footer](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/chrome/footer-cursor-active.png)
- [Reference at rest](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/reference-static.png)
- [Reference with cursor proximity](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/reference-active.png)
- [Chrome results](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/chrome/footer-verification.json)
- [WebKit results](/Users/jesseklinger/.codex/visualizations/2026/10/14/01a13bd9-b064-78f2-a9a3-809a70b25604/outclass-footer/webkit/footer-verification.json)

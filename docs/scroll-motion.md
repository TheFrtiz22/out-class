# Public scroll motion

The public landing page is enclosed in `ScrollMotion`. One IntersectionObserver
observes marked descendants, with no scroll listener or per-frame React state.
Each target plays once, when it reaches the reading area, including previews
farther down tall sections. Content remains in final readable layout on the
server and before hydration. There is no hidden/pending CSS state.

## Reusable primitives

- `SectionReveal`: semantic section and motion boundary.
- `TextReveal asChild`: preserves the actual heading/paragraph and its accessible
  text; no word splitting, duplicated screen-reader text, or clipping.
- `PreviewReveal asChild`: small translate/scale for images or product frames.
- `StaggerReveal`: preserves direct child structure with Radix Slot. Use DOM or
  ref/prop-forwarding children; fragments and components discarding props should
  be wrapped in a real element. Stagger caps after four children.
- `DepthTransition`: optional native CSS view-timeline depth, with static fallback.
- `StickyStory`: desktop copy alongside a product visual; normal flow below
  1100px wide / 800px high and for reduced motion.
- `StatReveal`: shows and reveals the final formatted value and label. No count-up
  through inaccurate numbers or repeated live announcements; ready for future
  real statistics, not populated with invented marketing metrics.

Inside a section, `data-motion="context"` starts first, then text (+45ms), body
(+85ms), visual (+130ms). Optional children add at most 140ms. Micro interactions
remain 180ms; sections use the 650ms entrance token; hero signature choreography
remains separate. Movement is 4–10px, reduced to 4px on mobile. Text never drops
below .88 opacity and visuals .85. Long-section content is observed individually,
so a visual does not finish animating while still far below the viewport.

The Web Animations API is native browser tooling, not a new library. Effects
have no persistent fill and are cleaned up. The observer disconnects targets
after entry. Preference changes cancel active motion immediately; unmount clears
all observers/listeners/effects. Keyboard focus cancels motion and settles the
focused section. Browser reads occur only in effects, avoiding hydration-dependent
markup. Unsupported APIs fall back to the same static content.

## Landing adoption

Onboarding copy (not the form), club context, comparison panels, three feature
stories, pricing headings, and closing copy receive selective choreography.
Related comparison panels stagger; individual buttons, logo lists, form controls,
and embedded app contents do not. Existing links, signup and demo behavior stay
intact. The hero now shares DepthTransition instead of its bespoke scroll effect.

Borders, short orange chapter rules, related neutral surface tones, and tighter
section spacing carry the reading flow. Sticky storytelling uses CSS position,
never wheel interception or viewport locking. Depth uses transform only; there
is no animated blur, shadow, layout size, or background color. Reduced-motion
users receive normal-flow, static storytelling. No blanket will-change allocation.

## Verification

Check 320px/mobile, desktop with short/tall viewports, keyboard anchor navigation,
no JavaScript, browser without IntersectionObserver/animate/view timelines,
reduced motion (including toggling while moving), rapid scroll in both directions,
form entry, iframe controls, and returning from the app to the landing page.

Lint, TypeScript, existing tests and build were attempted, but node/pnpm are absent
in the current environment. Source/import/markup/whitespace checks are possible;
actual browser performance and visual timing remain unverified.

# Public hero

`components/landing/landing-hero.tsx` replaces only the old hero in LandingPageView.
It retains the existing logo and native `#create-account` / `#clubs` links. Account
creation, authentication, and lower product demos remain connected as before.
The unsupported "trusted by" label was replaced with neutral club-community copy.

## Visual structure

- A 34–60px editorial serif headline, UVA context, concise explanation, one navy
  primary action, and a quiet club-leader link.
- Warm canvas and pale sky treatment; a single application frame with the same
  navy, borders, typography, status badges, avatar, progress, and navigation labels
  as the product. No additional floating cards.
- `student-workspace-preview.tsx` is an illustrative DOM composition, not a live
  account. Application statuses, event dates, and profile progress are sample
  information, explicitly identified in the caption. Club names are examples,
  not endorsements. Only its demo link is interactive.
- On mobile, the headline aligns left, the preview sidebar disappears, and events
  stack beneath applications. Text stays readable rather than scaling a desktop
  screenshot. The preview link opens the existing student demo.

## Campus asset provenance

No suitable licensed campus photograph was found in public/. CampusBackdrop is
an original inline SVG architectural schematic, explicitly marked as an
illustration placeholder above the preview. It is not an official UVA mark or a
photographic representation. No third-party image was fetched or embedded.
Replace the backdrop with approved UVA imagery when available, documenting its
source and permission. Preserve reserved dimensions, meaningful cropping at
mobile/desktop sizes, and the decorative accessibility treatment.

## Motion and performance

CSS entry sequence begins immediately: header, context, headline, supporting
copy/actions, preview, then background. Maximum start delay is 180ms; content is
never gated by a timer or JavaScript, and remains visible during its entrance.
The hero uses no iframe, canvas, video, new font, large photo, or animation package.
Existing logo dimensions reserve its layout space. Replacing the former hero
iframe avoids starting a second authentication/data-provider tree above the fold.

A small optional scroll translation/scale uses native CSS view timelines only
when supported, on desktop and with no reduced-motion preference. Other browsers
get a stationary preview. No scroll handlers, wheel interception, or scroll-jacking.
Reduced-motion users get the static composition. Layout properties, shadows, and
filters are not animated. Lower-page iframes are unchanged and remain lazy-loaded.

## Verification

Check mobile at 320/390/768px and desktop at 1280/1440px, keyboard focus, CTA anchor
navigation, reduced motion, and browsers without view-timeline support. Review
placeholder/sample labels and ensure no sampled data is presented as live.

Attempted lint, TypeScript, existing tests, and build; this environment lacks
`node` and `pnpm`, so runtime/browser/LCP checks remain pending. Static import,
asset, CTA-target, CSS brace, and whitespace checks were performed instead.

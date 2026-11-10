# Homepage moments: evidence

Built from the "Big moment", "A season on Grounds" and "Features" sections of `../Main.mockup.html`.
All copy lives in `components/landing/landing-sections-content.ts`; the markup is
`components/landing/landing-moments.tsx`.

- **Decision moment**: a navy rounded band that follows the audience.
  - Leaders see a live-voting slide: applicant, a tally bar against the target, and Pass, Hold and Not pass.
  - Students see an offer card with Accept offer and Decline.
  - Both are static illustrations. Each is one `role="img"` element with a spoken summary, and its
    "buttons" are plain text in pill shapes, so nothing inside is focusable or announced as a control.
- **A season on Grounds**: six light-glass cards numbered i–vi in upright navy Caslon, captioned "A typical
  recruitment cycle".
- **Feature grid**: six text-only light-glass cards per audience, with no icons or images.

## Deviations from the mockup, by the spec

- No orange. The mockup's orange kickers and season numerals are muted or navy. The orange Hold segment of
  the tally bar uses the info blue.
- The moment headline is one colour; the mockup's accent split has no colour change there anyway.

## Checks (`scripts/check-landing-moments.cjs`, production build)

All of these pass for both audiences at 1440, 390 and 360:
- Content matches the audience, with the right action labels.
- The illustrations contain no focusable or button-role elements.
- Tabbing through the whole page (1440) never stops inside the three sections.
- Six numerals i–vi, upright; six features with no media.
- No horizontal overflow, no transitions or animations under reduced motion, and no italics.
- axe reports 0 violations.

Screenshots: `moment-*`, `season-*` and `features-*` for each audience at 1440 and 390.

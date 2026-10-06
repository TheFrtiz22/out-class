# Grounds illustrations

Original vector artwork for OutClass, composed from the supplied UVA UI moodboard's
visual direction rather than extracted from it. Five motifs: Lawn archways,
Rotunda, Jefferson profile, Monticello, and the seated Homer statue.

`rotunda.svg` references the existing `/images/landing/rotunda-lines.svg` as its
central building; do not duplicate that building's paths. The columns variant
crops the same Rotunda composition. No photographs are used.

Each SVG exposes `linework` and `accent` groups. `CampusIllustration` references
these with SVG `use`, inheriting blue-gray and orange from existing UI tokens.
The registry in `lib/campus-illustrations.ts` owns variant assets and viewBoxes;
`styles/campus-illustrations.css` owns scale, placement, crop, opacity and motion.

Use `PageHeader illustration="rotunda"` or an options object with `variant`,
`treatment`, `accent`, and `motion`. Avoid placing illustrations in filters,
controls, dialogs, or candidate information panels. They are aria-hidden and
noninteractive; narrow screens omit them. Motion is opt-in and respects reduced
motion. `/design-system` provides all variants for visual review.

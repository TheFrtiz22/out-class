# OutClass Horsham Serial typography audit

## Current system

Horsham Serial is the single application family, loaded with `next/font/local`
in `app/layout.tsx`. The font variable is applied to `html`, so all routes and
body-level portals inherit it. Next.js generates the internal CSS family name
`horshamSerial`; all seven assets belong to that same family.

Files live in `app/fonts/horsham-serial/`:

| Face | File | Registered weight |
| --- | --- | --- |
| Extra Light | horsham-serial-xlight.otf | 200 |
| Light | horsham-serial-light.otf | 300 |
| Regular | horsham-serial-regular.otf | 400 |
| Medium | horsham-serial-medium.otf | 500 |
| Bold | horsham-serial-bold.otf | 700 |
| Extra Bold | horsham-serial-xbold.otf | 800 |
| Heavy | horsham-serial-heavy.otf | 900 |

The provided Extra Light asset internally reports weight 250; its CSS registration
uses the explicitly requested 200 slot. The files themselves are unchanged.

`styles/tokens.css` and `styles/typography.css` remain the source of truth.
Tailwind v4 reads `app/globals.css` and `tailwind.config.js`. The sans, serif,
mono and display aliases all resolve to the same Horsham token. Existing
component family declarations use that token or inherit it.

Body: 400. Labels/navigation: 500. Buttons and section/card/modal headings: 700.
Page titles: 800. Marketing hero: 900. Existing semibold utilities and the shared
semibold token resolve to 700; thin resolves to 200. No 600 face is synthesized.
`font-synthesis: none` disables synthetic bold and italic. The normal font files
are the only supplied faces. A generic sans fallback is used while loading or
if the assets fail; no Google Fonts are requested.

## Previous font inventory

Geist Sans was loaded by `next/font/google`; the shared token had system sans
fallbacks. Component CSS already used shared typography tokens. Historical
references to Georgia, Times New Roman and Geist Mono in earlier documentation
were stale. The remaining hardcoded Arial declarations were standalone demo SVG
monograms and invitation emails.

Demo SVG monograms now use Horsham Bold outlines, generated into
`lib/demo/horsham-glyphs.ts`, because image SVGs cannot inherit document fonts.
Invitation emails retain Arial in `lib/invitation-email.ts`: email-client font
support differs, and backend code is outside this migration. Existing raster
logos, preview images and third-party brand artwork are unchanged.

## Verification (2026-10-02)

- PASS: `npm run typecheck`.
- PASS: `npm run lint` (0 errors; 31 existing warnings).
- PASS: `OUTCLASS_PUBLISH_BUILD=1 npm run build`.
- PASS: focused existing demo-mode and demo-provider tests (20 tests).
- PASS: production CSS contains seven normal Horsham faces with exactly the
  requested weights. `font-semibold` and `!font-semibold` compile to 700.
- PASS: source audit found no old application family overrides. Tailwind's
  generated default fallback definitions can still mention system fonts, but
  computed application families resolve to Horsham.
- PASS: Chrome confirms a custom Horsham Extra Bold face renders page titles.
- Desktop/mobile browser checks: landing, login, design-system primitives and
  modal, and public voting form. Onboarding entry was inspected on mobile.
  Computed typography was Horsham throughout the checked surfaces; no horizontal
  document overflow was observed. No account forms were submitted.
- Manual visual review remains: signed-in student/leader dashboards, club pages,
  applicant review, settings, admin, and later onboarding steps. No authenticated
  session was available for those screens.

## Asset issue: production visual acceptance FAIL

All seven supplied assets identify themselves as FONTSPRING DEMO internally.
Browser review shows DEMO watermark glyphs in ordinary content: ampersands,
email-address symbols, punctuation and some numerals are affected. This is in
these font files, not a CSS fallback or loading issue. The font integration is
complete, but production readability cannot pass with these assets. Replace
the seven files with full Horsham Serial font assets in the same slots, then
repeat visual QA. No font restrictions or watermarks have been removed.

## Files changed

- app/layout.tsx
- app/globals.css
- app/fonts/horsham-serial/ (seven OTF assets)
- styles/tokens.css
- styles/typography.css
- tailwind.config.js
- components/landing/hero.css
- lib/demo/assets.ts
- lib/demo/horsham-glyphs.ts
- docs/design-system.md
- docs/typography-audit.md

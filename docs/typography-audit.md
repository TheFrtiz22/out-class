# OutClass typography audit: Libre Caslon Text

**Current context (October 8):** The record below describes the October 2 migration away from Horsham. The later [Campus OS](outclass-campus-os.md) intentionally uses system sans for product controls/body and Caslon for display headings, scoped in `styles/product-tokens.css`. Public pages retain Caslon throughout. See [design-system.md](design-system.md) for current guidance.

Libre Caslon Text is the universal application family, self-hosted through
`next/font/local` in `app/layout.tsx`. Normal and italic variable fonts support
weights 400–700 and live in `app/fonts/libre-caslon-text/`, with the SIL Open Font
License and source provenance. There are no runtime Google Fonts requests.

All shared family tokens and Tailwind sans, serif, mono and display aliases
resolve to Caslon. Body uses 400, labels/navigation use 500, and buttons/headings
use 700. Legacy out-of-range weight utilities resolve to the closest available
endpoint. Synthetic bold and italic remain disabled. Real italics are available.
Layouts, component sizes, colors and backend behavior are unchanged.

Horsham assets and glyph data were removed. Demo SVG monograms now use Caslon
700 outlines from `lib/demo/caslon-glyphs.ts`; these standalone image SVGs cannot
inherit page fonts. Invitation emails retain Arial for email-client compatibility.
Existing raster logos and externally supplied artwork retain their own styling.

## Validation (2026-10-02)

- PASS: typecheck.
- PASS: lint (0 errors, 31 existing warnings).
- PASS: production build.
- PASS: 20 existing demo-mode/provider tests.
- PASS: compiled CSS registers normal and italic Caslon faces at 400–700;
  no Horsham references remain in compiled CSS.
- PASS: Chrome confirms actual custom Libre Caslon Text rendering.
- PASS: representative desktop/mobile checks of landing, component reference,
  cards, forms and modal; mobile login and onboarding entry were also checked.
  Production computed styles use the same Caslon family throughout these
  surfaces, with no document horizontal overflow observed. Ordinary symbols and
  numerals render normally; the previous demo watermark issue is gone.
- Manual review remains: authenticated dashboards, club/applicant pages,
  settings/admin and later onboarding steps. No authenticated session was
  available. No account forms were submitted.

## Files changed

- app/layout.tsx
- app/globals.css
- styles/tokens.css
- app/fonts/libre-caslon-text/ (two TTF assets, OFL.txt, README.md)
- app/fonts/horsham-serial/ (seven previous OTF assets removed)
- lib/demo/assets.ts
- lib/demo/caslon-glyphs.ts (added)
- lib/demo/horsham-glyphs.ts (removed)
- docs/design-system.md
- docs/typography-audit.md

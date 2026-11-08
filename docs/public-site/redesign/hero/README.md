# Homepage hero: evidence

Built from the hero section of `../Main.mockup.html`. Before = `ui/public-redesign-foundations`
(the parent of this change), after = `ui/public-redesign-hero`; both are production builds (`next start`)
in the same container.

## Screenshots

Hero only, deviceScaleFactor 2: `before-*` and `after-*` for each audience at 1440 and 390.

## Vitals (`scripts/public-site-vitals.cjs`, `/` only, median of 5)

| Profile | LCP before | LCP after | CLS before | CLS after |
| --- | --- | --- | --- | --- |
| desktop cold | 276 ms | 236 ms | 0.018 | 0.003 |
| desktop warm | 208 ms | 168 ms | 0.000 | 0.003 |
| phone cold | 1056 ms | 936 ms | 0.001 | 0.005 |
| phone warm | 504 ms | 516 ms | 0.000 | 0.000 |

The LCP element is the server-rendered `h1` in every run. Raw numbers are in `vitals-before.json` and
`vitals-after.json`. A first phone build hit CLS 0.184: Caslon swaps in after first paint
(`display: swap`, no preload, no fallback metrics), and at 35px the headline wrapped to 3 lines in Caslon
but 2 in the fallback. On phones the headline is now the previous hero's size (`clamp(1.875rem, 7.7vw,
2.5rem)`), which wraps the same in both fonts. Below 375px it also reserves three lines.

## Deviations from the mockup, by the spec's rules

- No orange except the accent word. The mockup's orange focus ring on the highlighted card, the orange
  "See how it works" underline and the orange-tinted chips are navy, cream or info tones here.
- No italics. The mockup's comment calls for Caslon italic club types; they are small upright uppercase
  Source Sans, as asked.
- The phone headline is about 30px, not the mockup's 40px (see CLS above).
- The nav keeps the existing links and labels. Only its hero-state material (navy glass) and wordmark
  (`public/brand/05-wordmark-two-color-dark.svg`) change.

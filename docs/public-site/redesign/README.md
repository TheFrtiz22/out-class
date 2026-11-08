# Public-site redesign spec

Status: approved mockups, foundation work only. No public page has been redesigned yet.

## Mockups

The approved mockups live in this folder. `Main.mockup.html` is the homepage.

`Main.mockup.html` is the design tool's export (`Main.dc.html`) of the desktop homepage. Its inline styles
carry the reference values; replicate them with the app's tokens and components, do not copy the markup.
The export's runtime (`support.js`, `vendor/`) and its `assets/` copies are not committed, so open it for
values, not for a live preview.

The mockups reference images through `/_blob/...` or `./assets/<hash>` URLs. Each one maps to an asset
already in the repo:

| Blob prefix | Repo asset |
| --- | --- |
| `84e1b7...` | `public/brand/04-wordmark-two-color.svg` |
| `4a7622...` | `public/brand/05-wordmark-two-color-dark.svg` |
| `c36aae...` | `public/images/campus/sunset-rotunda-1600.webp` |
| `c409b9...` | `public/images/campus/colonnade-960.webp` |
| `8829f7...` | `public/images/landing/jordan-avery.jpg` |
| `3e4ddc...` | `public/images/landing/jefferson-investment-society.png` |
| `36858f...` | `public/images/landing/grounds-impact-consulting.png` |

When a page is built from a mockup, use the repo asset, never the blob URL.

## Design rules

1. **Tokens.** Public pages use the app's tokens from `styles/tokens.css` and the existing `--oc-glass-*`
   materials in `styles/navigation-glass.css`. No public-only colour, radius or shadow values.
2. **Round glass everywhere.** Every surface is round glass: light glass on the warm canvas, navy glass over
   photos. Use the shared utilities below, or `Card`/`Panel` with `data-variant="glass-raised"` or
   `"glass-navy"`.
3. **Type.** Source Sans (`--oc-font-sans`) for body text. Libre Caslon (`--oc-font-display`) for headings
   only, always upright. No italics anywhere.
4. **Brand orange appears in exactly two places:** the hero headline's accent word, and "class" in the final
   call to action. Not in kickers, links, rules, dots or focus rings.
5. **No decorative icons.** The only images are logos, headshots and campus photos.

## Glass utilities

Defined in `components/landing/public-foundations.css`, built on the shared glass tokens:

| Class | Use |
| --- | --- |
| `.oc-public-glass` | Light glass on the warm canvas. Navy text. |
| `.oc-public-glass-navy` | Navy glass over campus photos. Cream text, muted kickers and notes. |

Both are round (`--oc-public-glass-radius`, default `--oc-overlay-radius`). Blur sits on an isolated
`::before` layer, so text never passes through a filter. The tokens fall back to solid surfaces where
`backdrop-filter` is unsupported, on phones, and under reduced transparency or higher contrast. Do not nest
one blurred surface inside another.

## Foundation changes (this branch)

- Added the two glass utilities above.
- Hero tagline and feature statements on the landing page moved from Caslon (the tagline was italic) to
  Source Sans.
- `docs/design-system.md` no longer says public pages use Caslon throughout.

Still to do, page by page: rebuild the homepage from `Main.mockup.html`, then the other public pages, and
remove brand orange from every place except the two allowed by rule 4.

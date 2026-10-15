# OutClass SVG identity

## Active premium-board identity

The site now uses the path-based, font-independent SVGs in [premium-board/](premium-board/README.md).

| Surface | Artwork | Path |
| --- | --- | --- |
| Light public navigation | Primary two-tone wordmark with sword | `premium-board/02_primary_lockup.svg` |
| Light-background full logo | Primary two-tone wordmark with sword | `premium-board/02_primary_lockup.svg` |
| Navy navigation, login panel, sidebar, footer | Ivory/orange sword lockup with transparent background | `premium-board/10_hero_transparent.svg` |
| Compact OC / app tile | Primary navy rounded-square monogram | `premium-board/05_app_icon_primary.svg` |
| Browser favicon and light loading | Circular OC monogram | `premium-board/07_favicon.svg` |
| Navy loading | Ivory tile OC monogram | `premium-board/06_app_icon_light.svg` |

`components/outclass-logo.tsx` is the single rendering source for in-product and marketing logos. `app/icon.tsx`, `app/apple-icon.tsx`, `app/manifest.ts`, and `components/outclass-loading-screen.tsx` manage metadata and loading marks. The legacy `public/icon.svg` file is synchronized to the same favicon artwork.

The original 16 SVGs remain in this directory for rollback and comparison. No originals were deleted.

**Palette:** navy `#0F2E56`, orange `#F26522`, ivory `#FFF9F1`.

Raster fallbacks: `/apple-icon.png` and the 32×32 browser icons are generated from the premium-board OC tiles. The email masthead uses `premium-board/email_wordmark.png` (ivory-backed wordmark) through an immutable public GitHub URL to support Outlook and other clients that do not reliably render SVGs.

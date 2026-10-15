# OutClass Premium Board SVGs

A separately preserved collection of the nine logo variants from the **OutClass Premium Brand Guidelines Board**, plus a bonus hero with a transparent background. Each SVG contains path-based vector artwork, not an embedded screenshot or a dependency on a hosted font.

| File | Intended use |
| --- | --- |
| `01_hero_on_navy.svg` | Full-color hero artwork on a navy backdrop |
| `02_primary_lockup.svg` | Primary navy/orange wordmark and curved sword, transparent |
| `03_stacked_lockup.svg` | Compact stacked composition with sword |
| `04_wordmark_no_sword.svg` | Two-tone serif wordmark without sword |
| `05_app_icon_primary.svg` | Rounded-square navy OC monogram |
| `06_app_icon_light.svg` | Light rounded-square OC monogram |
| `07_favicon.svg` | Circular navy OC monogram |
| `08_monogram_no_sword.svg` | Transparent OC monogram |
| `09_monochrome_lockup.svg` | One-color wordmark and sword |
| `10_hero_transparent.svg` | Hero artwork without backdrop |

**Brand palette:** Navy `#0F2E56`, orange `#F26522`, ivory `#FFF9F1`.

## Using these files in Next.js

From a React component, reference files by paths beneath `/public`, for example:

```tsx
<img src="/brand/premium-board/02_primary_lockup.svg" alt="OutClass" />
```

Or use an equivalent `next/image` integration with fixed dimensions. The vector artwork scales cleanly. Use the transparent-background assets when compositing over your own surfaces.

## Relationship to existing live logos

These files **do not replace or rename** any previously used `/public/brand` identity assets. They are available for review and future site integration; existing components and favicon references are intentionally unchanged.

## Source and limitations

These are traced vector reconstructions based on a raster brand board. They are close visual matches but not original designer-authored editable master artwork, and fine details may differ from the source.

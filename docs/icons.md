# OutClass icon system

All interface icons use **Phosphor**, from the official `@phosphor-icons/react` package. Import named exports from `@/components/icons` in navigation, controls, cards, dialogs, loading indicators, and empty/error states. The shared module retains semantic aliases used by existing callers; every alias renders native Phosphor SVG geometry.

## Rendering and accessibility

- Use **Regular** for everyday controls. Set `weight="fill"` for selected destinations, saved bookmarks, or other states where a solid shape helps communicate selection. State text and `aria-current`/`aria-pressed` remain the source of accessible state information.
- Preserve existing sizes and classes. The wrapper defaults to 24px and `currentColor`; CSS continues to control sizing, alignment, and hover/focus color. Phosphor weights replace stroke-width customization.
- Icons are decorative (`aria-hidden="true"`, `focusable="false"`) by default. Keep the accessible label on icon-only buttons. For standalone informative icons, supply `aria-label`, `aria-labelledby`, `title`, or Phosphor's `alt`. Caller accessibility overrides and SVG refs pass through.
- Each glyph is imported from its individual `@phosphor-icons/react/dist/ssr/Name` module. These context-free components support both Next.js Server and Client Components and avoid compiling the package's entire icon catalog. No provider or client-only boundary is required for the shared wrapper.
- Each icon is its own module behind the `components/icons.tsx` re-export list, and `next.config.mjs` marks exactly those files side-effect-free. Webpack therefore bundles only the icons a page renders; a single shared module made every page download all ~130 icons (about 60 kB gzipped). `tests/phosphor-icons.test.cjs` keeps the list, files and config consistent.
- OutClass branding, club logos, the Microsoft sign-in identity, campus illustrations, and the animated demonstration cursor remain separate artwork with their existing notices.

## Add or change an icon

1. Choose a clear metaphor from the [Phosphor catalog](https://phosphoricons.com/). Match meaning rather than an old component name; settings uses a gear, for example.
2. Reuse an existing semantic export when possible. Otherwise create `components/icons/<Name>.tsx` following the existing files (import the one needed SSR glyph `as Glyph`, then `export const <Name> = /* @__PURE__ */ createIcon("<Name>", Glyph)`), and add `export { <Name> } from "@/components/icons/<Name>"` to `components/icons.tsx`. Do not add another library, remote images, PNG masks, or hand-drawn interface glyphs.
3. Import the shared export in callers. Keep existing labels, tooltips, button behavior, size, spacing, and focus states. Explicitly select Regular or Fill at the component that owns the state.
4. Run icon tests, lint, typecheck, and build. Inspect representative navigation, selected states, and icon-only controls in the browser.

## License distribution

Phosphor Icons is MIT licensed, Copyright (c) 2020 Phosphor Icons. The complete upstream license is distributed at [`/licenses/phosphor-icons-MIT.txt`](../public/licenses/phosphor-icons-MIT.txt). Keep that notice in production artifacts, including static exports. No visible credit bar is required. See the [official React package](https://github.com/phosphor-icons/react).

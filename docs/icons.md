# OutClass icon system

All interface icons use **Icons8 Material Outlined**, API code `m_outlined`, drawn on a 24px grid. Its quiet monochrome outlines suit the navy/ivory palette and existing compact controls. Named exports in `components/icons.tsx` replace the former Lucide icons across public pages, workspaces, Radix controls, calendars, and Sonner notifications.

## Rendering and access

- `icons8.json` pins every component name, catalog ID, common name, local file, and preview URL. The same concept can have compatibility names such as `Users` and `Users2`.
- Icons8 accepted catalog searches but refused `get_icon_svg` with: “Your Icons8 account does not have MCP API access.” No paid downloads or account changes were made.
- The app therefore hosts **96 × 96 PNGs**, below Icons8's free 100px limit. A CSS alpha mask on an SVG shell preserves existing SVG selectors, sizing, React 19 refs, and `currentColor`, without runtime requests to Icons8 or account credentials in the app.
- CSS controls width/height at existing sizes. `strokeWidth` does not redraw a raster outline; the pack's original geometry stays consistent. Named icons are decorative by default; `aria-label`, `aria-labelledby`, or `title` exposes a standalone image.
- A shared “Icons by Icons8” link in the root layout appears on every route, as required for free website use. See [free PNG downloads](https://intercom.help/icons8-7fb7577e8170/en/articles/4725518-can-i-download-icons-for-free) and [attribution](https://icons8.com/license).
- OutClass branding, club logos, the Microsoft sign-in identity, campus illustrations, and the animated demonstration cursor remain separate artwork.

## Add or change an icon

1. Connect the project endpoint in `.codex/config.toml`; use `codex mcp login icons8mcp` if authentication is required. Never commit credentials.
2. Read `icons8.json`, then search the concept with `platform: "m_outlined"` and `animated: false`. Verify the exact pack, metaphor, and PNG preview. Use a plain settings gear, for example.
3. Download the selected catalog ID as PNG at 96px from `https://img.icons8.com/?id=ID&format=png&size=96`. Save it in `public/icons/icons8/ID.png`. IDs must come from search results.
4. Update the manifest and add a named `createIcon` export in `components/icons.tsx`. Import it from `@/components/icons`; keep the attribution in the root layout.
5. Run the icon and scroll-indicator tests, lint, typecheck, and build. Inspect representative controls in the browser.

The entire set was previewed before migration. Material Outlined has no matching checked-bookmark in the reviewed results, so `BookmarkCheck` uses the same ribbon as `Bookmark`; the saved button's text and `aria-pressed` still distinguish its state. Reordering uses the pack's reorder handle, and archive uses its storage box rather than the ZIP-file result returned for “archive.”

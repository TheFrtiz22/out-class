# OutClass design system

The foundations are additive. Existing `components/ui/*` APIs and business logic
remain intact. `/design-system` is a self-contained interactive reference page;
its actions do not persist anything. The existing root layout still requires the
normal Supabase configuration to run the application.

## Source of truth

- `styles/tokens.css`: semantic colors, spacing, radii, shadows, type, stacking,
  and motion. Change values here rather than copying hex values into components.
- `app/globals.css`: Tailwind v4 mappings, typography defaults, keyboard focus,
  motion utilities, and a global reduced-motion override.
- `tailwind.config.js`: compatibility aliases for existing editorial/status
  classes, all backed by the same variables.
- `lib/design-system.ts`: existing shared layout recipes, now semantic.
- `components/ui/*`: stable primitives built on the existing Radix/shadcn stack.

Use `bg-background` for warm canvas, `bg-card` for white surfaces,
`text-foreground` for primary text, and `text-muted-foreground` for secondary text.
`primary` is navy; `accent` means a quiet interaction background, not orange.
Orange has explicit `brand-orange`, `brand-subtle`, and `brand-ink` tokens. Do not
put small white text on signature orange. Use dark brand ink on its pale tint.
Semantic badges combine text labels and color, never color alone.

Use Tailwind's existing quarter-rem spacing scale for controls. `p-page`,
`gap-content`, and `py-section` express larger layout relationships. Avoid
changing every screen's spacing in a foundations change.

## Typography

The intentional current font exception is documented in [the typography audit](typography-audit.md) and [Campus OS](outclass-campus-os.md). The October 2 migration replaced Horsham Serial with self-hosted Libre Caslon Text. Do not silently restore Horsham or add another downloaded family.

Public marketing and authentication use Caslon throughout. Authenticated product shells, focused workspaces, and the reference page use self-hosted Source Sans 3 for operational text and Caslon for display/page/dialog headings. `styles/product-tokens.css` owns that context, including portaled overlays. `app/layout.tsx` loads actual Caslon normal/italic weights 400–700; synthetic faces remain disabled. Brand artwork keeps its original typography; invitation emails retain Arial for email compatibility.

## Components

| Need | API / guidance |
| --- | --- |
| Action | `Button`: every variant is a glass pill (see "Glass surfaces"); `accent` is a pale orange pill. Preserve normal HTML submit semantics; specify type for non-submit form buttons. |
| Choice | `SegmentedControl` (`components/ui/segmented-control.tsx`): both modes are `aria-pressed` toggle buttons in a labelled group with roving focus; single-select adds a sliding navy indicator, `multiple` makes filter chips. Use it for every toggle group and filter chip row; use segmented `Tabs` only for tab panels. |
| Icon action | `IconButton`: required `aria-label`, defaults to `type="button"`. |
| Form fields | `Input`, `Textarea`, Radix `Select`, native `NativeSelect`; associate visible labels and error descriptions. |
| Search | `Search`: required accessible name, normal input props, no filtering state ownership. |
| Label/status | `Badge` semantic variants for general labels. Application states use `StatusPill` (`components/ui/status-pill.tsx`): one filled pill per state (Draft, Submitted, In review, Interview, Accepted, Not selected, Waitlisted) from semantic tokens; it accepts stored codes and legacy labels without changing stored values. |
| Identity | `Avatar`, `AvatarImage`, `AvatarFallback`; provide an accessible name or adjacent identity. |
| Grouping | Plain sections and `Divider` first. `Panel` (`components/ui/panel.tsx`) is the one content container (`.oc-content-panel`, `tone="subtle"` for a muted fill); semantic elements such as `form`, `li` and `fieldset` may carry the same class. |
| Dialog | Existing `Dialog*` exports: modal semantics, focus trap/return and Escape remain Radix-owned. Always include title and description, or explicitly omit aria-describedby when appropriate. |
| Dropdown | Existing `DropdownMenu*` exports preserve keyboard behavior. |
| Tabs | Existing Radix exports; `TabsList variant="underline"` avoids another rounded container. Default remains compatible. |
| Tooltip | Existing exports, 350ms delay; never use a tooltip as the only accessible name. |
| Toast | Existing Sonner `toast` API; semantic tones centralized in the root `Toaster`. Inline feedback remains necessary for field errors. |
| Loading | `LoadingState` reserves rows/cards or gives inline Phosphor feedback; one accessible status. `Skeleton` remains decorative. |
| Page title | `PageHeader` (`components/ui/page-header.tsx`) renders every page's `<h1>`; `tests/primitives.test.cjs` lists the few display/document headings that are not pages. Page widths use only `--oc-content-width` or `--oc-reading-width`. |
| Data table | `DataTable` (`components/ui/data-table.tsx`): the `.oc-data-surface` card around the shared `Table`, with a required caption. |
| Empty state | `EmptyState`: title, description, optional icon/action; compact/roomy density, start/center alignment, plain/subtle/outlined tone; no default card. |
| Progress | `Progress`: numeric value/max or indeterminate null; supply aria-label/aria-labelledby. Values are bounded and passed to Radix for accessible reporting. |
| Heading | `SectionHeading`: explicit h1/h2/h3, optional eyebrow, description, action, and editorial style. |

### Glass surfaces

One glass language, from the navigation's own tokens. Tokens live in `styles/navigation-glass.css` beside the navigation optics; the variant rules live in `styles/interface-primitives.css`.

**Defaults (Phase 2 rollout).** `--oc-content-surface`, `--oc-content-edge` and `--oc-content-shadow` resolve to `--oc-surface-glass*`, so every surface built on the content tokens (`.oc-content-panel`, `.oc-toolbar`, `.oc-form-section`, `.oc-detail-panel`, product cards) is glass without blur. The solid values stay as `--oc-content-solid`, `--oc-content-edge-solid` and `--oc-content-shadow-solid`: data tables (`.oc-data-surface` rows and cells), form fields (`--card`/`--input`), the projector theme and every fallback use them. `Card` defaults to `variant="glass"`; `variant="solid"` on `Card` or `Panel` is the explicit opaque surface for dense data (applicant tables, resumes, interview notes); `Skeleton` defaults to the glass track; `TabsList` defaults to `segmented` (`subtle` and `underline` remain); dialogs, sheets, popovers, menus and selects use the frosted navigation material with the light filter (the only content surfaces allowed to blur, also on phones); tooltips use navy frosted glass; default toasts use the frosted material; outlined and subtle `EmptyState` tones use the glass surface and track. `SegmentedControl` shares the segmented tabs' glass track and navy selection: use segmented `Tabs` for tab panels and `SegmentedControl` for toggles and filters.

**Primitives are glass by default (UI redesign, Phase B).** Visuals for `Button`, `Badge`, `Input`, `Textarea`, `SelectTrigger`, `Switch`, `Checkbox` and `Command` live in `@layer components` (`styles/interface-primitives.css`, badges in `styles/product-components.css`), so a call site's Tailwind utilities still override them; the cva strings carry layout only. None of them uses `backdrop-filter`.

| Token | Use | Solid default | Reduced transparency / higher contrast | Forced colors |
| --- | --- | --- | --- | --- |
| `--oc-surface-glass` | Light card, no blur | `--oc-content-surface` | solid surface, `#526675` edge, no depth | `Canvas` + `CanvasText` |
| `--oc-surface-glass-raised` | Light, blur allowed | `--oc-glass-light-solid` | solid, no filter | `Canvas` |
| `--oc-surface-glass-navy` | The rail's material | `--oc-glass-navy-solid` | solid, no filter | `Canvas` |
| `--oc-surface-ambient` | One decorative page backdrop | `none` | `none` | `none` |

Translucency (and `--oc-surface-glass-filter` / `--oc-surface-glass-navy-filter`) is only enabled inside `@supports (backdrop-filter)`; both filters are `none` below 760px so phones blur only the header, sheets and dialogs. The tokens are declared on `:root` and `[data-product-shell]` so `--oc-club-accent` resolves in the ambient gradient.

| Primitive | Variant | Notes |
| --- | --- | --- |
| `Card`, `Panel` | `variant="glass" \| "glass-raised" \| "glass-navy"` | Glass is the material without blur. Raised and navy put blur on an isolated `::before` layer, never on text. Radius from `--oc-glass-card-radius` (default 18 / 22 / 26px). Navy uses cream text, `--oc-rail-muted` secondary text and orange focus rings. |
| `Tabs` | `TabsList variant="segmented"` | The workspace pill's 54px track. One or two tabs share the width with a sliding navy indicator (positioned with `:has()` from the active trigger, `--oc-floating-spring`); three or more scroll horizontally inside the track and the active tab fills itself, so labels never truncate or widen the page on phones. Without `:has()` the active trigger fills itself. |
| `Button`, `IconButton` | all variants | `default` (and its alias `glass-primary`) is the navy pill of the selected workspace segment (`--oc-glass-pill-navy*`); `outline`, `secondary` (and alias `glass`) are the light pill of the header search; `ghost` is transparent with a `--oc-glass-hover-tint` hover (`--oc-glass-navy-hover-tint` on navy glass); `destructive` is a solid `--destructive` pill with `--oc-glass-pill-highlight`; `link` stays a link. Every size is a pill (icon sizes are circles) and keeps a 44px hit area through `::after`. Hover lifts 1px with `--oc-glass-lift`. Navy focus ring on light glass, orange on navy. The projector keeps its inverted primary. |
| `Input`, `Textarea`, `SelectTrigger`, `NativeSelect`, `DatePicker`, `Search` | — | Solid `--card` field, `--input` edge (3:1), `--oc-glass-field-depth` inset highlight, `--oc-content-radius-small`, 2px navy focus ring (orange inside navy glass). |
| `Switch`, `Checkbox`, radios | — | Switch: light glass track with a grey thumb, navy-tinted track and navy thumb when on, 44px hit area. Checkbox: field edge, navy pill fill when checked. Native radios and checkboxes use `accent-color: var(--primary)`. Forced colors use `Highlight` when on. |
| `Badge`, `StatusPill` | all variants | Pills tinted from the semantic `-subtle` tokens with `--oc-glass-tint-sheen` and `--oc-glass-tint-highlight`; text uses the matching semantic ink (4.5:1). |
| `Command` | — | Frosted material with `--oc-glass-menu-depth`; transparent inside dialogs, popovers and sheets so frosting never stacks. |
| `Skeleton`, `LoadingState` | `variant="glass"` | Light material without blur; skeleton blocks use `--oc-surface-glass-track`. |

Rules: text never passes through a filter; blurred surfaces are never nested; at most six blurred surfaces on screen on desktop (the shell uses five: rail, workspace pill, search, notifications, account; the header band behind them is frosted without blur so blur is never stacked), so page content keeps `--oc-surface-glass-filter: none` in its scope, as Club home does, unless it is the one surface allowed to blur. 

## Motion and stacking

No additional animation dependency. CSS plus existing `tw-animate-css`/Radix
presence is sufficient for these foundations.

- `motion-micro`: 180ms for color/focus feedback.
- `motion-ui`: 300ms for controls and overlay transitions.
- `entrance`: 650ms opacity/12px translate entrance, opt-in only.
- Signature token: 900ms, reserved and not applied by default.
- Reduced motion disables travel/transitions globally, including legacy classes;
  near-zero animation durations preserve presence animation-end events.
- Layers: sticky 20, overlay 40, modal 50, popover 60, tooltip 70, toast 80.
- Elevation is reserved for popovers and dialogs. The previous global shadow
  suppression was removed so portals can express intentional depth.

## Adoption and verification

Migrate screen-specific hardcoded colors as each page is rebuilt. This change
intentionally does not override those classes globally or restyle every screen.
Keep compact controls for dense leader tools; use larger buttons and generous
spacing for primary student tasks and mobile flows.

Review `/design-system` at narrow/wide widths, 200% zoom, keyboard-only, and with
reduced motion. Check dialog focus return, dropdown/select navigation, disabled
states, tabs, progress labels, and error announcements. Contrast ratios should be
checked again whenever token values or surfaces change.

Shared field/action heights are 40px default, 36px compact, and 44px large. Mobile controls have a 44px minimum and fields use at least 16px text to avoid focus zoom. Field borders use `input`; cards/dividers use the quieter `border`. `md` is the control radius and `lg` the grouped-surface radius. Avatars, status pills, campus art, and the Corkboard retain their purposeful shapes. Surface density controls padding. Small surface elevation is distinct from overlay elevation; do not give select triggers popover shadows.

`styles/interface-primitives.css` supplies shared field, loading, and empty-state roles, including compatibility styling for remaining native selects. The student/leader/admin shells share `ProductShell`, navigation primitives, and tokens; preserve their role-specific destinations and keyboard behavior.

Repository commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. A successful build alone is insufficient verification. See [the visual consistency audit](interface-consistency-audit.md) for scope and verification.

## Launch constraints recorded for future work

Hosting is Vercel with Supabase; the database is currently empty but will hold
real users and applicants. All workflows are intended to be live at launch;
clubs onboard individually. Students and faculty must possess UVA email accounts.
Reapplication defaults to each semester, with club-configurable eligibility and
year restrictions. There are no endorsements; supplied permission covers club
logos and images. These decisions are recorded, not implemented by this visual
foundations change. Email ownership enforcement, faculty roles, recruitment
cycles, backend hardening, removal of unsupported endorsement copy, and connecting
mock workflows remain separate implementation work.


## Platform adoption — October 28, 2026

The whole-platform migration extends these foundations. `styles/tokens.css` owns shared content geometry and fallbacks; `styles/product-tokens.css` supplies the authenticated palette. `styles/workspace-composition.css` contains explicit, opt-in recipes used by screen owners:

| Recipe | Purpose |
| --- | --- |
| `oc-workspace-stack` | One responsive column with bounded grid tracks and a shared section gap |
| `oc-content-panel` | Solid grouped content with an 18px radius, quiet edge and low elevation |
| `oc-toolbar` | Search, filtering and secondary actions with consistent field alignment |
| `oc-form-section`, `oc-field`, `oc-form-actions` | Grouped fields, visible labels and a clear action boundary |
| `oc-data-surface` | A dense data region whose scrolling stays inside its own boundary |
| `oc-detail-panel` | Contextual reading pane, sharing the content material |
| `oc-feedback` | Honest inline information/error feedback with text and a semantic edge |

The shared content maximum is 80rem; reading sections use 48rem where appropriate. Adaptive panel padding/gaps are 1–1.5rem. Controls retain their 36/40/44px size roles. Mobile checkbox labels/hit areas remain 44px while their visible boxes stay square. Dialog headings reserve space for the close control. Settings save actions sit above the mobile dock. Content panels use solid materials; optical navigation remains independent.

Prefer these recipes to copying border, background, padding and radius utilities into another component. Keep rows/dividers within grouped surfaces, and retain intentional artwork, Corkboard paper, formal decision letters and focused interview/voting arrangements. Do not give every nested field its own card.

The source inventory, exact captured states, screenshot comparisons and acceptance exceptions live in [the visual QA report](visual-unification/report.md). A shared style reaching a screen is not evidence that every state of that screen has been reviewed.

## Editorial Campus OS — V2

The approved V2 compositions supersede the requirement that every dashboard section
use the same rounded panel. See [implementation and visual QA](editorial-campus-os/README.md).

- `PageHeader density="editorial"` supplies the two-line Caslon masthead for Home
  and Recruitment. Use real contextual eyebrows, with italic emphasis in the title.
- `density="expressive"` gives discovery, Applications, club overview and admin a
  smaller display heading and architectural rule. Compact remains the dense-tool default.
- `FeaturedAction` is a semantic section with one heading, contextual copy, optional
  factual metadata and a real action. It owns no routing, fetching or selection logic.
- `styles/tokens.css` owns editorial display/feature/section sizes, gap, radius,
  shadow and rule. `styles/product-tokens.css` owns navy structural materials and
  field colors. `styles/editorial.css` contains opt-in editorial compositions.
- Home pairs a full-width navy next action with ruled application/update lists and
  a pale blue agenda. Decorative rings carry no information and receive no focus.
- Recruitment uses navy for the actual round filter, warm agenda context, and a
  white booking bottleneck. Counts come from the existing private summary; the
  review preview stays capped at twelve. The pipeline scrolls inside its boundary.
- Applicant dossiers pair a document column with a navy evaluation workspace.
  Responses lead; identity and responses remain subject to the existing server
  projection. Narrow layouts stack the zones and provide a keyboard-focusable jump
  to evaluation. Forms keep their visible labels, autosave and permission checks.

Do not apply these large compositions indiscriminately to tables, scheduling or
writing. Keep their compact tools and reading widths. Retain optical navigation,
public landing artwork, Corkboard paper and the existing Phosphor icon adapter.

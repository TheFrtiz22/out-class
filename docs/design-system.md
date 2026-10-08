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

Public marketing and authentication use Caslon throughout. Authenticated product shells, focused workspaces, and the reference page use system sans for operational text and Caslon for display/page/dialog headings. `styles/product-tokens.css` owns that context, including portaled overlays. `app/layout.tsx` loads actual Caslon normal/italic weights 400–700; synthetic faces remain disabled. Brand artwork keeps its original typography; invitation emails retain Arial for email compatibility.

## Components

| Need | API / guidance |
| --- | --- |
| Action | `Button`: existing variants/sizes retained; `accent` is a pale orange treatment. Preserve normal HTML submit semantics; specify type for non-submit form buttons. |
| Icon action | `IconButton`: required `aria-label`, defaults to `type="button"`. |
| Form fields | `Input`, `Textarea`, Radix `Select`, native `NativeSelect`; associate visible labels and error descriptions. |
| Search | `Search`: required accessible name, normal input props, no filtering state ownership. |
| Label/status | `Badge` semantic variants; `StatusBadge` supports existing labels and Prisma status strings without changing stored values. |
| Identity | `Avatar`, `AvatarImage`, `AvatarFallback`; provide an accessible name or adjacent identity. |
| Grouping | Plain sections and `Divider` first; `Surface` defaults to no box. Use `Card` for a meaningful boundary. |
| Dialog | Existing `Dialog*` exports: modal semantics, focus trap/return and Escape remain Radix-owned. Always include title and description, or explicitly omit aria-describedby when appropriate. |
| Dropdown | Existing `DropdownMenu*` exports preserve keyboard behavior. |
| Tabs | Existing Radix exports; `TabsList variant="underline"` avoids another rounded container. Default remains compatible. |
| Tooltip | Existing exports, 350ms delay; never use a tooltip as the only accessible name. |
| Toast | Existing Sonner `toast` API; semantic tones centralized in the root `Toaster`. Inline feedback remains necessary for field errors. |
| Loading | `LoadingState` reserves rows/cards or gives inline Lucide feedback; one accessible status. `Skeleton` remains decorative. |
| Empty state | `EmptyState`: title, description, optional icon/action; compact/roomy density, start/center alignment, plain/subtle/outlined tone; no default card. |
| Progress | `Progress`: numeric value/max or indeterminate null; supply aria-label/aria-labelledby. Values are bounded and passed to Radix for accessible reporting. |
| Heading | `SectionHeading`: explicit h1/h2/h3, optional eyebrow, description, action, and editorial style. |

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

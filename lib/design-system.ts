/**
 * Shared visual primitives for both the authenticated product and the landing
 * page product previews. Keeping these classes here prevents the marketing
 * mockups from drifting into a separate design system.
 */
export const editorialUi = {
  app: "bg-white font-sans text-neutral-900",
  sidebar: "border-r border-neutral-200 bg-white text-neutral-500",
  sidebarLink:
    "border-l-2 border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
  sidebarLinkActive:
    "border-l-2 border-neutral-900 bg-neutral-50 font-semibold text-neutral-900",
  surface: "border border-neutral-200 bg-white shadow-none",
  title: "font-display font-medium tracking-tight text-neutral-900",
  secondaryText: "font-sans text-neutral-500",
  primaryAction:
    "border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90",
  secondaryAction:
    "border border-neutral-300 bg-white font-medium text-neutral-900 shadow-none hover:bg-neutral-50",
} as const

/**
 * Shared visual primitives for both the authenticated product and the landing
 * page product previews. Keeping these classes here prevents the marketing
 * mockups from drifting into a separate design system.
 */
export const editorialUi = {
  app: "bg-background font-sans text-foreground",
  sidebar: "border-r border-border bg-card text-muted-foreground",
  sidebarLink:
    "border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  sidebarLinkActive:
    "border-l-2 border-primary bg-muted font-semibold text-foreground",
  surface: "border border-border bg-card shadow-none",
  title: "font-sans font-semibold tracking-tight text-foreground",
  secondaryText: "font-sans text-muted-foreground",
  primaryAction:
    "border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90",
  secondaryAction:
    "border border-input bg-card font-medium text-foreground shadow-none hover:bg-muted",
} as const

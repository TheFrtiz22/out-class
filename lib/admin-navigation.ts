import type { ProductNavItem } from "@/lib/product-navigation";
export const adminNavigation: (ProductNavItem & { group: string })[] = [
  { id: "overview", label: "Overview", href: "/platform", group: "Home" },
  ...["Users", "Clubs", "Corkboard", "Applications", "Reports"].map(label => ({ id: label.toLowerCase(), label, href: `/platform/${label.toLowerCase()}`, group: "Platform" })),
  { id: "events", label: "Event Approvals", href: "/platform/events", group: "Operations" },
  { id: "claims", label: "Club Approvals", href: "/platform/claims", group: "Operations" },
  ...["Onboarding", "Support", "Activity"].map(label => ({ id: label.toLowerCase(), label, href: `/platform/${label.toLowerCase()}`, group: "Operations" })),
  { id: "permissions", label: "Permissions", href: "/platform/permissions", group: "System" },
  { id: "settings", label: "Platform Settings", href: "/platform/settings", group: "System" },
  { id: "audit", label: "Audit Log", href: "/platform/audit", group: "System" },
];

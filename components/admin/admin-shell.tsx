"use client";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ApplicationStateProvider } from "@/lib/application-state";
import { ProductShell } from "@/components/shell/product-shell";
import { adminNavigation } from "@/lib/admin-navigation";
export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname(), router = useRouter();
  if (path === "/platform/login") return children;
  const active = path.split("/")[2] || "overview";
  return <ApplicationStateProvider initialData={{ applications: [], events: [], memberships: [] }} persistLocalState={false}><ProductShell workspaceKind="admin" manager mode="platform" modes={[]} items={adminNavigation} active={active} title={adminNavigation.find(i => i.id === active)?.label || "Admin"} onSelect={id => router.push(adminNavigation.find(i => i.id === id)?.href || "/platform")} onNavigate={view => router.push(view === "student-profile" ? "/?workspace=student&view=student-profile" : "/?workspace=student")}>
    {children}
  </ProductShell></ApplicationStateProvider>;
}

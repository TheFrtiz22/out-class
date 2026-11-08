"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShellState } from "@/components/shell/shell-state";

/** Admin page content. The persistent shell (app/(workspace)/layout.tsx) draws the Admin rail from the URL;
 * every platform page keeps its own requirePlatformAdmin check. */
export function AdminShell({ children }: { children: ReactNode }) {
  return <ShellState>
    <div className="flex justify-end pb-3 text-sm"><Link href="/platform/login" className="text-muted-foreground underline underline-offset-4">Verify for sensitive actions</Link></div>
    {children}
  </ShellState>;
}

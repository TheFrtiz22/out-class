"use client"
import { useState } from "react"
import { flushEditors } from "@/lib/autosave-navigation"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
export function DashboardDrawer({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  const [origin] = useState<HTMLElement | null>(() => typeof document === "undefined" ? null : document.activeElement as HTMLElement)
  return <Sheet open onOpenChange={open => { if (!open && !document.querySelector('[data-saving="true"], [data-task-uploading="true"]')) void flushEditors().then(onClose).catch(() => {}) }}><SheetContent onCloseAutoFocus={event => { event.preventDefault(); requestAnimationFrame(() => (origin?.isConnected ? origin : document.getElementById("workspace-content"))?.focus({ preventScroll: true })) }} className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-3xl"><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription>{children}</SheetContent></Sheet>
}

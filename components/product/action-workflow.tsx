"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import "@/components/shell/responsive-workspace.css";
import { flushEditors } from "@/lib/autosave-navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

/** Short actions use dialogs; contextual management uses a roomy side sheet. */
export function ActionWorkflow({ title, description, trigger, children, variant = "outline", presentation = "dialog", open: controlledOpen, onOpenChange, disabled = false, showCloseAction = true }: {
  title: string
  description: string
  trigger?: ReactNode
  children: ReactNode | ((done: () => void) => ReactNode)
  variant?: "default" | "outline" | "ghost" | "secondary"
  presentation?: "dialog" | "sheet"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  showCloseAction?: boolean
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const [error, setError] = useState("")
  const body = useRef<HTMLDivElement>(null)
  const changed = useRef(false)
  const origin = useRef<HTMLElement | null>(null)
  const closing = useRef(false)
  const open = controlledOpen ?? localOpen
  function hasUnsavedChanges() {
    return body.current?.querySelector('[data-unsaved]') ? !!body.current.querySelector('[data-unsaved="true"]') : changed.current
  }
  useEffect(() => {
    if (!open) return
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges() && !body.current?.querySelector('[data-saving="true"]')) return
      event.preventDefault(); event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [open])
  function setOpen(value: boolean) { setLocalOpen(value); onOpenChange?.(value) }
  function done() { changed.current = false; setError(""); setOpen(false) }
  async function requestOpen(value: boolean) {
    if (value) { origin.current = document.activeElement as HTMLElement; changed.current = false; setError(""); setOpen(true); return }
    if (closing.current || body.current?.querySelector('[data-saving="true"], [aria-busy="true"]')) return
    closing.current = true
    try {
      if (body.current?.querySelector('[data-autosave-editor="true"]')) await flushEditors()
      else if (hasUnsavedChanges() && !window.confirm("Close this workflow? Unsaved changes will be lost.")) return
      done()
    } catch { setError("Your draft could not be saved. Keep this workflow open and retry.") }
    finally { closing.current = false }
  }
  const content = <div ref={body} className="min-w-0 space-y-5" onChangeCapture={event => { if ((event.target as HTMLElement).closest("form")) changed.current = true }}>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {typeof children === "function" ? children(done) : children}
    {showCloseAction && <div className="flex justify-end border-t pt-4"><Button type="button" variant="outline" onClick={() => void requestOpen(false)}>Done</Button></div>}
  </div>
  const restoreFocus = (event: Event) => { event.preventDefault(); if (origin.current?.isConnected) origin.current.focus() }
  return presentation === "sheet" ? <Sheet open={open} onOpenChange={value => void requestOpen(value)}>
    {trigger != null && <SheetTrigger asChild><Button variant={variant} disabled={disabled}>{trigger}</Button></SheetTrigger>}
    <SheetContent className="oc-workspace-drawer w-full overflow-y-auto p-6 sm:max-w-3xl" onOpenAutoFocus={() => { origin.current = document.activeElement as HTMLElement }} onCloseAutoFocus={restoreFocus}>
      <SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription>{content}
    </SheetContent>
  </Sheet> : <Dialog open={open} onOpenChange={value => void requestOpen(value)}>
    {trigger != null && <DialogTrigger asChild><Button variant={variant} disabled={disabled}>{trigger}</Button></DialogTrigger>}
    <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={() => { origin.current = document.activeElement as HTMLElement }} onCloseAutoFocus={restoreFocus}>
      <DialogTitle className="pr-8">{title}</DialogTitle><DialogDescription>{description}</DialogDescription>{content}
    </DialogContent>
  </Dialog>
}

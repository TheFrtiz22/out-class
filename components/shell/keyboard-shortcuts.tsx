"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { keyboardShortcutGroups, opensShortcutList } from "@/lib/keyboard-shortcuts"

/** "?" lists the shortcuts OutClass already handles. Mounted once by the product shell. */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const [mac, setMac] = useState(true)
  useEffect(() => { setMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform)) }, [])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!opensShortcutList(event, !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="oc-modal-title">Keyboard shortcuts</DialogTitle>
        <DialogDescription className="sr-only">Shortcuts work when you are not typing in a field.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        {keyboardShortcutGroups.map(group => <section key={group.id} aria-labelledby={`shortcuts-${group.id}`}>
          <h3 id={`shortcuts-${group.id}`} className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</h3>
          <dl className="space-y-2 text-sm">
            {group.shortcuts.map(shortcut => <div key={shortcut.label} className="flex items-center justify-between gap-4">
              <dt>{shortcut.label}</dt>
              <dd className="flex shrink-0 gap-1">{(mac ? shortcut.keys.mac : shortcut.keys.other).map(key => <kbd key={key} className="min-w-6 rounded border border-border px-1.5 py-0.5 text-center font-sans text-xs text-muted-foreground">{key}</kbd>)}</dd>
            </div>)}
          </dl>
        </section>)}
      </div>
    </DialogContent>
  </Dialog>
}

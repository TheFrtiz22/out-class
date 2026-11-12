"use client"

import { useDemoMode } from "@/contexts/demo-context"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { useConfirm } from "@/components/ui/confirm-dialog"
export function DemoMenuItems() {
  const demo = useDemoMode()
  const confirm = useConfirm()
  if (!demo.allowed) return null
  const safe = async () =>
    !document.querySelector('[data-saving="true"]') &&
    (!document.querySelector('[data-unsaved="true"]') ||
      (await confirm({
        title: "Discard unsaved changes?",
        description: "Switching demo context loses your unsaved changes.",
        confirmLabel: "Discard and switch",
        cancelLabel: "Keep editing",
        tone: "danger",
      })))
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={async () => {
          if (await safe()) void demo.toggleDemo()
        }}
      >
        Demo Mode: {demo.isDemoEnabled ? "On (exit demo)" : "Off (enable demo)"}
      </DropdownMenuItem>
      {demo.isDemoEnabled && (
        <>
          <DropdownMenuItem
            onSelect={async () => {
              if (
                (await safe()) &&
                (await confirm({
                  title: "Reset demo changes?",
                  description: "The original sample season is restored. Real data is unaffected.",
                  confirmLabel: "Reset demo",
                  tone: "danger",
                }))
              )
                demo.resetDemo()
            }}
          >
            Reset Demo
          </DropdownMenuItem>
        </>
      )}
    </>
  )
}

"use client"
import { useState } from "react"
import { useDemoMode } from "@/contexts/demo-context"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
export function DemoMenuItems() {
  const demo = useDemoMode()
  if (!demo.allowed) return null
  const safe = () =>
    !document.querySelector('[data-saving="true"]') &&
    (!document.querySelector('[data-unsaved="true"]') ||
      window.confirm("Discard unsaved changes and switch demo context?"))
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => {
          if (safe()) void demo.toggleDemo()
        }}
      >
        Demo Mode: {demo.isDemoEnabled ? "On — exit demo" : "Off — enable demo"}
      </DropdownMenuItem>
      {demo.isDemoEnabled && (
        <>
          <DropdownMenuItem
            onSelect={() => {
              if (
                safe() &&
                window.confirm(
                  "Reset all demo changes to the original sample season? Real data is unaffected.",
                )
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

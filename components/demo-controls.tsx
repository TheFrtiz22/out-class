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
              if (safe()) demo.viewAs("student")
            }}
          >
            View As · Sample Student
          </DropdownMenuItem>
          <div className="px-2 py-2">
            <label className="text-xs text-muted-foreground" htmlFor="demo-club">
              View As · Club Leader
            </label>
            <select
              id="demo-club"
              className="mt-2 min-h-11 w-full rounded-md border bg-card px-2 text-sm"
              value={demo.state?.perspective.role === "leader" ? demo.state.perspective.clubId : ""}
              onChange={(e) => {
                if (e.target.value && safe()) demo.viewAs("leader", e.target.value)
              }}
            >
              <option value="">Choose a sample club</option>
              {demo.state?.clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
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

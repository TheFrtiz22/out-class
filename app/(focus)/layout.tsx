import type { ReactNode } from "react"
import { FocusFrame } from "@/components/shell/focus-frame"
import { MaintenanceGate } from "@/components/maintenance-gate"

/** Single-task screens (interviews, voting, check-in, decisions, sign-in steps) share one calm frame. */
export default function FocusLayout({ children }: { children: ReactNode }) {
  return <MaintenanceGate><FocusFrame>{children}</FocusFrame></MaintenanceGate>
}

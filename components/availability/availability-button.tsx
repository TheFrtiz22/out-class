"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarDays } from "@/components/icons"
import { availabilityHref } from "@/lib/availability"
import { flushEditors } from "@/lib/autosave-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { Button } from "@/components/ui/button"

export function AvailabilityButton({ clubId, roundId, complete }: { clubId?: string; roundId?: string; complete?: boolean }) {
  const router = useRouter(), params = useSearchParams()
  const href = availabilityHref(clubId ?? params.get("clubId") ?? undefined, roundId ?? params.get("roundId") ?? undefined)
  return <div className="space-y-1"><Button type="button" className="min-h-12 gap-2 px-5" onClick={() => {
    void flushEditors().then(() => { if (canLeaveWorkspace()) router.push(href) }).catch(() => {})
  }}><CalendarDays className="size-5" aria-hidden="true" />Set My Availability</Button>{complete !== undefined && <p className="text-xs text-muted-foreground">{complete ? "Availability saved · update anytime" : "Availability not set yet"}</p>}</div>
}

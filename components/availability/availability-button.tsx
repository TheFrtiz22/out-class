"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarDays } from "@/components/icons"
import { availabilityHref } from "@/lib/availability"
import { flushEditors } from "@/lib/autosave-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { Button } from "@/components/ui/button"

/** The one link into `/settings/availability`. Calendar shows it as "Availability"; club Scheduling as "Set My Availability". */
export function AvailabilityButton({ clubId, roundId, complete, label = "Set My Availability", variant = "default" }: { clubId?: string; roundId?: string; complete?: boolean; label?: string; variant?: "default" | "outline" }) {
  const router = useRouter(), params = useSearchParams()
  const href = availabilityHref(clubId ?? params.get("clubId") ?? undefined, roundId ?? params.get("roundId") ?? undefined)
  return <div className="space-y-1"><Button type="button" variant={variant} className="min-h-12 gap-2 px-5" onClick={() => {
    void flushEditors().then(() => { if (canLeaveWorkspace()) router.push(href) }).catch(() => {})
  }}><CalendarDays className="size-5" aria-hidden="true" />{label}</Button>{complete !== undefined && <p className="text-xs text-muted-foreground">{complete ? "Availability saved · update anytime" : "Availability not set yet"}</p>}</div>
}

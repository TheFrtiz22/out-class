"use client"
import Link from "next/link"
import { CalendarPlus, Megaphone } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { hasPermission, type ClubAccess } from "@/lib/permissions"
import { railHrefs } from "@/components/club-home/club-home-model"
import { DashboardActions } from "@/components/product/dashboard/dashboard"

/** Club home title actions, only for members who manage meetings. Both are rail destinations. */
export function ClubHomeActions({ clubId, membership }: { clubId: string; membership: ClubAccess }) {
  if (!hasPermission(membership, "meetings.manage")) return null
  const hrefs = railHrefs(membership, clubId)
  if (!hrefs.announcements && !hrefs.meetings) return null
  return <DashboardActions className="oc-club-home-actions">
    {hrefs.announcements && <Button variant="outline" size="lg" asChild><Link href={hrefs.announcements}><Megaphone aria-hidden="true" />Post update</Link></Button>}
    {hrefs.meetings && <Button size="lg" asChild><Link href={hrefs.meetings}><CalendarPlus aria-hidden="true" />New meeting</Link></Button>}
  </DashboardActions>
}

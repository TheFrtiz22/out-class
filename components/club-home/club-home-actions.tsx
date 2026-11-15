"use client"
import Link from "next/link"
import { CalendarPlus, Megaphone } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { hasPermission, type ClubAccess } from "@/lib/permissions"
import { railHrefs } from "@/components/club-home/club-home-model"
import { clubLinkProps } from "@/components/club-home/club-home-sections"
import { DashboardActions } from "@/components/product/dashboard/dashboard"
import { TERMS } from "@/lib/copy/terms"

/** Club home title actions, only for members who manage meetings. Each opens its form directly (`compose=1`, `new=1`). */
export function ClubHomeActions({ clubId, membership }: { clubId: string; membership: ClubAccess }) {
  if (!hasPermission(membership, "meetings.manage")) return null
  const hrefs = railHrefs(membership, clubId)
  if (!hrefs.announcements && !hrefs.meetings) return null
  return <DashboardActions className="oc-club-home-actions">
    {hrefs.announcements && <Button variant="outline" size="lg" asChild><Link {...clubLinkProps(clubId, `${hrefs.announcements}&compose=1`)}><Megaphone aria-hidden="true" />{TERMS.newAnnouncement}</Link></Button>}
    {hrefs.meetings && <Button size="lg" asChild><Link {...clubLinkProps(clubId, `${hrefs.meetings}&new=1`)}><CalendarPlus aria-hidden="true" />{TERMS.newMeeting}</Link></Button>}
  </DashboardActions>
}

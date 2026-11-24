"use client"
import Link from "next/link"
import { CalendarPlus, Megaphone } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { hasPermission, type ClubAccess } from "@/lib/permissions"
import { railHrefs } from "@/components/club-home/club-home-model"
import { clubLinkProps } from "@/components/club-home/club-home-sections"
import { DashboardActions } from "@/components/product/dashboard/dashboard"
import { TERMS } from "@/lib/copy/terms"
import { ClubQrButton } from "@/components/clubs/club-qr-button"

/**
 * Club home title actions for managers: the club's QR code (one click to show, print or download it), then, for
 * members who manage meetings, New announcement and New meeting, each opening its form directly (`compose=1`, `new=1`).
 */
export function ClubHomeActions({ clubId, clubName, membership }: { clubId: string; clubName: string; membership: ClubAccess }) {
  const hrefs: Partial<ReturnType<typeof railHrefs>> = hasPermission(membership, "meetings.manage") ? railHrefs(membership, clubId) : {}
  return <DashboardActions className="oc-club-home-actions">
    <ClubQrButton club={{ id: clubId, name: clubName }} />
    {hrefs.announcements && <Button variant="outline" size="lg" asChild><Link {...clubLinkProps(clubId, `${hrefs.announcements}&compose=1`)}><Megaphone aria-hidden="true" />{TERMS.newAnnouncement}</Link></Button>}
    {hrefs.meetings && <Button size="lg" asChild><Link {...clubLinkProps(clubId, `${hrefs.meetings}&new=1`)}><CalendarPlus aria-hidden="true" />{TERMS.newMeeting}</Link></Button>}
  </DashboardActions>
}

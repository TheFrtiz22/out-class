"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MeetingList } from "@/components/meeting-workspace";
import { useDemoMode } from "@/contexts/demo-context";
import { ClubEvents } from "./club-events";
import { Panel } from "@/components/ui/panel";
import type { ClubAccess } from "@/lib/permissions";
import { calendarType } from "@/lib/club-calendar";

/**
 * Club Calendar: meetings and the club's public (Corkboard) events in one place, each under its own heading with
 * "Jump to" links; an old `type=` link scrolls to that section. It replaces the separate Meetings and Events pages; old
 * `section=meetings|events` links normalize to `section=calendar&type=…` (lib/workspace-routes).
 * Events need meetings.manage, as before; members without it see their meetings and no filter.
 */
export function ClubCalendar({ clubId, clubName, canManage, canSeeAttendees, membership, personalOnly = false }: { clubId: string; clubName: string; canManage: boolean; canSeeAttendees: boolean; membership?: ClubAccess | null; personalOnly?: boolean }) {
  const params = useSearchParams();
  const { isDemoEnabled } = useDemoMode();
  const type = canManage ? calendarType(params.get("type")) : "meetings";
  // Old `type=meetings|events` links still land on that section; both sections always show.
  useEffect(() => {
    if (!canManage || type === "all") return;
    document.getElementById(`calendar-${type}`)?.scrollIntoView({ block: "start" });
  }, [canManage, type]);
  if (!canManage) return <MeetingList clubId={clubId} embedded personalOnly={personalOnly} initialAudience="MEMBERS" />;
  const meetings = <MeetingList clubId={clubId} embedded initialAudience="ALL" openCreate={params.get("new") === "1"} />;
  const events = isDemoEnabled
    ? <Panel as="section"><h2 className="oc-section-heading">Events</h2><p className="mt-3 text-sm text-muted-foreground">Event management is not available in Demo yet. Switch out of Demo to manage your club’s events.</p></Panel>
    : <ClubEvents clubId={clubId} clubName={clubName} canSeeAttendees={canSeeAttendees} membership={membership} />;
  return <div className="oc-workspace-stack">
    <nav aria-label="Calendar sections" className="oc-jump-links"><span>Jump to:</span><a href="#calendar-meetings">Meetings</a><span aria-hidden="true">·</span><a href="#calendar-events">Events</a></nav>
    <section id="calendar-meetings" aria-labelledby="calendar-meetings-heading" className="oc-workspace-stack oc-calendar-section"><h2 id="calendar-meetings-heading" className="oc-section-heading">Meetings</h2>{meetings}</section>
    <div id="calendar-events" className="oc-calendar-section">{events}</div>
  </div>;
}

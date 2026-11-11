"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { MeetingList } from "@/components/meeting-workspace";
import { useDemoMode } from "@/contexts/demo-context";
import { ClubEvents } from "./club-events";
import { Panel } from "@/components/ui/panel";
import { PillGroup } from "@/components/ui/segmented-control";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { navigateWithinClub } from "@/lib/workspace-navigation";
import type { ClubAccess } from "@/lib/permissions";
import { calendarType, calendarTypes, type CalendarType } from "@/lib/club-calendar";

/**
 * Club Calendar: meetings and the club's public (Corkboard) events in one place, with a type filter
 * (All / Meetings / Events) kept in the URL (`type=`). It replaces the separate Meetings and Events pages; old
 * `section=meetings|events` links normalize to `section=calendar&type=…` (lib/workspace-routes).
 * Events need meetings.manage, as before; members without it see their meetings and no filter.
 */
export function ClubCalendar({ clubId, clubName, canManage, canSeeAttendees, membership, personalOnly = false }: { clubId: string; clubName: string; canManage: boolean; canSeeAttendees: boolean; membership?: ClubAccess | null; personalOnly?: boolean }) {
  const params = useSearchParams(), router = useRouter();
  const { isDemoEnabled } = useDemoMode();
  const type = canManage ? calendarType(params.get("type")) : "meetings";
  const setType = (value: CalendarType) => {
    if (!canLeaveWorkspace()) return;
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("type"); else next.set("type", value);
    next.delete("new");
    const href = `/club/${encodeURIComponent(clubId)}/workspace?${next}`;
    if (!navigateWithinClub(href, true)) router.replace(href, { scroll: false });
  };
  if (!canManage) return <MeetingList clubId={clubId} embedded personalOnly={personalOnly} initialAudience="MEMBERS" />;
  const meetings = <MeetingList clubId={clubId} embedded initialAudience="ALL" openCreate={params.get("new") === "1"} />;
  const events = isDemoEnabled
    ? <Panel as="section"><h2 className="oc-section-heading">Corkboard Events</h2><p className="mt-3 text-sm text-muted-foreground">Corkboard event management is not available in Demo yet. Switch out of Demo to manage your club’s events.</p></Panel>
    : <ClubEvents clubId={clubId} clubName={clubName} canSeeAttendees={canSeeAttendees} membership={membership} />;
  return <div className="oc-workspace-stack">
    <PillGroup label="Show" size="compact" value={type} onChange={setType} options={calendarTypes.map(item => ({ value: item.id, label: item.label }))} />
    {type === "all" ? <>
      <section aria-labelledby="calendar-meetings-heading" className="oc-workspace-stack"><h2 id="calendar-meetings-heading" className="oc-section-heading">Meetings</h2>{meetings}</section>
      {events}
    </> : type === "meetings" ? meetings : events}
  </div>;
}

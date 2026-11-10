"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { MeetingList } from "@/components/meeting-workspace";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { navigateWithinClub } from "@/lib/workspace-navigation";
import { useDemoMode } from "@/contexts/demo-context";
import { ClubEvents } from "./club-events";
import { Panel } from "@/components/ui/panel";

/** Public events live inside Meetings; old Events links remain a compatibility alias. */
export function ClubMeetingsWorkspace({ clubId, clubName, canSeeAttendees, legacyEvents = false }: { clubId: string; clubName: string; canSeeAttendees: boolean; legacyEvents?: boolean }) {
  const params = useSearchParams(), router = useRouter();
  const { isDemoEnabled } = useDemoMode();
  const events = legacyEvents || params.get("meetingTab") === "events";
  function select(value: boolean) {
    const next = new URLSearchParams(params.toString());
    next.set("section", "meetings"); next.set("meetingTab", value ? "events" : "members");
    const href = `/club/${encodeURIComponent(clubId)}/workspace?${next}`;
    if (!navigateWithinClub(href)) router.push(href);
  }
  const kind = <SegmentedControl label="Meetings workspace" value={events ? "events" : "members"} onChange={value => select(value === "events")}
      options={[{ value: "members", label: "Member Meetings" }, { value: "events", label: "Corkboard Events" }]} />
  return <div className="oc-workspace-stack">
    {events && kind}
    {events ? isDemoEnabled ? <Panel as="section"><h2 className="oc-section-heading">Corkboard Events</h2><p className="mt-3 text-sm text-muted-foreground">Corkboard event management is not available in Demo yet. Switch out of Demo to manage your club’s events.</p></Panel> : <ClubEvents clubId={clubId} clubName={clubName} canSeeAttendees={canSeeAttendees} /> : <MeetingList clubId={clubId} embedded initialAudience="ALL" toolbarStart={kind} openCreate={params.get("new") === "1"} />}
  </div>;
}

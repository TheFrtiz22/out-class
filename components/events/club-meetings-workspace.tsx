"use client";
import { useSearchParams } from "next/navigation";
import { MeetingList } from "@/components/meeting-workspace";
import { useDemoMode } from "@/contexts/demo-context";
import { ClubEvents } from "./club-events";
import { Panel } from "@/components/ui/panel";

/** Member meetings, or the club's public events (their own nav entry since FE-12; owner decision 2026-11-05). */
export function ClubMeetingsWorkspace({ clubId, clubName, canSeeAttendees, events = false }: { clubId: string; clubName: string; canSeeAttendees: boolean; events?: boolean }) {
  const params = useSearchParams();
  const { isDemoEnabled } = useDemoMode();
  return <div className="oc-workspace-stack">
    {events ? isDemoEnabled ? <Panel as="section"><h2 className="oc-section-heading">Corkboard Events</h2><p className="mt-3 text-sm text-muted-foreground">Corkboard event management is not available in Demo yet. Switch out of Demo to manage your club’s events.</p></Panel> : <ClubEvents clubId={clubId} clubName={clubName} canSeeAttendees={canSeeAttendees} /> : <MeetingList clubId={clubId} embedded initialAudience="ALL" openCreate={params.get("new") === "1"} />}
  </div>;
}

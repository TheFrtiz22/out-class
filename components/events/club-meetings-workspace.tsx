"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { MeetingList } from "@/components/meeting-workspace";
import { Button } from "@/components/ui/button";
import { navigateWithinClub } from "@/lib/workspace-navigation";
import { useDemoMode } from "@/contexts/demo-context";
import { ClubEvents } from "./club-events";

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
  return <div className="min-w-0 space-y-6">
    <div role="group" aria-label="Meetings workspace" className="flex flex-wrap gap-2 border-b pb-4">
      <Button variant={events ? "outline" : "default"} aria-pressed={!events} onClick={() => select(false)}>Member Meetings</Button>
      <Button variant={events ? "default" : "outline"} aria-pressed={events} onClick={() => select(true)}>Corkboard Events</Button>
    </div>
    {events ? isDemoEnabled ? <section className="rounded-lg border p-6"><h2 className="oc-section-heading">Corkboard Events</h2><p className="mt-3 text-sm text-muted-foreground">Corkboard event management is not available in Demo yet. Switch out of Demo to manage your club’s events.</p></section> : <ClubEvents clubId={clubId} clubName={clubName} canSeeAttendees={canSeeAttendees} /> : <MeetingList clubId={clubId} embedded initialAudience="ALL" />}
  </div>;
}

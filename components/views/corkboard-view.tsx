"use client";
import { PageHeader } from "@/components/ui/page-header";
import { PublicEventBoard } from "@/components/events/public-event-board";
import { ExploreSwitch } from "@/components/explore-switch";
import type { ViewId } from "@/lib/views";
// Saved clubs lives on Explore's header; the Corkboard toolbar is events only.
// onNavigate stays in the signature because the app shell passes it to every view.
export function CorkboardView(_props: { onNavigate?: (view: ViewId) => void }) {
  return (
    <div className="oc-corkboard-events">
      <ExploreSwitch current="events" />
      <PageHeader
        title="Events"
        description="Events on Grounds"
      />
      <PublicEventBoard />
    </div>
  );
}

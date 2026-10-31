"use client";
import { SavedClubsPopover } from "@/components/clubs/saved-clubs-popover";
import { PageHeader } from "@/components/product/page-header";
import { PublicEventBoard } from "@/components/events/public-event-board";
import type { ViewId } from "@/lib/views";
export function CorkboardView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  return (
    <div className="oc-corkboard-events">
      <PageHeader
        title="Virtual Corkboard"
        description="Check out events on Grounds."
      />
      <PublicEventBoard toolbarAction={<SavedClubsPopover onNavigate={onNavigate} />} />
    </div>
  );
}

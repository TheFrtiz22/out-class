"use client";
import Link from "next/link";
import { PageHeader } from "@/components/product/page-header";
import { PublicEventBoard } from "@/components/events/public-event-board";
import type { ViewId } from "@/lib/views";
export function CorkboardView(_props: { onNavigate?: (view: ViewId) => void }) {
  return (
    <div className="oc-corkboard-events">
      <PageHeader
        eyebrow="Your campus, connected"
        title="Corkboard"
        description="What’s happening around Grounds. Events, meetings, and socials posted by UVA clubs."
        illustration="lawn-archways"
      />
      <PublicEventBoard />
      <p className="mt-5 text-sm text-muted-foreground">
        Looking for clubs you saved?{" "}
        <Link className="underline underline-offset-4" href="/saved-clubs">
          Open Saved Clubs
        </Link>
      </p>
    </div>
  );
}

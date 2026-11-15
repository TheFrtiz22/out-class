import type { Metadata } from "next";
import { CorkboardView } from "@/components/views/corkboard-view";
import { getPublicCampusEvent } from "@/actions/campus-events";
import { eventScheduleLabel } from "@/lib/campus-events";
import { pageTitle, SITE_URL, socialDefaults } from "@/lib/seo";
import { shareText, eventSharePath } from "@/lib/share-links";
import { isUuid } from "@/lib/uuid";

type Props = { searchParams: Promise<{ event?: string | string[] }> };

/**
 * A shared event link (/corkboard?event=…) unfurls with the event's title, host and time.
 * Only published events resolve; anything else, or a lookup failure, keeps the plain page title.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const id = (await searchParams).event;
  if (typeof id !== "string" || !isUuid(id)) return { title: "Events" };
  const event = await getPublicCampusEvent(id).catch(() => null);
  if (!event) return { title: "Events" };
  const defaults = socialDefaults();
  const title = pageTitle(event.title);
  const description = shareText(`Hosted by ${event.clubName} · ${eventScheduleLabel(event)} · ${event.location}`, 200);
  const url = new URL(eventSharePath(event.id), SITE_URL).toString();
  return {
    title: { absolute: title },
    description,
    openGraph: { ...defaults.openGraph, title, description, url },
    twitter: { ...defaults.twitter, title, description },
  };
}

export default function Page() {
  return (
    <div className="max-w-[var(--oc-content-width)]">
      <CorkboardView />
    </div>
  );
}

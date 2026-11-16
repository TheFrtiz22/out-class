import type { Metadata } from "next";
import { CorkboardView } from "@/components/views/corkboard-view";
import { unstable_cache } from "next/cache";
import { getPublicCampusEvent, getPublicCorkboard } from "@/actions/campus-events";
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

/**
 * The unfiltered board, read on the server so the first paint shows events instead of a placeholder
 * followed by a client round trip. Public data only (no saved filter); event and club changes
 * revalidate the "club-directory" tag (actions/campus-events.ts refresh()).
 * The board is single-school today (UVA). When school scoping arrives, the school must be part of
 * this cache key (and the read's arguments), or one school's board would be served to another.
 */
const readDefaultBoard = unstable_cache(() => getPublicCorkboard(), ["public-corkboard-default"], { revalidate: 60, tags: ["club-directory"] });

export default async function Page() {
  // A failed read falls back to the board's own client load and error state.
  const initialBoard = await readDefaultBoard().catch(() => undefined);
  return (
    <div className="max-w-[var(--oc-content-width)]">
      <CorkboardView initialBoard={initialBoard} />
    </div>
  );
}

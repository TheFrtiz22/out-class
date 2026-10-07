"use client";
import { useState } from "react";
import { Bookmark, ArrowRight, RefreshCw } from "lucide-react";
import { useCorkboard } from "@/contexts/corkboard-context";
import { PageHeader } from "@/components/product/page-header";
import { DiscoveryCard } from "@/components/clubs/discovery-card";
import { CorkboardButton } from "@/components/clubs/corkboard-button";
import { ClubProfileView } from "@/components/views/club-profile-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DirectoryClub } from "@/lib/club-directory";
import type { ViewId } from "@/lib/views";
import "@/components/clubs/club-discovery.css";
import "@/components/clubs/explore-directory.css";
export function SavedClubsView({
  onNavigate,
}: {
  onNavigate: (view: ViewId) => void;
}) {
  const { items, loading, authenticated, error, refresh } = useCorkboard();
  const [selected, setSelected] = useState<DirectoryClub | null>(null);
  if (selected)
    return (
      <ClubProfileView
        club={selected}
        onBack={() => setSelected(null)}
        onNavigate={onNavigate}
      />
    );
  return (
    <div className="oc-corkboard space-y-6">
      <PageHeader
        eyebrow="Your campus, collected"
        title="Saved clubs"
        description="Keep interesting clubs close. Come back when you’re ready to learn more."
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>Saving a club does not apply, subscribe, or join you.</p>
        <Button
          variant="ghost"
          disabled={loading || !authenticated}
          onClick={() => void refresh()}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>
      {error && items.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {error}
          <Button variant="ghost" onClick={() => void refresh()}>
            Retry Saved clubs
          </Button>
        </p>
      )}
      {loading ? (
        <div role="status" aria-label="Loading Saved clubs">
          <span className="sr-only">Loading Saved clubs…</span>
          <div className="oc-explore-grid" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      ) : !authenticated ? (
        <section className="oc-directory-empty">
          <Bookmark className="size-7" />
          <h2>Your saved clubs go where you do.</h2>
          <p>Sign in to save clubs and revisit them across devices.</p>
          <Button onClick={() => onNavigate("auth")}>Sign in</Button>
          <Button variant="outline" onClick={() => onNavigate("explore")}>
            Browse Explore
          </Button>
        </section>
      ) : error && !items.length ? (
        <section role="alert" className="rounded-lg border p-5">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Retry Saved clubs
          </Button>
        </section>
      ) : items.length ? (
        <>
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            {items.length} saved {items.length === 1 ? "club" : "clubs"}
          </p>
          <ul className="oc-explore-grid">
            {items.map(({ club }) => (
              <DiscoveryCard
                key={club.id}
                club={club}
                entry={`corkboard-${club.id}`}
                onOpen={() => setSelected(club)}
                action={<CorkboardButton club={club} onNavigate={onNavigate} />}
              />
            ))}
          </ul>
        </>
      ) : (
        <section className="oc-directory-empty">
          <Bookmark className="size-7" />
          <h2>A place for your next possibility.</h2>
          <p>
            Save a club from Explore or its profile, and you’ll find it here.
          </p>
          <Button onClick={() => onNavigate("explore")}>
            Find clubs in Explore
            <ArrowRight className="size-4" />
          </Button>
        </section>
      )}
    </div>
  );
}

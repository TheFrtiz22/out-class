"use client";
import { useState, type ReactNode } from "react";
import { Bookmark, ArrowRight, RefreshCw } from "@/components/icons";
import { useCorkboard } from "@/contexts/corkboard-context";
import { PageHeader } from "@/components/ui/page-header";
import { DiscoveryCard } from "@/components/clubs/discovery-card";
import { CorkboardButton } from "@/components/clubs/corkboard-button";
import { ClubProfileView } from "@/components/views/club-profile-view";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import type { DirectoryClub } from "@/lib/club-directory";
import type { ViewId } from "@/lib/views";
import "@/components/clubs/club-discovery.css";
import "@/components/clubs/explore-directory.css";
export function SavedClubsView({
  onNavigate,
  headerAction,
}: {
  onNavigate: (view: ViewId) => void;
  /** The page's own link (Explore clubs) sits in the title row, never above it. */
  headerAction?: ReactNode;
}) {
  const { items, loading, authenticated, error, refresh } = useCorkboard();
  const [selected, setSelected] = useState<DirectoryClub | null>(null);
  if (selected)
    return (
      <ClubProfileView
        club={selected}
        backLabel="Back to saved clubs"
        onBack={() => setSelected(null)}
        onNavigate={onNavigate}
      />
    );
  return (
    <div className="oc-corkboard space-y-6">
      <PageHeader
        title="Saved clubs"
        description="Saving a club doesn’t apply, join or subscribe you."
        action={headerAction}
      />
      {error && items.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {error}
          <Button variant="ghost" onClick={() => void refresh()}>
            Retry Saved clubs
          </Button>
        </p>
      )}
      {loading ? (
        <LoadingState label="Loading Saved clubs…" layout="cards" rows={3} />
      ) : !authenticated ? (
        <EmptyState density="compact" tone="subtle" icon={<Bookmark />} title="Sign in to see your saved clubs." description="Sign in to save clubs and revisit them across devices." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => onNavigate("auth")}>Sign in</Button><Button variant="outline" onClick={() => onNavigate("explore")}>Browse Explore</Button></div>} />
      ) : error && !items.length ? (
        <EmptyState role="alert" density="compact" tone="subtle" icon={<Bookmark />} title="Couldn’t load your saved clubs." description={error} action={<Button variant="outline" onClick={() => void refresh()}>Retry Saved clubs</Button>} />
      ) : items.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {items.length} saved {items.length === 1 ? "club" : "clubs"}
            </p>
            <Button variant="ghost" size="sm" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
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
        <EmptyState density="compact" tone="subtle" icon={<Bookmark />} title="No saved clubs yet." description="Save a club from Explore or its profile, and you’ll find it here." action={<Button onClick={() => onNavigate("explore")}>Browse clubs<ArrowRight className="size-4" /></Button>} />
      )}
    </div>
  );
}

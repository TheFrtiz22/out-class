"use client"
import { ArrowRight } from "@/components/icons"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import type { ClubSuggestion } from "@/lib/club-suggestions"
import type { DirectoryClub } from "@/lib/club-directory"

/** Compact tiles for Explore: the same footprint as the Applications open shortcuts. */
export function SuggestedClubTiles({ suggestions, onOpen }: { suggestions: ClubSuggestion[]; onOpen: (club: DirectoryClub, entry: string) => void }) {
  return <ul className="oc-explore-suggested-list">{suggestions.map(({ club, reason }) => {
    const entry = `suggested-${club.id}`
    return <li key={club.id}><button type="button" data-directory-entry={entry} onClick={() => onOpen(club, entry)}>
      <DirectoryLogo club={club} /><span><strong>{club.name}</strong><small>{reason}</small></span><ArrowRight size={18} aria-hidden="true" />
    </button></li>
  })}</ul>
}

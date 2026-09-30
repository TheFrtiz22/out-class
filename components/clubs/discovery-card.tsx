"use client"

import { useState } from "react"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import type { DirectoryClub } from "@/lib/club-directory"

/** Use club-owned imagery when available; never invent a club photograph. */
export function DiscoveryCard({ club, entry, onOpen }: {
  club: DirectoryClub
  entry: string
  onOpen: () => void
}) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null)
  const hasBanner = !!club.bannerUrl && failedBanner !== club.bannerUrl
  const available = club.source !== "preview" && club.applicationAvailable === true
  return <li className="oc-explore-card">
    <article>
      <div className="oc-explore-card-cover" data-has-banner={hasBanner}>
        {hasBanner && <Image src={club.bannerUrl!} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw" onError={() => setFailedBanner(club.bannerUrl!)} />}
        <div className="oc-explore-card-logo"><DirectoryLogo club={club} size="lg" /></div>
        <span className="oc-explore-category">{club.category || "Student organization"}</span>
      </div>
      <div className="oc-explore-card-body">
        <h3><button data-club-id={club.id} data-directory-entry={entry} onClick={onOpen}>{club.name}</button></h3>
        <p className="oc-explore-pitch">{club.pitch || club.description || "Get to know this club and explore its profile."}</p>
        <div className="oc-explore-card-footer">
          <span data-available={available}>{club.source === "preview" ? "Sample club" : available ? "Application available" : club.claimed === false ? "Unclaimed profile" : "Explore club"}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </div>
      </div>
    </article>
  </li>
}

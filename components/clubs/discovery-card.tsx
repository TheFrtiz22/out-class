"use client"
import { clubAssetSource } from "@/lib/club-assets"

import { useState, type ReactNode, type CSSProperties } from "react"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import { clubRecruitment, recruitmentDate } from "@/lib/recruitment-presentation"
import type { DirectoryClub } from "@/lib/club-directory"

/** Use club-owned imagery when available; never invent a club photograph. */
export function DiscoveryCard({ club, entry, onOpen, action, now = Date.now() }: {
  now?: number
  club: DirectoryClub
  entry: string
  onOpen: () => void
  action?: ReactNode
}) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null)
  const hasBanner = !!club.bannerUrl && failedBanner !== club.bannerUrl
  const recruitment = clubRecruitment(club, now)
  return <li className="oc-explore-card" style={{ "--oc-club-accent": club.color || "var(--primary)" } as CSSProperties}>
    <article>
      <div className="oc-explore-card-cover" data-has-banner={hasBanner}>
        {hasBanner && <Image src={clubAssetSource(club.bannerUrl!)} alt="" fill unoptimized={!club.bannerUrl!.startsWith("/") || club.bannerUrl!.startsWith("//")} sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw" onError={() => setFailedBanner(club.bannerUrl!)} />}
        <div className="oc-explore-card-logo"><DirectoryLogo club={club} size="lg" /></div>
        <span className="oc-explore-category">{club.category || "Student organization"}</span>
      </div>
      <div className="oc-explore-card-body">
        <h3><button data-club-id={club.id} data-directory-entry={entry} onClick={onOpen}>{club.name}</button></h3>
        <p className="oc-explore-pitch">{club.pitch || club.description || "Get to know this club and explore its profile."}</p>
        <div className="oc-explore-card-footer">
          <div className="oc-explore-recruitment"><span data-available={recruitment.available}>{recruitment.label}</span>{recruitment.deadline ? <time dateTime={recruitment.deadline.toISOString()}>{recruitment.expired ? "Closed" : "Deadline"} · {recruitmentDate(recruitment.deadline)}</time> : <small>Deadline not published</small>}{club.timeCommitment && <small>{club.timeCommitment} hours / week</small>}</div>
          <ArrowRight size={18} aria-hidden="true" />
        </div>
        {action && <div className="relative z-10 mt-3">{action}</div>}
      </div>
    </article>
  </li>
}

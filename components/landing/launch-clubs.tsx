import { ClubLogo } from "@/components/club-logo"
import type { LaunchClub } from "@/lib/launch-clubs"
import { SectionReveal } from "@/components/motion/scroll-motion"

export function LaunchClubs({ clubs }: { clubs: LaunchClub[] }) {
  if (!clubs.length) return null
  return <SectionReveal className="oc-launch-clubs" aria-labelledby="launch-clubs-title">
    <h2 id="launch-clubs-title">Launching with UVA organizations</h2>
    <ul>{clubs.map(club => <li key={club.id}>{club.logoUrl && <ClubLogo clubId={club.id} logoUrl={club.logoUrl} marketing={club.marketing} color={club.color || "#142D45"} text={club.name.slice(0,2)} size="sm" className="!size-9" />}<a href={`/club/${encodeURIComponent(club.id)}`}>{club.name}</a></li>)}</ul>
    <p>Participating organizations · OutClass is independently operated.</p>
  </SectionReveal>
}

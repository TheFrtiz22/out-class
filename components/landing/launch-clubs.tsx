import type { LaunchClub } from "@/lib/launch-clubs"
import { SectionReveal } from "@/components/motion/scroll-motion"

export function LaunchClubs({ clubs }: { clubs: LaunchClub[] }) {
  if (!clubs.length) return null
  return <SectionReveal className="oc-launch-clubs" aria-labelledby="launch-clubs-title">
    <h2 id="launch-clubs-title">Launching with UVA organizations</h2>
    <ul>{clubs.map(club => <li key={club.id}>{club.logoUrl && <img src={club.logoUrl} alt="" width={36} height={36} loading="lazy" />}<span>{club.name}</span></li>)}</ul>
    <p>Participating organizations · OutClass is independently operated.</p>
  </SectionReveal>
}

import { ClubLogo } from "@/components/club-logo"
import type { DirectoryClub } from "@/lib/club-directory"

/** Database IDs do not imply a local image asset. Avoid a 404 for every missing logo. */
export function DirectoryLogo({
  club,
  size = "md",
}: {
  club: DirectoryClub
  size?: "md" | "lg" | "xl"
}) {
  if (club.source === "database" && !club.logoUrl)
    return (
      <span aria-hidden="true" className={`oc-directory-monogram oc-directory-monogram-${size}`}>
        {club.logoText}
      </span>
    )
  return (
    <ClubLogo
      clubId={club.id}
      logoUrl={club.logoUrl}
      text={club.logoText}
      color={club.color}
      size={size}
    />
  )
}

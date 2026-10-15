import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Centralized OutClass identity. All paths point to the approved premium-board
 * vector collection; the older public/brand files remain available for rollback.
 *
 * light: full two-tone sword lockup on ivory/white
 * dark: ivory/orange sword lockup on brand navy
 * wordmark: compact sword-free two-tone logo for narrow, light-background headers
 * mark: sword-free interlocking OC app icon
 */
type OutClassLogoProps = {
  variant?: "light" | "dark" | "wordmark" | "mark"
  className?: string
}

const brandRoot = "/brand/premium-board"

export function OutClassLogo({ variant = "light", className }: OutClassLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src={`${brandRoot}/05_app_icon_primary.svg`}
        alt="OutClass"
        width={175}
        height={175}
        sizes="32px"
        className={cn("size-8 rounded-md object-contain", className)}
        priority
        unoptimized
      />
    )
  }

  const artwork = variant === "dark"
    ? { name: "10_hero_transparent.svg", width: 1079, height: 258 }
    : variant === "wordmark"
      ? { name: "04_wordmark_no_sword.svg", width: 466, height: 105 }
      : { name: "02_primary_lockup.svg", width: 457, height: 141 }

  return (
    <Image
      src={`${brandRoot}/${artwork.name}`}
      alt="OutClass"
      width={artwork.width}
      height={artwork.height}
      className={cn("h-8 w-auto object-contain", className)}
      priority
      unoptimized
    />
  )
}

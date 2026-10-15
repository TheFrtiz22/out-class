import Image from "next/image"
import { cn } from "@/lib/utils"

type OutClassLogoProps = {
  /**
   * "dark" renders the transparent white/orange SVG — use this on surfaces that are always
   * Brand Navy (e.g. sidebar and marketing hero).
   * "light" renders the transparent navy/orange SVG — use this on white surfaces (e.g. the login card).
   * "mark" renders just the sword-free interlocking "OC" icon — use this for the collapsed sidebar rail,
   * the mobile header, and other tight spaces (without a sword).
   */
  variant?: "light" | "dark" | "mark"
  className?: string
}

export function OutClassLogo({ variant = "light", className }: OutClassLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/12-app-icon-navy.svg"
        alt="OutClass"
        width={32}
        height={32}
        className={cn("size-8 rounded-md object-cover", className)}
        priority
      />
    )
  }

  return (
    <Image
      src={variant === "dark" ? "/brand/03-logo-dark-transparent.svg" : "/brand/02-logo-primary-transparent.svg"}
      alt="OutClass"
      width={1280}
      height={332}
      className={cn("h-8 w-auto rounded-sm object-contain", className)}
      priority
      unoptimized
    />
  )
}

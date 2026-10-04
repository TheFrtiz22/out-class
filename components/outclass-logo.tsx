import Image from "next/image"
import { cn } from "@/lib/utils"

type OutClassLogoProps = {
  /**
   * "dark" renders the transparent white/orange SVG — use this on surfaces that are always
   * Brand Navy (e.g. the sidebar, the landing page pitch panel).
   * "light" renders the transparent navy/orange SVG — use this on white surfaces (e.g. the login card).
   * "mark" renders just the square Sabre "OC" icon — use this for the collapsed sidebar rail,
   * the mobile header, and other tight spaces.
   */
  variant?: "light" | "dark" | "mark"
  className?: string
}

export function OutClassLogo({ variant = "light", className }: OutClassLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/outclass-mark.png"
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
      src={variant === "dark" ? "/outclass_white_orange_sharp.svg" : "/outclass_navy_orange_sharp.svg"}
      alt="OutClass"
      width={variant === "dark" ? 658 : 894}
      height={variant === "dark" ? 188 : 253}
      className={cn("h-8 w-auto rounded-sm object-contain", className)}
      priority
      unoptimized
    />
  )
}

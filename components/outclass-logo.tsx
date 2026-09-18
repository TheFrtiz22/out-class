import Image from "next/image"
import { cn } from "@/lib/utils"

type OutClassLogoProps = {
  /**
   * "dark" always renders the white-on-navy wordmark — use this on surfaces that are always
   * Brand Navy (e.g. the sidebar, the landing page pitch panel).
   * "light" renders the navy-on-white wordmark — use this on white surfaces (e.g. the login card).
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
      src={variant === "dark" ? "/outclass-logo-dark.jpeg" : "/outclass-logo-light.jpeg"}
      alt="OutClass"
      width={168}
      height={40}
      className={cn("h-8 w-auto rounded-sm object-contain", className)}
      priority
    />
  )
}

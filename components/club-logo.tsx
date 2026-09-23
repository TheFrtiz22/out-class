"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const sizeMap = {
  sm: "size-8 text-xs rounded-md",
  md: "size-11 text-sm rounded-lg",
  lg: "size-16 text-lg rounded-lg",
  xl: "size-20 text-xl rounded-lg",
  "2xl": "size-28 text-3xl rounded-xl sm:size-32",
}

type ClubLogoProps = {
  text: string
  color: string
  clubId?: string
  logoUrl?: string | null
  alt?: string
  size?: keyof typeof sizeMap
  className?: string
  fallback?: ReactNode
}

export function ClubLogo(props: ClubLogoProps) {
  const src = props.logoUrl?.trim() || `/logos/${encodeURIComponent(props.clubId || props.text.toLowerCase())}.png`
  // Remount on source changes so a failed image never hides a replacement logo.
  return <ClubLogoImage key={src} {...props} src={src} />
}

function ClubLogoImage({ src, text, color, alt = "", size = "md", className, fallback }: ClubLogoProps & { src: string }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const dimensions = cn("shrink-0 shadow-none", sizeMap[size], className)

  if (failed) {
    return fallback ?? (
      <div
        className={cn("flex items-center justify-center font-semibold tracking-tight text-white", dimensions)}
        style={{ backgroundColor: color }}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        {text}
      </div>
    )
  }

  return (
    <span className={cn("relative inline-flex items-center justify-center overflow-hidden font-semibold text-white", dimensions)} style={{ backgroundColor: color }}>
      <span aria-hidden="true">{text}</span>
      <img
        src={src}
        ref={(image) => { if (image?.complete) { if (image.naturalWidth === 0) setFailed(true); else setLoaded(true) } }}
        alt={alt}
        className={cn("absolute inset-0 size-full rounded-[inherit] border border-border bg-card object-contain", loaded ? "opacity-100" : "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  )
}

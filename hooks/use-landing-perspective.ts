"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { perspectiveFromHash, perspectiveHash, type LandingPerspective } from "@/components/landing/journey-content"

export function useLandingPerspective() {
  const router = useRouter()
  const [perspective, setPerspective] = useState<LandingPerspective>("student")

  useEffect(() => {
    const sync = () => {
      const next = perspectiveFromHash(window.location.hash)
      if (next) setPerspective(next)
    }
    sync()
    window.addEventListener("hashchange", sync)
    window.addEventListener("popstate", sync)
    return () => {
      window.removeEventListener("hashchange", sync)
      window.removeEventListener("popstate", sync)
    }
  }, [])

  const switchPerspective = useCallback((next: LandingPerspective) => {
    setPerspective(next)
    // A switch stays at the current chapter; native links still own navigation.
    router.replace(perspectiveHash(next), { scroll: false })
  }, [router])

  return { perspective, switchPerspective }
}

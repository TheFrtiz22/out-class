"use client"
import { useEffect } from "react"

/** Native anchors own history; restore initial fragments after streamed HTML mounts. */
export function LandingNavigation() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add("oc-native-navigation")
    const focusTarget = () => {
      let id: string
      try { id = decodeURIComponent(location.hash.slice(1)) } catch { return }
      const target = document.getElementById(id)
      if (!target || !target.closest(".oc-landing")) return
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
      target.focus({ preventScroll: true })
      return target
    }
    window.addEventListener("hashchange", focusTarget)
    const frame = requestAnimationFrame(() => {
      const target = focusTarget()
      if (target && window.scrollY === 0) target.scrollIntoView({ behavior: "instant", block: "start" })
    })
    return () => { cancelAnimationFrame(frame); root.classList.remove("oc-native-navigation"); window.removeEventListener("hashchange", focusTarget) }
  }, [])
  return null
}

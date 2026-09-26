"use client"
import { useEffect } from "react"

/** Native anchors own scrolling, URL history, and back/forward restoration. */
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
    }
    window.addEventListener("hashchange", focusTarget)
    return () => { root.classList.remove("oc-native-navigation"); window.removeEventListener("hashchange", focusTarget) }
  }, [])
  return null
}

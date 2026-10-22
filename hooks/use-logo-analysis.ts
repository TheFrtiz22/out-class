"use client"
import { useEffect, useState } from "react"
import { analyzeLogoPixels, type LogoAnalysis } from "@/lib/club-logo-background"

const cache = new Map<string, Promise<LogoAnalysis | null>>()
function inspect(source: string) {
  const existing = cache.get(source)
  if (existing) return existing
  const pending = new Promise<LogoAnalysis | null>(resolve => {
    const image = new Image()
    // Remote artwork may disallow canvas access. Keep displaying it and offer
    // manual choices; never proxy arbitrary URLs or parse SVG markup as HTML.
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const scale = Math.min(1, 96 / Math.max(image.naturalWidth, image.naturalHeight))
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) return resolve(null)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(analyzeLogoPixels(context.getImageData(0, 0, canvas.width, canvas.height).data))
      } catch { resolve(null) }
    }
    image.onerror = () => resolve(null)
    image.src = source
  })
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(source, pending)
  return pending
}
export function useLogoAnalysis(source: string) {
  const [result, setResult] = useState<{ source: string; analysis: LogoAnalysis | null; ready: boolean }>({ source: "", analysis: null, ready: false })
  useEffect(() => {
    let active = true
    if (source) void inspect(source).then(analysis => { if (active) setResult({ source, analysis, ready: true }) })
    return () => { active = false }
  }, [source])
  return result.source === source ? result : { analysis: null, ready: !source }
}

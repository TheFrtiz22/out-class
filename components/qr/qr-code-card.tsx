"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Download, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url; anchor.download = filename
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Render at print resolution; retain the SVG's white background and quiet zone. */
export async function downloadQrPng(svg: SVGSVGElement, filename: string) {
  const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Could not render QR code.")); img.src = source })
    const canvas = document.createElement("canvas")
    canvas.width = 2048; canvas.height = 2048
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("PNG export isn't supported in this browser.")
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 2048, 2048)
    ctx.drawImage(img, 0, 0, 2048, 2048)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("PNG export failed.")), "image/png"))
    saveBlob(blob, `${filename}.png`)
  } finally { URL.revokeObjectURL(source) }
}

export function QrCodeCard({ title, description, path, filename }: { title: string; description: string; path: string; filename: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const [origin, setOrigin] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const url = origin + path
  async function download(format: "png" | "svg") {
    if (!svg.current) return
    setBusy(true); setMessage("")
    try {
      if (format === "png") await downloadQrPng(svg.current, filename)
      else saveBlob(new Blob([new XMLSerializer().serializeToString(svg.current)], { type: "image/svg+xml;charset=utf-8" }), `${filename}.svg`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Download failed. Please retry.") }
    finally { setBusy(false) }
  }
  return <section className="rounded-xl border border-neutral-200 bg-white p-6 font-sans text-black shadow-none">
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="flex size-48 shrink-0 items-center justify-center rounded-lg border border-neutral-200">
        {origin ? <QRCodeSVG ref={svg} value={url} size={184} level="M" marginSize={4} title={title} /> : <span className="text-sm text-neutral-500">Preparing QR code…</span>}
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="text-lg font-semibold">{title}</h3><p className="text-sm text-neutral-500">{description}</p>
        {origin && <a href={url} className="block break-all text-sm underline underline-offset-4">{url}</a>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="shadow-none" disabled={!origin || busy} onClick={() => download("png")}><Download className="size-4" />Download as PNG</Button>
          <Button variant="outline" className="shadow-none" disabled={!origin || busy} onClick={() => download("svg")}><Download className="size-4" />Download as SVG</Button>
          <Button variant="outline" className="shadow-none" disabled={!origin} onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage("Link copied.") } catch { setMessage("Copy unavailable. Select the link above to copy it.") } }}><Copy className="size-4" />Copy link</Button>
        </div><p role="status" className="text-xs text-neutral-500">{message}</p>
      </div>
    </div>
  </section>
}

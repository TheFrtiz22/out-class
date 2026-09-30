"use client"
import { useState } from "react"
import { ImagePlus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function ProfileImageInput({ label, value, onChange, banner = false }: { label: string; value: string | null; onChange: (value: string | null) => void; banner?: boolean }) {
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function upload(file?: File) {
    if (!file) return
    setError("")
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setError("Choose a PNG, JPEG, or WebP under 10 MB."); return }
    setBusy(true)
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, (banner ? 1400 : 400) / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext("2d")
      if (!context) throw new Error()
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
      const data = canvas.toDataURL("image/webp", .8)
      if (data.length > 350000) { setError("This image is too detailed. Try a smaller image."); return }
      onChange(data)
    } catch { setError("Could not read this image. Try another file.") }
    finally { setBusy(false) }
  }
  return <div className="space-y-2" data-saving={busy}>
    <p className="text-sm font-medium">{label}</p>
    <label className={`relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 ${banner ? "h-36 w-full" : "size-20 rounded-full"}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]) }}>
      {value ? <img src={value} alt={`${label} preview`} className="size-full object-cover" /> : <ImagePlus className="size-6 text-muted-foreground" />}
      <input aria-label={`Upload ${label}`} className="absolute inset-0 cursor-pointer opacity-0" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = "" }} />
    </label>
    <div className="flex items-center gap-2"><Input aria-label={`${label} image URL`} placeholder="https://… or click above to upload" value={value?.startsWith("data:") ? "" : value ?? ""} onChange={e => onChange(e.target.value || null)} />{value && <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={() => onChange(null)}><X size={16} /></Button>}</div>
    <p className="text-xs text-muted-foreground">{busy ? "Preparing image…" : value?.startsWith("data:") ? "Image ready to publish." : "Drop an image or click to upload. PNG, JPEG, WebP up to 10 MB."}</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

"use client"
import { useEffect, useId, useRef, useState } from "react"
import { ImagePlus, X } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Textarea } from "@/components/ui/textarea"
import { prepareFeedbackScreenshot, submitFeedbackReport } from "@/actions/feedback-reports"
import { UserFacingError, unwrapAction } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import { FEEDBACK_CONFIRMATION, FEEDBACK_MESSAGE_MAX, FEEDBACK_MESSAGE_MIN, FEEDBACK_SCREENSHOT_MAX_BYTES, feedbackKindLabels, type FeedbackKind } from "@/lib/feedback-reports"

const MAX_EDGE = 1920

/** Downscales and re-encodes a chosen image as JPEG under the 2 MB cap; the server checks it again. */
async function compressScreenshot(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new UserFacingError("Choose an image file.")
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new UserFacingError("This image can’t be read. Choose a PNG or JPEG.") }
  try {
    for (const [edge, quality] of [[MAX_EDGE, 0.82], [MAX_EDGE, 0.68], [1440, 0.68], [1080, 0.6]] as const) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext("2d")
      if (!context) break
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality))
      if (blob && blob.size <= FEEDBACK_SCREENSHOT_MAX_BYTES) return blob
    }
  } finally { bitmap.close() }
  throw new UserFacingError("This image is too large to attach. Try a smaller screenshot.")
}

/**
 * "Report an issue or send feedback" from the account menu. Signed-in, live accounts only (the
 * shell hides it in Demo Mode and support sessions; the server refuses both too). The page path
 * and query (never the fragment) and the window size are sent; the server adds the device line
 * and build, and drops anything that looks like a credential.
 */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ids = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<FeedbackKind>("ISSUE"), [message, setMessage] = useState("")
  const [shot, setShot] = useState<{ blob: Blob; preview: string } | null>(null)
  const [busy, setBusy] = useState(false), [preparing, setPreparing] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false)
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.preview) }, [shot])
  function close(next: boolean) {
    if (busy) return
    onOpenChange(next)
    if (!next) { setKind("ISSUE"); setMessage(""); setShot(null); setError(""); setDone(false) }
  }
  async function choose(file?: File) {
    if (!file) return
    setPreparing(true); setError("")
    try { const blob = await compressScreenshot(file); setShot({ blob, preview: URL.createObjectURL(blob) }) }
    catch (e) { setError(userMessage(e, "This image can’t be attached.")) }
    finally { setPreparing(false); if (fileInput.current) fileInput.current.value = "" }
  }
  async function submit() {
    if (busy || message.trim().length < FEEDBACK_MESSAGE_MIN) return
    setBusy(true); setError("")
    try {
      let screenshot: { path: string; size: number; mime: "image/jpeg" } | undefined
      if (shot) {
        const upload = unwrapAction(await prepareFeedbackScreenshot({ size: shot.blob.size, mime: "image/jpeg" }))
        const response = await fetch(upload.url, { method: "PUT", headers: { "Content-Type": "image/jpeg", "x-upsert": "false" }, body: shot.blob })
        if (!response.ok) throw new UserFacingError("The screenshot didn’t upload. Try again, or remove it.")
        screenshot = { path: upload.path, size: shot.blob.size, mime: "image/jpeg" }
      }
      unwrapAction(await submitFeedbackReport({
        kind, message,
        context: { path: `${window.location.pathname}${window.location.search}`, viewport: { width: Math.round(window.innerWidth), height: Math.round(window.innerHeight) } },
        ...(screenshot ? { screenshot } : {}),
      }))
      setDone(true)
    } catch (e) { setError(userMessage(e, "We couldn’t send your report. Please try again.")) }
    finally { setBusy(false) }
  }
  const short = message.trim().length < FEEDBACK_MESSAGE_MIN
  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Report an issue or send feedback</DialogTitle>
        <DialogDescription>{done ? FEEDBACK_CONFIRMATION : "Goes to the OutClass team."}</DialogDescription>
      </DialogHeader>
      {done ? <DialogFooter><Button type="button" onClick={() => close(false)}>Done</Button></DialogFooter>
        : <form className="space-y-4" aria-busy={busy} onSubmit={e => { e.preventDefault(); void submit() }}>
          <SegmentedControl label="Type" size="compact" value={kind} onChange={setKind} options={(["ISSUE", "FEEDBACK"] as const).map(value => ({ value, label: feedbackKindLabels[value] }))} />
          <label className="block space-y-2 text-sm font-medium" htmlFor={`${ids}-message`}>{kind === "ISSUE" ? "What went wrong?" : "Your feedback"}
            <Textarea id={`${ids}-message`} required minLength={FEEDBACK_MESSAGE_MIN} maxLength={FEEDBACK_MESSAGE_MAX} rows={5} value={message} disabled={busy} onChange={e => setMessage(e.target.value)} aria-describedby={`${ids}-attached`} />
          </label>
          <input ref={fileInput} id={`${ids}-file`} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => void choose(e.target.files?.[0])} />
          {shot ? <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL preview */}
            <img src={shot.preview} alt="Attached screenshot" className="h-14 w-20 rounded-md border border-border object-cover" />
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">Screenshot attached</span>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setShot(null)}><X aria-hidden="true" />Remove</Button>
          </div> : <Button type="button" variant="outline" size="sm" disabled={busy || preparing} onClick={() => fileInput.current?.click()}><ImagePlus aria-hidden="true" />{preparing ? "Preparing…" : "Attach screenshot"}</Button>}
          <p id={`${ids}-attached`} className="text-xs text-muted-foreground">We include this page, your browser and device, and the app version{shot ? ", plus your screenshot" : ""}.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || preparing || short}>{busy ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </form>}
    </DialogContent>
  </Dialog>
}

"use client"
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Check, Copy, Instagram, Linkedin, Mail, MessageSquareText, MoreHorizontal, Share, WhatsApp, XLogo } from "@/components/icons"
import type { IconComponent } from "@/components/icons/factory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SHARE_CHANNELS, SHARE_CHANNEL_LABELS, opensWebsite, shareHref, type ShareChannel } from "@/lib/share-links"
import "./share-sheet.css"

const CHANNEL_ICONS: Record<ShareChannel, IconComponent> = {
  messages: MessageSquareText,
  instagram: Instagram,
  whatsapp: WhatsApp,
  email: Mail,
  linkedin: Linkedin,
  x: XLogo,
}

export type ShareSheetProps = {
  /** Public path on this site, e.g. "/club/abc" or "/corkboard?event=…". */
  path: string
  /** What is being shared, shown in the sheet and used as the email subject. */
  title: string
  /** Line sent before the link. */
  text: string
  /** Sheet heading. Defaults to "Share {title}". */
  heading?: string
  /** Optional small line under the heading (e.g. "Hosted by …"). */
  subtitle?: string
  /** Trigger button label. */
  label?: ReactNode
  className?: string
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
  /** Render an icon-only trigger (label becomes its accessible name). */
  iconOnly?: boolean
}

/**
 * One share sheet for every public OutClass page: Messages, Instagram, WhatsApp, Email, LinkedIn,
 * X, copy link, and the device's own share menu where the browser has one. Links always point at
 * the public page, which unfurls as its share card.
 */
export function ShareSheet({ path, title, text, heading, subtitle, label = "Share", className, variant = "outline", size, iconOnly }: ShareSheetProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [nativeShare, setNativeShare] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { setNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function") }, [])
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2500)
    return () => window.clearTimeout(timer)
  }, [copied])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setUrl(new URL(path, window.location.origin).toString())
      setStatus(null)
      setCopied(false)
    }
  }

  async function copy(after?: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setStatus({ tone: "ok", message: after ?? "Link copied." })
      return true
    } catch {
      input.current?.select()
      setStatus({ tone: "error", message: "Couldn’t copy automatically. The link is selected, so copy it from the box." })
      return false
    }
  }

  async function shareNative() {
    try {
      await navigator.share({ title, text, url })
      setOpen(false)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setStatus({ tone: "error", message: "Your device couldn’t open its share menu. Copy the link instead." })
    }
  }

  const payload = { url, title, text }
  const triggerLabel = typeof label === "string" ? label : "Share"

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button type="button" variant={variant} size={iconOnly ? (size ?? "icon") : size} className={className} aria-label={iconOnly ? `${triggerLabel} ${title}` : undefined}>
        <Share className="size-4" aria-hidden="true" />{!iconOnly && label}
      </Button>
    </DialogTrigger>
    <DialogContent className="oc-share-sheet">
      <div className="oc-share-head">
        <DialogTitle className="oc-share-title">{heading ?? `Share ${title}`}</DialogTitle>
        {subtitle
          ? <DialogDescription className="oc-share-subtitle">{subtitle}</DialogDescription>
          : <DialogDescription className="sr-only">Send a link to this page.</DialogDescription>}
      </div>
      {url && <ul className="oc-share-targets" aria-label="Share to">
        {SHARE_CHANNELS.map(channel => {
          const Icon = CHANNEL_ICONS[channel]
          const name = SHARE_CHANNEL_LABELS[channel]
          const web = opensWebsite(channel)
          return <li key={channel}>
            <a
              className="oc-share-target"
              href={shareHref(channel, payload)}
              target={web ? "_blank" : undefined}
              rel={web ? "noopener noreferrer" : undefined}
              data-channel={channel}
              onClick={() => {
                // Instagram can't take a link through a URL, so put it on the clipboard first and
                // open DMs; the copy starts inside the click so the browser allows it.
                if (channel === "instagram") void copy("Link copied. Paste it in an Instagram message or story.")
              }}
            >
              <span className="oc-share-glyph"><Icon aria-hidden="true" className="size-6" /></span>
              <span className="oc-share-label">{name}</span>
              {web && <span className="sr-only"> (opens in a new tab)</span>}
            </a>
          </li>
        })}
        {nativeShare && <li>
          <button type="button" className="oc-share-target" onClick={() => void shareNative()}>
            <span className="oc-share-glyph"><MoreHorizontal aria-hidden="true" className="size-6" /></span>
            <span className="oc-share-label">More</span>
          </button>
        </li>}
      </ul>}
      <div className="oc-share-copy">
        <Input ref={input} readOnly aria-label="Link" value={url} onFocus={event => event.currentTarget.select()} />
        <Button type="button" variant="default" onClick={() => void copy()}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className={status ? `oc-share-status${status.tone === "error" ? " is-error" : ""}` : "sr-only"}>{status?.message ?? ""}</p>
    </DialogContent>
  </Dialog>
}

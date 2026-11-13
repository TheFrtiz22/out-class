"use client"

import Image from "next/image"
import { useEffect, useId, useRef, useState, type ReactElement } from "react"
import { Play } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PROMO_VIDEO_CAPTIONS, promoVideoLength, promoVideoPoster, promoVideos, promoVideoSpokenLength, promoVideoSrc, type PromoVideoId } from "@/lib/promo-videos"
import "./promo-video.css"

/**
 * The public promo videos (lib/promo-videos.ts, docs/public-site/videos.md). Nothing loads or plays until
 * the visitor asks: pages show a button or a poster, and the <video> element is only mounted on that click,
 * so no page pays for a video it does not play. The videos have music and no narration; each player is
 * named after its video and described by the written summary.
 */
function Player({ video, describedBy, takeFocus = false }: { video: PromoVideoId; describedBy: string; takeFocus?: boolean }) {
  const element = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    // The poster's Play button is gone once the player replaces it; keep the keyboard on the video.
    if (takeFocus) element.current?.focus({ preventScroll: true })
    // The click that mounted the player is the visitor's request to play. Browsers that hold autoplay
    // back until play() is called get it here; one that still refuses leaves the native controls.
    element.current?.play().catch(() => {})
  }, [takeFocus])
  return (
    <video ref={element} className="oc-promo-player" src={promoVideoSrc(video)} poster={promoVideoPoster(video)} width={1920} height={1080}
      controls autoPlay playsInline preload="auto" aria-label={promoVideos[video].title} aria-describedby={describedBy}>
      {/* No speech to caption: the one cue tells a viewer with captions on that the sound is music only. */}
      <track kind="captions" src={PROMO_VIDEO_CAPTIONS} srcLang="en" label="English" />
    </video>
  )
}

function Length({ video }: { video: PromoVideoId }) {
  return <span className="oc-watch-video-length"><span aria-hidden="true">{promoVideoLength(video)}</span><span className="sr-only">, {promoVideoSpokenLength(video)}</span></span>
}

/** One video in the shared dialog, opened by `trigger`. Radix mounts the content only while open, so closing
 *  the dialog stops playback and frees the file. */
function VideoDialog({ video, trigger }: { video: PromoVideoId; trigger: ReactElement }) {
  const summaryId = useId()
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="oc-promo-dialog gap-3 p-3 sm:max-w-[min(72rem,calc(100vw-3rem))] sm:p-4">
        <DialogHeader className="oc-promo-dialog-header">
          <DialogTitle>{promoVideos[video].title}</DialogTitle>
          <DialogDescription className="sr-only"><span id={summaryId}>{promoVideos[video].summary}</span></DialogDescription>
        </DialogHeader>
        <Player video={video} describedBy={summaryId} />
      </DialogContent>
    </Dialog>
  )
}

/** A text button that opens one video in a dialog, for use inside running copy (an FAQ answer). */
export function WatchVideoButton({ video, label, className }: { video: PromoVideoId; label: string; className?: string }) {
  return <VideoDialog video={video} trigger={
    <Button type="button" variant="link" className={`oc-watch-video${className ? ` ${className}` : ""}`}>
      <Play aria-hidden="true" />
      <span className="oc-watch-video-label">{label}</span>
      <Length video={video} />
    </Button>
  } />
}

/**
 * A glass card that opens one video in a dialog: a small frame of the video with a play mark, the label,
 * and one quiet line (`detail`, then the running time). The whole card is the button. `tone="navy"` is for
 * cards over a campus photo, `"light"` for the warm canvas.
 */
export function WatchVideoCard({ video, label, detail, tone = "light", className }: {
  video: PromoVideoId
  label: string
  detail?: string
  tone?: "light" | "navy"
  className?: string
}) {
  return <VideoDialog video={video} trigger={
    <button type="button" className={`oc-watch-card ${tone === "navy" ? "oc-public-glass-navy" : "oc-public-glass"}${className ? ` ${className}` : ""}`}>
      <span className="oc-watch-card-frame">
        <Image src={promoVideoPoster(video)} alt="" width={192} height={108} sizes="192px" />
        <span className="oc-watch-card-mark"><Play weight="fill" aria-hidden="true" /></span>
      </span>
      <span className="oc-watch-card-text">
        <span className="oc-watch-card-label">{label}</span>
        <span className="oc-watch-card-detail">{detail && <>{detail}<span aria-hidden="true"> · </span></>}<Length video={video} /></span>
      </span>
    </button>
  } />
}

/** A poster that plays its video in place. The whole poster is the Play target; the written summary stays under it. */
export function PromoVideoFigure({ video, className, priority = false, sizes = "(max-width: 800px) 100vw, 1100px" }: {
  video: PromoVideoId
  className?: string
  /** Set for a poster in the first screen of a page, so it is not lazy-loaded. */
  priority?: boolean
  sizes?: string
}) {
  const [playing, setPlaying] = useState(false)
  const titleId = useId(), summaryId = useId()
  const { title, summary } = promoVideos[video]
  return (
    <figure className={`oc-promo-figure oc-public-glass${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      {playing ? <div className="oc-promo-stage"><Player video={video} describedBy={summaryId} takeFocus /></div> : (
        <button type="button" className="oc-promo-stage oc-promo-target" aria-describedby={titleId} onClick={() => setPlaying(true)}>
          <Image className="oc-promo-poster" src={promoVideoPoster(video)} alt="" width={1920} height={1080} sizes={sizes} priority={priority} />
          <span className="oc-promo-play"><Play aria-hidden="true" /><span>Play video</span><Length video={video} /></span>
        </button>
      )}
      <figcaption>
        <span id={titleId} className="oc-promo-title">{title}</span>
        <span id={summaryId} className="oc-promo-summary">{summary}</span>
      </figcaption>
    </figure>
  )
}

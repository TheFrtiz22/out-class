"use client"

import { useEffect, useRef } from "react"
import { TURNSTILE_SITE_KEY, type TurnstileAction } from "@/lib/turnstile"

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}
declare global { interface Window { turnstile?: TurnstileApi } }

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let loading: Promise<TurnstileApi> | null = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable"))
    script.onerror = () => { loading = null; script.remove(); reject(new Error("Turnstile unavailable")) }
    document.head.appendChild(script)
  })
  return loading
}

/** True when forms must wait for a token before submitting. */
export const turnstileRequired = Boolean(TURNSTILE_SITE_KEY)

/**
 * Invisible unless Cloudflare needs the visitor to interact. Tokens are single
 * use: change `resetKey` after every submission so the next one gets a fresh token.
 */
export function TurnstileWidget({ action, onToken, resetKey = 0, className }: {
  action: TurnstileAction; onToken: (token: string | null) => void; resetKey?: number; className?: string
}) {
  const container = useRef<HTMLDivElement>(null), widget = useRef<string | null>(null)
  const callback = useRef(onToken)
  callback.current = onToken

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return
    let cancelled = false
    loadTurnstile().then(api => {
      if (cancelled || !container.current) return
      widget.current = api.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY, action, appearance: "interaction-only", size: "flexible", theme: "auto",
        callback: (token: string) => callback.current(token),
        "expired-callback": () => callback.current(null),
        "error-callback": () => { callback.current(null) },
      })
    }).catch(() => callback.current(null))
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [action])

  useEffect(() => {
    if (!resetKey || !widget.current) return
    callback.current(null)
    window.turnstile?.reset(widget.current)
  }, [resetKey])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={container} className={className} />
}

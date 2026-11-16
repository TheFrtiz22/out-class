"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
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
    const fail = () => { loading = null; script.remove(); reject(new Error("Turnstile unavailable")) }
    script.onload = () => window.turnstile ? resolve(window.turnstile) : fail()
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Invisible unless Cloudflare needs the visitor to interact. Tokens are single
 * use: change `resetKey` after every submission so the next one gets a fresh token.
 * If the check cannot load (blocked script, network), it says so and offers a retry.
 */
export function TurnstileWidget({ action, onToken, resetKey = 0, className }: {
  action: TurnstileAction; onToken: (token: string | null) => void; resetKey?: number; className?: string
}) {
  const container = useRef<HTMLDivElement>(null), widget = useRef<string | null>(null)
  const callback = useRef(onToken)
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0)
  useLayoutEffect(() => { callback.current = onToken })

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return
    let cancelled = false
    loadTurnstile().then(api => {
      if (cancelled || !container.current) return
      widget.current = api.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY, action, appearance: "interaction-only", size: "flexible", theme: "auto",
        // Tokens reach forms only through `callback`; no hidden input is added to the host form.
        "response-field": false,
        callback: (token: string) => { setFailed(false); callback.current(token) },
        "expired-callback": () => callback.current(null),
        "error-callback": () => { callback.current(null); setFailed(true) },
      })
    }).catch(() => { if (!cancelled) { callback.current(null); setFailed(true) } })
    return () => {
      cancelled = true
      // A token from an unmounted widget may already be spent; never reuse it.
      callback.current(null)
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [action, attempt])

  useEffect(() => {
    if (!resetKey || !widget.current) return
    callback.current(null)
    window.turnstile?.reset(widget.current)
  }, [resetKey])

  if (!TURNSTILE_SITE_KEY) return null
  return <div className={className}>
    <div ref={container} />
    {failed && <p role="alert" className="text-sm text-destructive">
      The security check couldn’t load. Check your connection or allow challenges.cloudflare.com, then{" "}
      <Button type="button" variant="link" className="h-auto p-0 text-sm underline underline-offset-4" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>try again</Button>.
    </p>}
  </div>
}

export type ClockHost = {
  now: () => Date
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void
  window: Pick<Window, "addEventListener" | "removeEventListener">
  document: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">
}

/** Minute-aligned local ticks also detect device timezone/clock changes without any I/O. */
export function startWelcomeClock(onTick: (now: Date) => void, host: ClockHost) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  const refresh = () => {
    if (stopped) return
    if (timer !== undefined) host.clearTimeout(timer)
    const now = host.now()
    onTick(now)
    if (host.document.visibilityState !== "hidden") timer = host.setTimeout(refresh, 60_000 - (+now % 60_000))
  }
  host.window.addEventListener("focus", refresh)
  host.window.addEventListener("pageshow", refresh)
  host.document.addEventListener("visibilitychange", refresh)
  refresh()
  return () => {
    stopped = true
    if (timer !== undefined) host.clearTimeout(timer)
    host.window.removeEventListener("focus", refresh)
    host.window.removeEventListener("pageshow", refresh)
    host.document.removeEventListener("visibilitychange", refresh)
  }
}

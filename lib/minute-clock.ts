import { startWelcomeClock, type ClockHost } from "@/lib/welcome-clock"

type Listener = (now: Date) => void

/**
 * One minute-aligned clock shared by every subscriber: a single timer however many views show
 * deadlines, relative times or greetings. It pauses while the tab is hidden and refreshes on focus,
 * pageshow and visibility, as the welcome clock always did. Each new subscriber gets the current
 * time immediately, then every minute boundary with the others.
 */
export function createMinuteClock(getHost: () => ClockHost) {
  const listeners = new Set<Listener>()
  let stop: (() => void) | undefined
  return {
    subscribe(listener: Listener) {
      listeners.add(listener)
      if (stop) listener(getHost().now())
      else stop = startWelcomeClock(now => { for (const fn of [...listeners]) fn(now) }, getHost())
      return () => {
        listeners.delete(listener)
        if (!listeners.size && stop) { stop(); stop = undefined }
      }
    },
    get running() { return !!stop },
  }
}

const browserHost = (): ClockHost => ({
  now: () => new Date(),
  // Native browser timers reject the ClockHost object as their receiver.
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: timer => clearTimeout(timer),
  window, document,
})

/** The app's shared minute clock. Subscribe only from effects (browser only). */
export const minuteClock = createMinuteClock(browserHost)

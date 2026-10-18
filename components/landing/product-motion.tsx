"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Pause, Play, RotateCcw } from "@/components/icons"
import { createDemoClock, prominentDemo, type DemoSample } from "./demo-clock"
import { demoTimelines, type DemoTimeline } from "./demo-timelines"

type Registration = { node: HTMLElement; activate: (active: boolean) => void }
type Coordinator = { register: (id: string, entry: Registration) => () => void }
const CoordinatorContext = createContext<Coordinator | null>(null)
const StateContext = createContext(100)
const PlaybackContext = createContext({ title: "Product", summary: "Illustrative product walkthrough.", label: "Completed preview", complete: true, reduced: true, paused: false, playing: false, toggle: () => {}, replay: () => {} })
export const useDemoState = () => useContext(StateContext)

/** One prominence coordinator for the whole journey, including short landscape viewports. */
export function DemoPlaybackProvider({ children, activeScene }: { children: ReactNode; activeScene?: string | null }) {
  const entries = useRef(new Map<string, Registration>())
  const observer = useRef<IntersectionObserver | null>(null)
  const update = useRef(() => {})
  const selectedScene = useRef(activeScene)
  useLayoutEffect(() => { selectedScene.current = activeScene; update.current() }, [activeScene])
  const register = useCallback((id: string, entry: Registration) => {
    entries.current.set(id, entry)
    observer.current?.observe(entry.node)
    update.current()
    return () => { observer.current?.unobserve(entry.node); entries.current.delete(id); update.current() }
  }, [])
  const value = useRef<Coordinator>({ register })
  useEffect(() => {
    if (!window.IntersectionObserver) return
    let frame = 0, active: string | undefined
    const registrations = entries.current
    const choose = () => {
      frame = 0
      active = document.hidden ? undefined : prominentDemo(Array.from(registrations).filter(([, entry]) => selectedScene.current === undefined || entry.node.dataset.demoScene === selectedScene.current).map(([id, entry]) => {
        const bounds = entry.node.getBoundingClientRect()
        return { id, top: bounds.top, height: bounds.height }
      }), window.innerHeight, active)
      for (const [id, entry] of registrations) entry.activate(id === active)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(choose) }
    const visibility = () => { cancelAnimationFrame(frame); frame = 0; choose() }
    const intersection = new IntersectionObserver(schedule, { threshold: [0, .15, .25, .5, .75, 1], rootMargin: "-104px 0px -24px 0px" })
    observer.current = intersection
    registrations.forEach(entry => intersection.observe(entry.node))
    update.current = schedule
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    document.addEventListener("visibilitychange", visibility)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      intersection.disconnect()
      observer.current = null
      update.current = () => {}
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      document.removeEventListener("visibilitychange", visibility)
      registrations.forEach(entry => entry.activate(false))
    }
  }, [])
  return <CoordinatorContext.Provider value={value.current}>{children}</CoordinatorContext.Provider>
}

type Snapshot = { state: number; label: string; complete: boolean; reduced: boolean; paused: boolean; playing: boolean }
const completed = (timeline: DemoTimeline): Snapshot => ({ state: timeline.finalState, label: timeline.result, complete: true, reduced: true, paused: false, playing: false })
const clamp = (value: number, max: number) => Math.max(8, Math.min(max, value))

/** A single clock controls UI beats, cursor transforms and progress without frame-by-frame renders. */
export function ProductMotion({ children, scene, resetKey }: { children: ReactNode; scene: keyof typeof demoTimelines; resetKey: string }) {
  const timeline = demoTimelines[scene]
  const coordinator = useContext(CoordinatorContext)
  const root = useRef<HTMLDivElement>(null)
  const commands = useRef({ toggle: () => {}, replay: () => {} })
  const refreshLayout = useRef(() => {})
  const [snapshot, setSnapshot] = useState<{ key: string; value: Snapshot }>(() => ({ key: resetKey, value: completed(timeline) }))
  const state = snapshot.key === resetKey ? snapshot.value : completed(timeline)

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const surface = element.querySelector<HTMLElement>(".oc-story-interface")!
    const observation = element.querySelector<HTMLElement>(".oc-demo-observation")!
    const cursor = element.querySelector<HTMLElement>(".oc-demo-cursor")!
    const pointer = cursor.querySelector<SVGElement>(".oc-demo-cursor-pointer")!
    const click = cursor.querySelector<HTMLElement>(".oc-demo-click")!
    const fill = element.querySelector<HTMLElement>(".oc-demo-progress-fill")!
    const progress = element.querySelector<HTMLElement>(".oc-demo-progress")!
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let active = false, paused = false, dirty = true, lastPercent = -1
    let from = { x: 0, y: 0 }, to = { x: 0, y: 0 }
    let width = 0, height = 0
    let published = "", target: HTMLElement | null = null
    refreshLayout.current = () => { dirty = true }
    const publish = (sample: DemoSample) => {
      const value: Snapshot = { state: sample.state, label: sample.label, complete: sample.complete, reduced: preference.matches, paused, playing: active && !paused && !preference.matches && !sample.complete }
      const signature = `${value.state}:${value.label}:${value.complete}:${value.reduced}:${value.paused}:${value.playing}`
      if (signature !== published) { published = signature; setSnapshot({ key: resetKey, value }) }
      if (element.dataset.demoPlaying !== String(value.playing)) element.dataset.demoPlaying = String(value.playing)
      if (element.dataset.demoComplete !== String(value.complete)) element.dataset.demoComplete = String(value.complete)
      if (element.dataset.demoState !== String(sample.state)) element.dataset.demoState = String(sample.state)
    }
    const render = (sample: DemoSample) => {
      fill.style.transform = `scaleX(${sample.progress})`
      const response = sample.response.toFixed(4)
      if (surface.style.getPropertyValue("--oc-demo-response") !== response) surface.style.setProperty("--oc-demo-response", response)
      const percent = Math.round(sample.progress * 100)
      if (percent !== lastPercent) { progress.setAttribute("aria-valuenow", String(percent)); lastPercent = percent }
      publish(sample)
      const beat = timeline.beats[0]
      if (sample.elapsed === 0) {
        dirty = true
        observation.scrollTop = 0
        target?.removeAttribute("data-demo-hover")
        target?.removeAttribute("data-demo-press")
        delete element.dataset.demoTarget
      }
      if (preference.matches || sample.elapsed < beat.start || sample.complete) {
        cursor.style.opacity = "0"
        target?.removeAttribute("data-demo-hover")
        target?.removeAttribute("data-demo-press")
        element.dataset.demoPressing = "false"
        return
      }
      if (dirty) {
        const bounds = surface.getBoundingClientRect()
        target = surface.querySelector<HTMLElement>(`[data-demo-target="${beat.target}"]`)
        if (!target) return
        const box = target.getBoundingClientRect()
        width = bounds.width; height = bounds.height
        to = { x: clamp(box.left + box.width * .62 - bounds.left - 2, width - 26), y: clamp(box.top + box.height * .5 - bounds.top - 2, height - 32) }
        from = { x: clamp(to.x - 64, width - 26), y: clamp(to.y + 30, height - 32) }
        dirty = false
      }
      // One short curved path, accelerating and arriving at rest before the hover.
      const eased = sample.movement ** 2 * (3 - 2 * sample.movement)
      const x = clamp(from.x + (to.x - from.x) * eased, width - 26)
      const y = clamp(from.y + (to.y - from.y) * eased + Math.sin(Math.PI * eased) * 5, height - 32)
      cursor.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`
      cursor.style.opacity = String(sample.elapsed > beat.respond + 450 ? Math.max(0, 1 - (sample.elapsed - beat.respond - 450) / 300) : Math.min(1, (sample.elapsed - beat.start) / 180))
      const press = sample.pressing < 0 ? 0 : Math.sin(Math.PI * sample.pressing)
      pointer.style.transform = `scale(${1 - press * .065})`
      click.style.opacity = String(press * .4)
      click.style.transform = `scale(${.8 + press * .2})`
      if (target) {
        target.dataset.demoHover = String(sample.movement === 1 && sample.elapsed < beat.respond)
        target.dataset.demoPress = String(sample.pressing >= 0)
      }
      element.dataset.demoTarget = beat.target
      element.dataset.demoPressing = String(sample.pressing >= 0)
    }
    const clock = createDemoClock(timeline, render, requestAnimationFrame, cancelAnimationFrame)
    const sync = () => { clock.setEligible(active && !document.hidden); publish(clock.sample()) }
    const reduce = () => { clock.setReduced(preference.matches); sync() }
    clock.replay()
    if (preference.matches || !coordinator || !window.IntersectionObserver) clock.setReduced(true)
    const unregister = coordinator?.register(resetKey, { node: element, activate: value => { active = value; sync() } })
    commands.current = {
      toggle: () => { if (preference.matches || clock.sample().complete) return; paused = !paused; clock.setPaused(paused); publish(clock.sample()) },
      replay: () => { paused = false; published = ""; dirty = true; clock.replay(); publish(clock.sample()) },
    }
    const resize = window.ResizeObserver ? new ResizeObserver(() => { dirty = true; if (paused || !active) render(clock.sample()) }) : null
    resize?.observe(surface)
    preference.addEventListener("change", reduce)
    return () => {
      unregister?.()
      clock.dispose()
      resize?.disconnect()
      preference.removeEventListener("change", reduce)
      commands.current = { toggle: () => {}, replay: () => {} }
      refreshLayout.current = () => {}
    }
  }, [coordinator, resetKey, timeline])

  // Remeasure after the result commits, keeping the cursor aligned across reflow.
  useLayoutEffect(() => { refreshLayout.current() }, [state.state])

  return <div ref={root} className="oc-product-motion" role="group" aria-label={`${timeline.title} product demonstration`} aria-describedby={`${resetKey}-summary`} data-demo-scene={scene} data-demo-complete={state.complete} data-demo-paused={state.paused} data-demo-playing={state.playing}>
    <PlaybackContext.Provider value={{ ...state, title: timeline.title, summary: timeline.summary, toggle: () => commands.current.toggle(), replay: () => commands.current.replay() }}>
      <StateContext.Provider value={state.state}>{children}<p id={`${resetKey}-summary`} className="sr-only">{timeline.summary}</p></StateContext.Provider>
    </PlaybackContext.Provider>
  </div>
}

/** Playback controls remain outside the inert simulated interface. */
export function ProductMotionControl() {
  const { title, complete, reduced, paused, toggle, replay } = useContext(PlaybackContext)
  return <div className="oc-preview-playback" role="group" aria-label={`${title} playback controls`}>
    <button type="button" className="oc-demo-toggle" data-complete={complete || reduced} disabled={complete || reduced} aria-label={`${paused ? "Resume" : "Pause"} ${title} demonstration`} onClick={toggle}>
      {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}<span>{paused ? "Resume" : "Pause"}</span>
    </button>
    <button type="button" className="oc-demo-replay" aria-label={`Replay ${title} demonstration`} onClick={replay}><RotateCcw size={16} aria-hidden="true" /><span>Replay</span></button>
  </div>
}

export function ProductDemoProgress() {
  const { title, complete, reduced, label } = useContext(PlaybackContext)
  return <>
    <div className="oc-demo-playback-caption"><span>{reduced ? `${title} · completed preview` : label}</span><span>Illustrative interface · sample information</span></div>
    <div className="oc-demo-progress" role="progressbar" aria-label={`${title} playback progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={complete ? 100 : 0}><span className="oc-demo-progress-fill" /></div>
  </>
}

/** Real pointer/touch events pass through this decorative cursor. Its tip is the target anchor. */
export function DemoCursor() {
  return <div className="oc-demo-cursor" aria-hidden="true"><span className="oc-demo-click" /><svg className="oc-demo-cursor-pointer" width="22" height="28" viewBox="0 0 22 28" fill="none"><path d="M2 2v19l5.8-5 4.2 9 4-2-4.2-8.6 8.2-1.1L2 2Z" fill="#fffefa" stroke="#142d45" strokeWidth="1.4" strokeLinejoin="round" /></svg></div>
}

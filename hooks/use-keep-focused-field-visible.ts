"use client"

import { useEffect, type RefObject } from "react"

const TEXT_TYPES = new Set(["text", "search", "email", "url", "tel", "number", "password"])
const MARGIN = 12
type Band = { top: number; bottom: number }

/** A field the on-screen keyboard opens for: an editable textarea or text-like input. */
export function isKeyboardField(node: unknown): node is HTMLTextAreaElement | HTMLInputElement {
  if (node instanceof HTMLTextAreaElement) return !node.readOnly && !node.disabled
  return node instanceof HTMLInputElement && TEXT_TYPES.has(node.type) && !node.readOnly && !node.disabled
}

/** Where the caret line sits in a textarea, in client coordinates (a hidden mirror lays out the text before it). */
function caretBand(field: HTMLTextAreaElement, rect: DOMRect): Band {
  const style = getComputedStyle(field), mirror = document.createElement("div"), marker = document.createElement("span")
  for (const key of ["boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "textTransform", "wordSpacing", "textIndent", "tabSize"] as const) mirror.style[key] = style[key]
  Object.assign(mirror.style, { position: "absolute", top: "0", left: "-9999px", visibility: "hidden", whiteSpace: "pre-wrap", overflowWrap: "break-word", height: "auto", overflow: "hidden" })
  mirror.setAttribute("aria-hidden", "true")
  mirror.textContent = field.value.slice(0, field.selectionEnd ?? field.value.length)
  marker.textContent = "​"
  mirror.append(marker)
  document.body.append(mirror)
  const lineTop = marker.offsetTop, line = marker.offsetHeight || parseFloat(style.lineHeight) || 24
  mirror.remove()
  const top = Math.min(Math.max(rect.top + lineTop - field.scrollTop, rect.top), rect.bottom - line)
  return { top: Math.max(top - line, rect.top) - MARGIN, bottom: Math.min(top + line * 2, rect.bottom) + MARGIN }
}

/** Scroll distance that brings target into band; a target taller than the band keeps its top edge. */
function distance(target: Band, band: Band) {
  if (target.top < band.top) return target.top - band.top
  if (target.bottom > band.bottom) return Math.min(target.bottom - band.bottom, target.top - band.top)
  return 0
}

function scrollsVertically(node: HTMLElement) {
  return /(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight
}

/**
 * Keeps a focused field above the on-screen keyboard. Each scrollable ancestor moves only as far as
 * needed (block: "nearest"), then the page moves within the visual viewport, which is the part of the
 * screen the keyboard leaves visible on iOS as well as Android. A field taller than the visible area
 * keeps its caret line visible instead of its top edge.
 */
export function revealKeyboardField(field: HTMLTextAreaElement | HTMLInputElement, behavior: ScrollBehavior) {
  const viewport = window.visualViewport
  const viewTop = viewport?.offsetTop ?? 0, viewBottom = viewTop + (viewport?.height ?? window.innerHeight)
  // The page's scroll-padding-top already clears the sticky focus bar for anchors; honor it here too.
  const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
  const page: Band = { top: viewTop + Math.min(padding, (viewBottom - viewTop) / 3), bottom: viewBottom - MARGIN }
  const containers: HTMLElement[] = []
  for (let node = field.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) if (scrollsVertically(node)) containers.push(node)
  const bands = containers.map(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } })
  const visible = bands.reduce((space, band) => Math.min(space, band.bottom - band.top), page.bottom - page.top)
  const rect = field.getBoundingClientRect()
  let target: Band = { top: rect.top - MARGIN, bottom: rect.bottom + MARGIN }
  if (target.bottom - target.top > visible && field instanceof HTMLTextAreaElement) target = caretBand(field, rect)
  containers.forEach((node, index) => {
    const band = { top: Math.max(bands[index].top, page.top), bottom: Math.min(bands[index].bottom, page.bottom) }
    const next = Math.min(Math.max(node.scrollTop + distance(target, band), 0), node.scrollHeight - node.clientHeight)
    const moved = next - node.scrollTop
    if (Math.abs(moved) < 1) return
    node.scrollTo({ top: next, behavior })
    // An inner container scrolling moves the target; outer containers measure from where it will land.
    target = { top: target.top - moved, bottom: target.bottom - moved }
  })
  const delta = distance(target, page)
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior })
}

/**
 * When a text field inside root gains focus, or the visual viewport shrinks (the on-screen keyboard
 * opening) while one is focused, scroll it into view. Smooth scrolling only without reduced motion;
 * pinch zoom (a scale change) is left alone.
 */
export function useKeepFocusedFieldVisible(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport, reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    let frame = 0, scale = viewport?.scale ?? 1
    const focused = () => { const node = document.activeElement; return isKeyboardField(node) && rootRef.current?.contains(node) ? node : null }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { const field = focused(); if (field) revealKeyboardField(field, reduce?.matches ? "auto" : "smooth") })
    }
    const onFocus = (event: FocusEvent) => { if (isKeyboardField(event.target) && rootRef.current?.contains(event.target)) schedule() }
    const onResize = () => {
      const next = viewport?.scale ?? 1
      if (next !== scale) { scale = next; return }
      if (focused()) schedule()
    }
    document.addEventListener("focusin", onFocus)
    viewport?.addEventListener("resize", onResize)
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("focusin", onFocus)
      viewport?.removeEventListener("resize", onResize)
      window.removeEventListener("resize", onResize)
    }
  }, [rootRef])
}

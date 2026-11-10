"use client"
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** `label` may hold a count or icon; give `ariaLabel` when the visible label is not the full name. */
type Option<T extends string> = { value: T; label: ReactNode; ariaLabel?: string; disabled?: boolean }
type Common<T extends string> = { label: string; options: Option<T>[]; className?: string; animated?: boolean; size?: "default" | "compact"; id?: string }
type Single<T extends string> = Common<T> & { multiple?: false; value: T; onChange: (value: T) => void }
type Multiple<T extends string> = Common<T> & { multiple: true; value: T[]; onChange: (value: T[]) => void }

/**
 * The one segmented control (docs/design-system.md): the workspace pill's glass track.
 * Both modes are a labelled group of aria-pressed toggle buttons (the contract tests and scripts read);
 * single-select adds a sliding navy indicator, `multiple` makes filter chips. Roving focus: arrow keys
 * move, Home/End jump, Space/Enter choose.
 * For tab panels use `Tabs` with the segmented `TabsList` instead.
 */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export function SegmentedControl<T extends string>(props: Single<T> | Multiple<T>) {
  const { label, options, className, animated = true, size = "default", id } = props
  const group = useRef<HTMLDivElement>(null)
  const selected = (value: T) => props.multiple ? props.value.includes(value) : props.value === value
  const index = props.multiple ? -1 : options.findIndex(option => option.value === props.value)
  const enabled = options.map((option, i) => option.disabled ? -1 : i).filter(i => i >= 0)
  // Roving focus: one tab stop, on the selected option (or the first enabled one).
  const stop = props.multiple ? enabled[0] ?? 0 : index >= 0 && !options[index]?.disabled ? index : enabled[0] ?? 0
  const sliding = !props.multiple && animated && options.length <= 4
  // The indicator follows the selected segment's measured box, so unequal or scrolled segments stay covered.
  useBrowserLayoutEffect(() => {
    const el = group.current
    if (!sliding || !el) return
    const place = () => {
      const selectedButton = el.querySelectorAll<HTMLButtonElement>("[data-segment]")[index]
      if (!selectedButton) { el.removeAttribute("data-measured"); return }
      el.style.setProperty("--indicator-x", `${selectedButton.offsetLeft}px`)
      el.style.setProperty("--indicator-width", `${selectedButton.offsetWidth}px`)
      el.setAttribute("data-measured", "true")
    }
    place()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(place)
    observer.observe(el)
    el.querySelectorAll("[data-segment]").forEach(button => observer.observe(button))
    return () => observer.disconnect()
  }, [sliding, index, options.length])
  const choose = (value: T) => {
    if (props.multiple) props.onChange(props.value.includes(value) ? props.value.filter(v => v !== value) : [...props.value, value])
    else props.onChange(value)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const at = enabled.indexOf(i)
    const target = event.key === "ArrowRight" || event.key === "ArrowDown" ? enabled[(at + 1) % enabled.length]
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? enabled[(at - 1 + enabled.length) % enabled.length]
      : event.key === "Home" ? enabled[0] : event.key === "End" ? enabled[enabled.length - 1] : undefined
    if (target === undefined) return
    event.preventDefault()
    group.current?.querySelectorAll<HTMLButtonElement>("[data-segment]")[target]?.focus()
  }
  return <div ref={group} id={id} role="group" aria-label={label}
    className={cn("oc-segmented-control", className)} data-slot="segmented-control" data-size={size} data-multiple={props.multiple || undefined}
    data-sliding={sliding || undefined} data-has-active={!props.multiple && index >= 0}
    style={sliding ? { "--segment-count": options.length, "--segment-index": Math.max(0, index) } as CSSProperties : undefined}>
    {sliding && <span className="oc-segmented-indicator" aria-hidden="true" />}
    {options.map((option, i) => <button type="button" key={option.value} data-segment="" disabled={option.disabled}
      aria-pressed={selected(option.value)} aria-label={option.ariaLabel}
      data-selected={selected(option.value) || undefined} tabIndex={i === stop ? 0 : -1}
      onClick={() => choose(option.value)} onKeyDown={event => onKeyDown(event, i)}>{option.label}</button>)}
  </div>
}

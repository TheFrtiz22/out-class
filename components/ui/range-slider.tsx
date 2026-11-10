"use client"
import { useEffect, useId, useRef, useState } from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

type Common = {
  /** Visible label and the thumbs' accessible name, e.g. "Minimum GPA". */
  label: string
  min: number
  max: number
  step: number
  /** Formats a value for the bubble and aria-valuetext; defaults to the step's decimal places. */
  format?: (value: number) => string
  disabled?: boolean
  className?: string
  id?: string
}
/** One thumb. `null` is the "no minimum" state: the thumb rests at `min` and nothing is filtered. */
type Minimum = Common & {
  value: number | null; onChange: (value: number | null) => void; noneLabel?: string; range?: false
  /** Default true: resting at `min` means "no minimum". Set false where a floor at `min` is a real, saved
   * setting distinct from none (rule thresholds); the exact-value box, emptied, then clears it. */
  nullAtMin?: boolean
}
/** Two thumbs. */
type Range = Common & { value: [number, number]; onChange: (value: [number, number]) => void; range: true; noneLabel?: never; nullAtMin?: never }

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * The pill slider: a single minimum (GPA 0–4, SAT 400–1600, ACT 1–36, rating 0–10) or a two-thumb range.
 * Arrow keys, Page Up/Down and Home/End move the thumb (Radix). The value bubble is a button: click it
 * to type an exact value; Enter or blur commits, Escape cancels, an empty entry clears the minimum.
 */
export function RangeSlider(props: Minimum | Range) {
  const { label, min, max, step, disabled, className, id } = props
  const places = decimals(step)
  const format = props.format ?? ((value: number) => value.toFixed(places))
  const round = (value: number) => Number((Math.round((value - min) / step) * step + min).toFixed(places))
  const generated = useId(), labelId = `${generated}-label`
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) input.current?.select() }, [editing])

  const nullAtMin = props.range ? false : props.nullAtMin ?? true
  const none = !props.range && props.value === null
  const thumbs = props.range ? props.value : [props.value ?? min]
  const noneLabel = props.range ? "" : props.noneLabel ?? "No minimum"
  const display = props.range ? `${format(props.value[0])} – ${format(props.value[1])}` : props.value === null ? noneLabel : format(props.value)

  const commitSlider = (values: number[]) => {
    if (props.range) props.onChange([values[0], values[1]])
    // Resting at the minimum is "no minimum": a floor at the bottom of the scale filters nothing.
    else props.onChange(nullAtMin && values[0] <= min ? null : round(values[0]))
  }
  const commitDraft = () => {
    setEditing(false)
    const text = draft.trim()
    if (props.range) {
      const [a, b] = text.split(/[^\d.]+/).filter(Boolean).map(Number)
      if (Number.isFinite(a) && Number.isFinite(b)) props.onChange([round(clamp(Math.min(a, b), min, max)), round(clamp(Math.max(a, b), min, max))])
      return
    }
    if (!text) { props.onChange(null); return }
    const parsed = Number(text)
    if (Number.isFinite(parsed)) props.onChange(nullAtMin && parsed <= min ? null : round(clamp(parsed, min, max)))
  }

  return <div className={cn("oc-range-slider", className)} data-slot="range-slider" data-empty={none || undefined} data-disabled={disabled || undefined}>
    <div className="oc-range-slider-head">
      <span id={labelId} className="oc-range-slider-label">{label}</span>
      {editing
        ? <input ref={input} id={id} className="oc-range-slider-input" inputMode="decimal" aria-label={`${label}, exact value`}
          value={draft} placeholder={props.range ? `${format(min)}–${format(max)}` : noneLabel}
          onChange={event => setDraft(event.target.value)} onBlur={commitDraft}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commitDraft() } else if (event.key === "Escape") { event.preventDefault(); setEditing(false) } }} />
        : <button type="button" className="oc-range-slider-value" disabled={disabled} aria-label={`${label}: ${display}. Edit exact value`}
          onClick={() => { setDraft(props.range ? `${format(props.value[0])}–${format(props.value[1])}` : props.value === null ? "" : format(props.value)); setEditing(true) }}>{display}</button>}
    </div>
    <SliderPrimitive.Root className="oc-range-slider-root" min={min} max={max} step={step} value={thumbs} disabled={disabled}
      minStepsBetweenThumbs={props.range ? 0 : undefined} onValueChange={commitSlider} aria-labelledby={labelId}>
      <SliderPrimitive.Track className="oc-range-slider-track">
        <SliderPrimitive.Range className="oc-range-slider-range" />
      </SliderPrimitive.Track>
      {thumbs.map((value, index) => <SliderPrimitive.Thumb key={index} className="oc-range-slider-thumb"
        aria-label={props.range ? `${label} ${index === 0 ? "from" : "to"}` : label}
        aria-valuetext={none ? noneLabel : format(value)} />)}
    </SliderPrimitive.Root>
  </div>
}

"use client"

import { useEffect, useId, useRef, useState } from "react"
import { WEEK_DAYS, paintCells } from "@/lib/availability"
import { AVAILABILITY_SLOTS, AVAILABILITY_FIRST_SLOT, AVAILABILITY_END_SLOT, minuteLabel } from "@/lib/scheduling-config"
import { Button } from "@/components/ui/button"
import "./availability.css"

type Position = { day: number; slot: number }
export { minuteLabel } from "@/lib/scheduling-config"

export function WeeklyCalendar({ days, dates, knownDays, onChange, counts, onSelect, readOnly = false }: {
  days: boolean[][]; dates?: string[]; knownDays?: boolean[]; onChange?: (days: boolean[][], changedDays: number[]) => void
  counts?: number[][]; onSelect?: (day: number, slot: number) => void; readOnly?: boolean
}) {
  const [mobileDay, setMobileDay] = useState(0), [touchEdit, setTouchEdit] = useState(false), [mobile, setMobile] = useState(false)
  const [focus, setFocus] = useState<Position>({ day: 0, slot: AVAILABILITY_FIRST_SLOT })
  const [preview, setPreview] = useState<boolean[][] | null>(null)
  const instructionsId = useId()
  const displayed = preview ?? days
  const grid = useRef<HTMLDivElement>(null), suppressClick = useRef(false)
  const drag = useRef<{ pointer: number; from: Position; base: boolean[][]; on: boolean; to: Position } | null>(null)
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)")
    const update = () => setMobile(query.matches)
    update(); query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  function paint(from: Position, to: Position, base: boolean[][], on: boolean) {
    const changedDays = Array.from({ length: Math.abs(to.day - from.day) + 1 }, (_, i) => Math.min(from.day, to.day) + i)
    const next = paintCells(base, from, to, on)
    if (drag.current) { drag.current.to = to; setPreview(next) } else onChange?.(next, changedDays)
  }
  function moveFocus(to: Position) {
    setFocus(to)
    grid.current?.querySelector<HTMLButtonElement>(`[data-av-cell="${to.day}:${to.slot}"]`)?.focus()
  }
  function finish() {
    const active = drag.current
    if (!active) return
    drag.current = null; setPreview(null)
    paint(active.from, active.to, active.base, active.on)
  }
  function cancel() {
    drag.current = null; setPreview(null)
  }
  return <div className="oc-availability-calendar" data-unsaved={preview !== null}>
    {!readOnly && <p role="status" className="mb-2 min-h-4 text-xs text-muted-foreground">{preview ? "Editing selection · release to save." : "Selections save after you release."}</p>}
    <div className="mb-3 flex flex-wrap items-center gap-2 sm:hidden" role="group" aria-label="Day to edit">
      {WEEK_DAYS.map((day, i) => <Button key={day} variant={mobileDay === i ? "default" : "outline"} className="min-h-11 px-3" aria-pressed={mobileDay === i} onClick={() => { setMobileDay(i); setFocus({ day: i, slot: focus.slot }) }}>{day.slice(0, 3)}</Button>)}
    </div>
    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><p id={instructionsId}>{readOnly ? "Arrow keys move between times. Home and End move to the first and last time." : "Click or tap a time to add or remove it. Arrow keys move; Space or Enter toggles; Shift + arrows extends. You can also drag; Escape cancels a drag."}</p>{!readOnly && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={touchEdit} onChange={e => setTouchEdit(e.target.checked)} />Enable touch dragging (turn off to scroll)</label>}</div>
    <div ref={grid} className="oc-av-scroll" role="grid" aria-label={counts ? "Interviewer availability by quarter hour" : "Weekly availability by quarter hour"} aria-describedby={instructionsId} aria-multiselectable="true" aria-readonly={readOnly && !onSelect} aria-rowcount={AVAILABILITY_SLOTS.length + 1} aria-colcount={mobile ? 2 : 8}
      style={{ touchAction: touchEdit && !readOnly ? "none" : "pan-y" }}
      onPointerMove={event => {
        const active = drag.current
        if (!active || event.pointerId !== active.pointer) return
        const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-av-cell]")
        if (!cell || !grid.current?.contains(cell)) return
        const [day, slot] = cell.dataset.avCell!.split(":").map(Number)
        paint(active.from, { day, slot }, active.base, active.on)
      }} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
      <div role="row" className="oc-av-row oc-av-header"><span role="columnheader" aria-colindex={1}>Time</span>{WEEK_DAYS.map((day, i) => <div key={day} role="columnheader" aria-colindex={mobile ? 2 : i + 2} className={`oc-av-day ${mobileDay === i ? "is-mobile-day" : ""}`}>{day.slice(0, 3)}{dates && <small>{dates[i].slice(5)}</small>}</div>)}</div>
      {AVAILABILITY_SLOTS.map(slot => <div key={slot} role="row" className="oc-av-row">
        <span className="oc-av-time" role="rowheader" aria-colindex={1}><span className={slot % 4 === 0 || mobile ? undefined : "sr-only"}>{minuteLabel(slot * 15)}</span></span>
        {WEEK_DAYS.map((day, i) => <button key={day} type="button" role="gridcell" aria-colindex={mobile ? 2 : i + 2} aria-selected={displayed[i][slot]} aria-readonly={readOnly && !onSelect} data-av-cell={`${i}:${slot}`}
          aria-label={`${day}${dates ? ` ${dates[i]}` : ""}, ${minuteLabel(slot * 15)}–${minuteLabel((slot + 1) * 15)}: ${counts ? `${counts[i][slot]} available interviewers` : displayed[i][slot] ? "available" : knownDays?.[i] === false ? "unknown" : "unavailable"}`}
          tabIndex={(mobile ? mobileDay === i : focus.day === i) && focus.slot === slot ? 0 : -1}
          className={`oc-av-cell oc-av-day ${mobileDay === i ? "is-mobile-day" : ""} ${displayed[i][slot] ? "is-available" : knownDays?.[i] === false ? "is-unknown" : ""} ${slot % 4 === 0 ? "is-hour" : ""}`}
          style={counts && counts[i][slot] > 0 ? { backgroundColor: `rgba(232, 91, 25, ${Math.min(.7, .15 + counts[i][slot] * .1)})`, color: "var(--foreground)", fontWeight: 600 } : undefined}
          onFocus={() => { setFocus({ day: i, slot }); setMobileDay(i) }}
          onPointerDown={event => {
            suppressClick.current = false
            if (readOnly || event.button !== 0 || !event.isPrimary || event.pointerType === "touch" && !touchEdit) return
            event.preventDefault(); suppressClick.current = true
            const from = { day: i, slot }, on = !days[i][slot]
            drag.current = { pointer: event.pointerId, from, to: from, base: days, on }
            grid.current?.setPointerCapture(event.pointerId)
            moveFocus(from); paint(from, from, days, on)
          }}
          onClick={event => {
            if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return }
            onSelect?.(i, slot)
            if (!readOnly) paint({ day: i, slot }, { day: i, slot }, days, !days[i][slot])
          }}
          onKeyDown={event => {
            if (event.key === "Escape" && drag.current) { event.preventDefault(); cancel(); return }
            const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key]
            if (!delta && event.key !== "Home" && event.key !== "End") return
            event.preventDefault()
            const to = { day: Math.max(0, Math.min(6, i + (delta?.[0] ?? 0))), slot: event.key === "Home" ? AVAILABILITY_FIRST_SLOT : event.key === "End" ? AVAILABILITY_END_SLOT - 1 : Math.max(AVAILABILITY_FIRST_SLOT, Math.min(AVAILABILITY_END_SLOT - 1, slot + (delta?.[1] ?? 0))) }
            if (event.shiftKey && !readOnly) paint({ day: i, slot }, to, days, days[i][slot])
            if (mobile && to.day !== mobileDay) { setMobileDay(to.day); requestAnimationFrame(() => moveFocus(to)) }
            else moveFocus(to)
          }}>{counts ? counts[i][slot] || "" : <span className="sr-only">{days[i][slot] ? "Available" : "Not marked"}</span>}</button>)}
      </div>)}
    </div>
  </div>
}

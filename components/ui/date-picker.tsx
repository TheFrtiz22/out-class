"use client"
import { useEffect, useId, useRef, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "@/components/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { formatDay, isIsoDay, monthGrid, monthOf, moveDay, addMonths, todayIn } from "@/lib/date-picker"

/**
 * OutClass date picker: a field-like button that opens a month grid in a popover.
 * Value is a YYYY-MM-DD string ("" for none). Arrow keys, Home/End and Page Up/Down
 * move through days; Enter or Space picks; Escape closes. `marked` days (e.g. days that
 * have interviews) carry a dot and are announced.
 */
export function DatePicker({ value, onChange, label, placeholder = "Any date", marked = [], markedLabel = "has events", className, clearLabel = "Any date" }: {
  value: string; onChange: (value: string) => void; label: string; placeholder?: string
  marked?: string[]; markedLabel?: string; className?: string; clearLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const today = todayIn()
  const selected = isIsoDay(value) ? value : ""
  const [focusDay, setFocusDay] = useState(selected || today)
  const grid = useRef<HTMLTableElement>(null)
  const headingId = useId()
  useEffect(() => { if (open) setFocusDay(selected || today) }, [open, selected, today])
  useEffect(() => { if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus() }, [open, focusDay])
  const markedDays = new Set(marked)
  const pick = (day: string) => { onChange(day); setOpen(false) }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label={`${label}: ${selected ? formatDay(selected, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : placeholder}`} className={cn("oc-date-picker-trigger", className)} data-empty={!selected}>
        <CalendarDays aria-hidden="true" />{selected ? formatDay(selected) : placeholder}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="oc-date-picker w-auto p-3" onOpenAutoFocus={event => { event.preventDefault(); event.currentTarget instanceof HTMLElement && event.currentTarget.querySelector<HTMLButtonElement>(`[data-day="${selected || today}"]`)?.focus() }}>
      <div className="oc-date-picker-header">
        <button type="button" aria-label="Previous month" onClick={() => setFocusDay(addMonths(focusDay, -1))}><ChevronLeft aria-hidden="true" /></button>
        <h2 id={headingId} aria-live="polite">{formatDay(`${monthOf(focusDay)}-01`, { month: "long", year: "numeric" })}</h2>
        <button type="button" aria-label="Next month" onClick={() => setFocusDay(addMonths(focusDay, 1))}><ChevronRight aria-hidden="true" /></button>
      </div>
      <table ref={grid} role="grid" aria-labelledby={headingId} className="oc-date-picker-grid">
        <thead><tr>{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, index) => <th key={day} scope="col" abbr={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]}>{day}</th>)}</tr></thead>
        <tbody>{monthGrid(focusDay).map(week => <tr key={week[0]}>{week.map(day => {
          const outside = monthOf(day) !== monthOf(focusDay), isMarked = markedDays.has(day)
          return <td key={day} role="gridcell" aria-selected={day === selected}>
            <button type="button" data-day={day} tabIndex={day === focusDay ? 0 : -1} data-outside={outside} data-marked={isMarked} aria-current={day === today ? "date" : undefined}
              aria-label={`${formatDay(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${isMarked ? `, ${markedLabel}` : ""}`}
              onClick={() => pick(day)}
              onKeyDown={event => { const next = moveDay(day, event.key, event.shiftKey); if (next) { event.preventDefault(); setFocusDay(next) } }}>
              {Number(day.slice(8))}
            </button>
          </td>
        })}</tr>)}</tbody>
      </table>
      <div className="oc-date-picker-footer">
        <button type="button" onClick={() => pick(today)}>Today</button>
        {selected && <button type="button" onClick={() => pick("")}>{clearLabel}</button>}
      </div>
    </PopoverContent>
  </Popover>
}

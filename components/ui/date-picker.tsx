"use client"

import * as React from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { cn } from "@/lib/utils"

/*
 * Calendar math on "YYYY-MM-DD" day keys. A key is a calendar date, not an
 * instant: every conversion goes through Date.UTC and getUTC*, so the browser's
 * own time zone can never shift a day.
 */
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDayKey(value: string | undefined | null): value is string {
  const m = value ? KEY.exec(value) : null
  if (!m) return false
  const at = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return at.getUTCFullYear() === +m[1] && at.getUTCMonth() === +m[2] - 1 && at.getUTCDate() === +m[3]
}
function parts(key: string) { const [y, m, d] = key.split("-").map(Number); return { y, m, d } }
function fromUtc(ms: number) { return new Date(ms).toISOString().slice(0, 10) }
export function addDayKeys(key: string, days: number) { const { y, m, d } = parts(key); return fromUtc(Date.UTC(y, m - 1, d + days)) }
export function daysInMonth(year: number, month: number) { return new Date(Date.UTC(year, month, 0)).getUTCDate() }
/** Moves by whole months and keeps the day, clamped to the target month's length (Jan 31 + 1 month = Feb 28/29). */
export function addMonthKeys(key: string, months: number) {
  const { y, m, d } = parts(key), first = new Date(Date.UTC(y, m - 1 + months, 1))
  const year = first.getUTCFullYear(), month = first.getUTCMonth() + 1
  return fromUtc(Date.UTC(year, month - 1, Math.min(d, daysInMonth(year, month))))
}
/** 0 = Sunday. */
export function weekdayOf(key: string) { const { y, m, d } = parts(key); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
export function startOfWeekKey(key: string) { return addDayKeys(key, -weekdayOf(key)) }
export function endOfWeekKey(key: string) { return addDayKeys(key, 6 - weekdayOf(key)) }
export function clampDayKey(key: string, min?: string, max?: string) {
  if (min && isDayKey(min) && key < min) return min
  if (max && isDayKey(max) && key > max) return max
  return key
}
export function isDayKeyDisabled(key: string, min?: string, max?: string) {
  return (!!min && isDayKey(min) && key < min) || (!!max && isDayKey(max) && key > max)
}
/** Sunday-first weeks covering the month of `key`, including adjacent-month days that fill the first and last week. */
export function monthGrid(key: string) {
  const { y, m } = parts(key), first = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`
  const last = addDayKeys(first, daysInMonth(y, m) - 1), weeks: string[][] = []
  for (let day = startOfWeekKey(first); day <= endOfWeekKey(last); day = addDayKeys(day, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDayKeys(day, i)))
  return weeks
}
/** The key a calendar keystroke moves focus to, or null when the key is not a navigation key. */
export function moveDayKey(key: string, keyName: string, shift = false): string | null {
  switch (keyName) {
    case "ArrowLeft": return addDayKeys(key, -1)
    case "ArrowRight": return addDayKeys(key, 1)
    case "ArrowUp": return addDayKeys(key, -7)
    case "ArrowDown": return addDayKeys(key, 7)
    case "PageUp": return addMonthKeys(key, shift ? -12 : -1)
    case "PageDown": return addMonthKeys(key, shift ? 12 : 1)
    case "Home": return startOfWeekKey(key)
    case "End": return endOfWeekKey(key)
    default: return null
  }
}
function utcFormat(key: string, options: Intl.DateTimeFormatOptions) {
  const { y, m, d } = parts(key)
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)))
}
export function formatDayKey(key: string, style: "short" | "long" = "short") {
  return utcFormat(key, style === "long" ? { weekday: "long", month: "long", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" })
}
export function todayDayKey(timeZone = SCHEDULING_TIMEZONE, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

type DatePickerProps = {
  /** "YYYY-MM-DD" or "" for no date — the same contract as a native date input. */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
  id?: string
  name?: string
  placeholder?: string
  /** Offer a Clear action, for optional filters. */
  clearable?: boolean
  /** Override the today marker; defaults to today on the scheduling calendar. */
  today?: string
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
}

export function DatePicker({ value, onChange, min, max, disabled, id, name, placeholder = "Select date", clearable, today: todayProp, className, ...aria }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = isDayKey(value) ? value : ""
  const [today, setToday] = React.useState(todayProp ?? "")
  React.useEffect(() => { setToday(todayProp ?? todayDayKey()) }, [todayProp])
  const [focused, setFocused] = React.useState(() => clampDayKey(selected || todayProp || todayDayKey(), min, max))
  const grid = React.useRef<HTMLTableElement>(null), moveFocus = React.useRef(false)
  const reactId = React.useId(), headingId = `${reactId}-month`, valueId = `${reactId}-value`
  const weeks = React.useMemo(() => monthGrid(focused), [focused])
  const month = focused.slice(0, 7)
  const monthLabel = utcFormat(`${month}-01`, { month: "long", year: "numeric" })
  const prevMonthEnd = addDayKeys(`${month}-01`, -1), nextMonthStart = addMonthKeys(`${month}-01`, 1)

  React.useEffect(() => {
    if (!open || !moveFocus.current) return
    moveFocus.current = false
    grid.current?.querySelector<HTMLElement>(`[data-day="${focused}"]`)?.focus()
  }, [open, focused])

  const openChange = (next: boolean) => {
    if (next) { setFocused(clampDayKey(selected || today || todayDayKey(), min, max)); moveFocus.current = true }
    setOpen(next)
  }
  const choose = (key: string) => {
    if (isDayKeyDisabled(key, min, max)) return
    onChange(key)
    setOpen(false)
  }
  const shiftMonth = (months: number) => setFocused(clampDayKey(addMonthKeys(focused, months), min, max))
  const onGridKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(focused); return }
    const next = moveDayKey(focused, event.key, event.shiftKey)
    if (!next) return
    event.preventDefault()
    moveFocus.current = true
    setFocused(clampDayKey(next, min, max))
  }

  return <Popover open={open} onOpenChange={openChange}>
    {name && <input type="hidden" name={name} value={selected} />}
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" id={id} disabled={disabled} data-slot="date-picker" data-value={selected} aria-label={aria["aria-label"]} aria-labelledby={aria["aria-labelledby"]} aria-describedby={[valueId, aria["aria-describedby"]].filter(Boolean).join(" ")}
        className={cn("h-10 w-full min-w-[10.5rem] justify-between gap-2 bg-card px-3 font-normal md:text-sm", !selected && "text-muted-foreground", className)}>
        <span id={valueId}>{selected ? formatDayKey(selected) : placeholder}</span>
        <CalendarDays aria-hidden="true" className="text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3" onOpenAutoFocus={event => { event.preventDefault(); moveFocus.current = true; grid.current?.querySelector<HTMLElement>(`[data-day="${focused}"]`)?.focus() }} aria-label={`Choose ${aria["aria-label"] ? aria["aria-label"].toLowerCase() : "date"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" disabled={isDayKeyDisabled(prevMonthEnd, min)} onClick={() => shiftMonth(-1)}><ChevronLeft aria-hidden="true" /></Button>
        <div id={headingId} aria-live="polite" className="text-sm font-medium">{monthLabel}</div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" disabled={isDayKeyDisabled(nextMonthStart, undefined, max)} onClick={() => shiftMonth(1)}><ChevronRight aria-hidden="true" /></Button>
      </div>
      <table ref={grid} role="grid" aria-labelledby={headingId} className="border-collapse" onKeyDown={onGridKeyDown}>
        <thead><tr>{WEEKDAYS.map(day => <th key={day} scope="col" abbr={day} className="size-10 text-xs font-normal text-muted-foreground">{day.slice(0, 2)}</th>)}</tr></thead>
        <tbody>{weeks.map(week => <tr key={week[0]}>{week.map(day => {
          const off = isDayKeyDisabled(day, min, max), isSelected = day === selected, isToday = day === today, outside = day.slice(0, 7) !== month
          return <td key={day} data-day={day} tabIndex={day === focused ? 0 : -1} aria-selected={isSelected} aria-disabled={off || undefined} aria-current={isToday ? "date" : undefined} aria-label={formatDayKey(day, "long")}
            onClick={() => choose(day)} onFocus={() => { if (day !== focused) setFocused(day) }}
            className={cn("relative size-10 cursor-pointer rounded-md text-center text-sm tabular-nums outline-none transition-colors motion-reduce:transition-none focus-visible:ring-[3px] focus-visible:ring-ring",
              outside && "text-muted-foreground", !off && !isSelected && "hover:bg-accent hover:text-accent-foreground",
              isToday && !isSelected && "font-semibold text-primary", isSelected && "bg-primary text-primary-foreground",
              off && "cursor-not-allowed opacity-40")}>
            {Number(day.slice(8))}
            {isToday && <span aria-hidden="true" className={cn("absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")} />}
          </td>
        })}</tr>)}</tbody>
      </table>
      {(clearable && selected || today && !isDayKeyDisabled(today, min, max)) && <div className="mt-2 flex justify-between gap-2 border-t pt-2">
        {today && !isDayKeyDisabled(today, min, max) ? <Button type="button" variant="ghost" size="sm" onClick={() => choose(today)}>Today</Button> : <span />}
        {clearable && selected && <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setOpen(false) }}>Clear</Button>}
      </div>}
    </PopoverContent>
  </Popover>
}

"use client";
import { Input } from "@/components/ui/input";
import { eventDurations, eventSchedule, eventScheduleLabel, newYorkInput, type CampusEvent } from "@/lib/campus-events";

/** Quarter-hour suggestions, with an extra option for any existing precise time. */
function TimePicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const times = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String(i % 4 * 15).padStart(2, "0")}`);
  if (value && !times.includes(value)) times.push(value);
  times.sort();
  return <label>{label}<select aria-label={label} required value={value} onChange={e => onChange(e.target.value)}><option value="">Choose time</option>{times.map(time => {
    const [h, m] = time.split(":").map(Number);
    return <option key={time} value={time}>{h % 12 || 12}:{String(m).padStart(2, "0")} {h < 12 ? "AM" : "PM"}</option>;
  })}</select></label>;
}
export function EventScheduleFields({ start, end, duration, allDay, lastDay, existing, setStart, setEnd, setDuration, setAllDay, setLastDay }: {
  existing?: Pick<CampusEvent, "date" | "endDate" | "allDay">;
  start: string; end: string; duration: string; allDay: boolean; lastDay: string;
  setStart: (v: string) => void; setEnd: (v: string) => void; setDuration: (v: string) => void; setAllDay: (v: boolean) => void; setLastDay: (v: string) => void;
}) {
  let summary = "", error = "";
  if (start.slice(0, 10) && (allDay || start.slice(11))) {
    try { const result = eventSchedule(start, end, duration, allDay, lastDay, existing); summary = eventScheduleLabel({ date: result.date.toISOString(), endDate: result.endDate.toISOString(), allDay }); }
    catch (e) { error = e instanceof Error ? e.message : "Check your dates."; }
  }
  return <div className="space-y-4">
    <div className="oc-event-editor-pair">
      <label>Start Date<Input required type="date" value={start.slice(0, 10)} onChange={e => setStart(`${e.target.value}T${start.slice(11) || "09:00"}`)} /></label>
      {!allDay && <TimePicker label="Start Time" value={start.slice(11)} onChange={v => setStart(`${start.slice(0, 10)}T${v}`)} />}
    </div>
    <label className="oc-event-check"><input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />All-day event</label>
    {allDay ? <label>End Date<Input required type="date" min={start.slice(0, 10)} value={lastDay || start.slice(0, 10)} onChange={e => setLastDay(e.target.value)} /></label> : <>
      <label>Duration<select aria-label="Duration" value={duration} onChange={e => {
        if (e.target.value === "custom" && !end && start) {
          try { const result = eventSchedule(start, "", duration, false, "", existing); setEnd(newYorkInput(result.endDate.toISOString())); } catch {}
        }
        setDuration(e.target.value);
      }}>{eventDurations.map(minutes => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : minutes === 60 ? "1 hour" : `${minutes / 60} hours`}</option>)}<option value="custom">Custom ending</option></select></label>
      {duration === "custom" && <div className="oc-event-editor-pair"><label>End Date<Input required type="date" min={start.slice(0, 10)} value={end.slice(0, 10)} onChange={e => setEnd(`${e.target.value}T${end.slice(11) || "10:00"}`)} /></label><TimePicker label="End Time" value={end.slice(11)} onChange={v => setEnd(`${end.slice(0, 10)}T${v}`)} /></div>}
    </>}
    {error ? <p role="alert" id="event-schedule-error" className="text-sm text-destructive">{error}</p> : summary && <p role="status" className="text-sm text-muted-foreground">{summary}</p>}
  </div>;
}

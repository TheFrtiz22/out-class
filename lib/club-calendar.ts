/** The club Calendar's type filter (`type=` in the URL). "all" is the default and is left out of the URL. */
export const calendarTypes = [
  { id: "all", label: "All" },
  { id: "meetings", label: "Meetings" },
  { id: "events", label: "Events" },
] as const
export type CalendarType = typeof calendarTypes[number]["id"]

export function calendarType(value: string | null | undefined): CalendarType {
  return calendarTypes.some(item => item.id === value) ? value as CalendarType : "all"
}

export function clubCalendarHref(clubId: string, type: CalendarType = "all") {
  return `/club/${encodeURIComponent(clubId)}/workspace?section=calendar${type === "all" ? "" : `&type=${type}`}`
}

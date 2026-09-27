/** Ongoing meetings stay with Upcoming until their recorded end time. */
export function meetingIsUpcoming(meeting: { date: Date | string; endDate?: Date | string | null }, now = Date.now()) {
  return +new Date(meeting.endDate || meeting.date) >= now
}
export function meetingDate(value: Date | string) {
  return new Date(value).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

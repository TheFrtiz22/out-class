import { nyDate } from "@/lib/campus-events";
/** RFC 5545: UTC instants, escaped TEXT, CRLF and 75-octet content folding. */
export function calendarEventFile(event: {
  id: string; title: string; description: string; location: string;
  start: Date; end: Date; url?: string; allDay?: boolean;
}, now = new Date()) {
  const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const fold = (value: string) => {
    let result = "", length = 0;
    for (const char of value) {
      const bytes = new TextEncoder().encode(char).length;
      if (length + bytes > 75) { result += "\r\n "; length = 1; }
      result += char; length += bytes;
    }
    return result;
  };
  if (!Number.isFinite(+event.start) || !Number.isFinite(+event.end) || event.end < event.start) throw Error("Invalid calendar event dates.");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OutClass//Calendar//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${escape(event.id)}@outclass`, `DTSTAMP:${stamp(now)}`, `DTSTART${event.allDay ? ";VALUE=DATE" : ""}:${event.allDay ? nyDate(event.start).replaceAll("-", "") : stamp(event.start)}`, `DTEND${event.allDay ? ";VALUE=DATE" : ""}:${event.allDay ? nyDate(event.end).replaceAll("-", "") : stamp(event.end)}`,
    `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `LOCATION:${escape(event.location)}`,
    ...(event.url ? [`URL:${event.url.replace(/[\r\n]/g, "")}`] : []), "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}

export type FeedEvent = { id: string; title: string; description: string; location: string; start: Date; end: Date; allDay?: boolean; url?: string }

/** A whole subscribable calendar: one VCALENDAR with a VEVENT per event.
 * Same escaping, folding and UTC rules as calendarEventFile. Invalid dates are skipped. */
export function calendarFeedFile(name: string, events: readonly FeedEvent[], now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OutClass//Calendar Feed//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${feedEscape(name)}`, "X-WR-TIMEZONE:America/New_York", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"]
  for (const event of events) {
    if (!Number.isFinite(+event.start) || !Number.isFinite(+event.end) || event.end < event.start) continue
    const single = calendarEventFile(event, now).split("\r\n")
    const start = single.indexOf("BEGIN:VEVENT"), end = single.indexOf("END:VEVENT")
    lines.push(...single.slice(start, end + 1))
  }
  lines.push("END:VCALENDAR")
  return lines.join("\r\n") + "\r\n"
}
function feedEscape(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;") }

/** RFC 5545: UTC instants, escaped TEXT, CRLF and 75-octet content folding. */
export function calendarEventFile(event: {
  id: string; title: string; description: string; location: string;
  start: Date; end: Date; url?: string;
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
    `UID:${escape(event.id)}@outclass`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.start)}`, `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `LOCATION:${escape(event.location)}`,
    ...(event.url ? [`URL:${event.url.replace(/[\r\n]/g, "")}`] : []), "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}

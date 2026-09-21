/**
 * Generates a Google Calendar event creation link.
 * 
 * @param title - The title of the event (e.g., "OutClass: Consulting Club Interview")
 * @param start - Start Date object
 * @param end - End Date object
 * @param location - Location (e.g., "Rouss Hall 101" or Zoom Link)
 * @param details - Description or instructions for the interview
 * @returns A formatted URL to redirect the user to Google Calendar
 */
export function generateGoogleCalendarLink(
  title: string,
  start: Date,
  end: Date,
  location: string,
  details: string
): string {
  // Format dates to ISO 8601 string without dashes/colons as required by GCal
  // e.g., 20260921T143000Z
  const formatGCalDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const startStr = formatGCalDate(start);
  const endStr = formatGCalDate(end);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startStr}/${endStr}`,
    details: details,
    location: location,
    sf: "true", // show formatting
    output: "xml",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Alternative: Generates an .ics file content string for native calendar apps (Apple Calendar, Outlook).
 */
export function generateIcsContent(
  title: string,
  start: Date,
  end: Date,
  location: string,
  details: string
): string {
  const formatIcsDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OutClass//Interview Scheduler//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${title}
DTSTART:${formatIcsDate(start)}
DTEND:${formatIcsDate(end)}
LOCATION:${location}
DESCRIPTION:${details.replace(/\n/g, "\\n")}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}


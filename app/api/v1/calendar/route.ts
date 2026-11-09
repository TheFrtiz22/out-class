import { getStudentDashboardData } from "@/actions/applications";
import { v1Route } from "@/lib/api-v1";
import { studentCalendarEvents } from "@/lib/student-calendar-data";

export const dynamic = "force-dynamic";

/**
 * The student's calendar: club meetings, booked interviews, interview panels and
 * attended events, projected exactly as the web Calendar does. Application
 * answers and other dashboard fields are not returned.
 */
export async function GET(request: Request) {
  return v1Route(request, "Calendar", async () => {
    const events = studentCalendarEvents(await getStudentDashboardData());
    return {
      events: events.map((e) => ({
        id: e.id, title: e.title, club: e.club, clubId: e.clubId ?? null, color: e.color, type: e.type,
        date: e.date, startTime: e.startTime ?? null, endTime: e.endTime ?? null, allDay: !!e.allDay,
        location: e.location ?? null, description: e.description ?? null,
      })),
    };
  });
}

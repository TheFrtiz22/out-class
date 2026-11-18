import { getStudentDashboardData } from "@/actions/applications";
import { getDurableNotifications } from "@/actions/communications";
import { getTaskNotifications } from "@/actions/tasks";
import { applicationStatusCode, applicationStatusLabel } from "@/lib/application-status";
import { homeApplications, nextHomeAction, upcomingAgenda } from "@/lib/student-home";
import { studentCalendarEvents } from "@/lib/student-calendar-data";

/**
 * Screen-shaped reads for the native app. The web derives Home and Calendar in the browser from
 * `getStudentDashboardData` with the pure helpers in lib/student-home.ts and
 * lib/student-calendar-data.ts; these run the same loaders and the same helpers on the server, so
 * both clients show the same items, order and counts, and the app never re-counts anything.
 * Authorization is the loaders' own (requireAuth inside each).
 */
export async function getMobileHome() {
  const [dashboard, taskNotifications, inbox] = await Promise.all([getStudentDashboardData(), getTaskNotifications(), getDurableNotifications()]);
  const now = new Date();
  const events = studentCalendarEvents(dashboard);
  const applications = homeApplications(dashboard.applications, [], events).map(application => ({
    ...application,
    statusCode: applicationStatusCode(application.status),
    statusLabel: applicationStatusLabel(application.status),
  }));
  const agenda = upcomingAgenda(events, now);
  return {
    generatedAt: now,
    applications,
    agenda: agenda.slice(0, 8),
    agendaCount: agenda.length,
    nextAction: nextHomeAction(applications, agenda, now, taskNotifications),
    tasks: taskNotifications,
    unread: inbox.unread + taskNotifications.filter(item => !item.read).length,
  };
}

export async function getMobileCalendar() {
  const dashboard = await getStudentDashboardData();
  return { generatedAt: new Date(), events: studentCalendarEvents(dashboard) };
}

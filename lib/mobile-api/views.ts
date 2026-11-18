import { getStudentDashboardData } from "@/actions/applications";
import { getDurableNotifications } from "@/actions/communications";
import { getTaskNotifications } from "@/actions/tasks";
import { applicationStatusCode, applicationStatusLabel } from "@/lib/application-status";
import { homeApplications, nextHomeAction, upcomingAgenda } from "@/lib/student-home";
import { studentCalendarEvents } from "@/lib/student-calendar-data";
import { getStudentApplications } from "@/actions/applications";
import { getCurrentUser } from "@/utils/current-user";
import { applicationStage, applicationStages, initialApplicationStage, stageCounts } from "@/lib/application-stages";
import { applicationNeedsAttention, applicationStatusProgress, compareApplicationStatus, currentApplicationInterview, isApplicationDecision } from "@/lib/application-presentation";
import { applicationIntakeClosed, recruitmentDate, recruitmentDeadline } from "@/lib/recruitment-presentation";
import { applicationAttachmentUrl, applicationNextStep, applicationResponseProgress } from "@/lib/student-applications";
import { meetsTestRequirement, testRequirementLabels } from "@/lib/test-scores";
import { PHONE_REQUIRED_MESSAGE, validPhone } from "@/lib/phone";
import { ALUMNI_REFUSALS, isAlumniProfile } from "@/lib/graduation";

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

/**
 * The Applications page as the web's phone layout derives it in the browser
 * (components/views/application-tracker-view.tsx and its cards): the same stage tabs and counts
 * (lib/application-stages.ts), order (lib/application-presentation.ts), labels
 * (lib/application-status.ts), draft progress (lib/student-applications.ts) and profile
 * requirements (components/applications/application-form.tsx), computed here with those helpers so
 * the app never re-implements them. The loader is the web's own (requireAuth inside).
 */
export async function getMobileApplications() {
  const [applications, account] = await Promise.all([getStudentApplications(), getCurrentUser()]);
  const now = Date.now();
  const profile = account.profile;
  const alumni = isAlumniProfile(profile);
  const counts = stageCounts(applications.map(item => item.status));
  const shaped = applications.map(app => {
    const draft = app.status === "DRAFTING";
    const decision = isApplicationDecision(app.status);
    const interview = currentApplicationInterview(app, now);
    const due = recruitmentDeadline(app.club.applicationDeadline);
    const offer = app.recruitmentOffer;
    const requirement = testRequirementLabels[(app.club.testRequirement || "OPTIONAL") as keyof typeof testRequirementLabels];
    return {
      ...app,
      statusCode: applicationStatusCode(app.status),
      statusLabel: applicationStatusLabel(app.status),
      stage: applicationStage(app.status),
      decision,
      attention: applicationNeedsAttention(app, now),
      nextStep: applicationNextStep(app.status),
      progress: applicationResponseProgress(app.club.questions, app.answers),
      intakeClosed: applicationIntakeClosed(app.club, now),
      deadlineLabel: due ? recruitmentDate(due) : null,
      submittedLabel: app.submittedAt ? recruitmentDate(app.submittedAt) : null,
      interview: interview ? { id: interview.booking.id, startTime: interview.booking.slot.startTime, endTime: interview.booking.slot.endTime, location: interview.booking.slot.location, past: interview.past, label: recruitmentDate(interview.booking.slot.startTime) } : null,
      statusProgress: applicationStatusProgress(app),
      // Booking history as ApplicationStatusDetail lists it ("Recorded interviews").
      history: (app.status === "INTERVIEWING" ? app.bookings.filter(booking => booking.roundId && booking.roundId !== app.round?.id) : app.bookings)
        .map(booking => ({ id: booking.id, startLabel: recruitmentDate(booking.slot.startTime), endLabel: recruitmentDate(booking.slot.endTime), location: booking.slot.location })),
      // RecruitmentOffer treats a pending offer past its date as expired.
      offerStatus: offer ? (offer.status === "PENDING" && +new Date(offer.expiresAt) <= now ? "EXPIRED" : offer.status) : null,
      attachments: Object.fromEntries(app.club.questions.filter(question => question.type === "FILE_UPLOAD").flatMap(question => {
        const response = app.answers.find(answer => answer.questionId === question.id)?.response;
        const url = response ? applicationAttachmentUrl(response, app.id, question.id) : undefined;
        return url ? [[question.id, url]] : [];
      })),
      testRequirementLabel: requirement,
      // The form's "Missing profile requirements" note, in the web's words; null when nothing is missing.
      profileNote: !draft ? null : !profile ? "Complete your shared profile before submitting."
        : !validPhone(profile.phone) ? PHONE_REQUIRED_MESSAGE
        : !meetsTestRequirement(app.club.testRequirement, profile) ? `${requirement}. Add the missing scores to your profile before submitting.` : null,
    };
  });
  const sorted = applicationStages.flatMap(stage => shaped.filter(item => item.stage === stage.id)
    .sort((a, b) => stage.id === "drafts" ? a.club.name.localeCompare(b.club.name) : compareApplicationStatus(a, b, now) || a.club.name.localeCompare(b.club.name)));
  return {
    generatedAt: new Date(now),
    userId: account.id,
    alumni,
    alumniRefusals: { respond: ALUMNI_REFUSALS.respond, book: ALUMNI_REFUSALS.book },
    stages: applicationStages.map(stage => ({ ...stage, count: counts[stage.id] })),
    initialStage: initialApplicationStage(null, counts),
    applications: sorted,
  };
}

import { demoStore, demoMember } from "./store";
import { hasPermission } from "@/lib/permissions";
import { pipelineSettingsSchema } from "@/lib/club-settings";
import { isInterviewRecruitmentRound } from "@/lib/recruitment-lifecycle";
import { demoBookingCoverage, demoBookingSettings } from "./interview-booking";
import { interviewSetupStatus } from "@/lib/interview-round-workflow";
function manager(clubId: string) {
  const s = demoStore.get(), member = demoMember();
  if (s.perspective.role !== "leader" || member.clubId !== clubId || !hasPermission(member, "recruitment.manage")) throw Error("Recruiting configuration access denied.");
  const club = s.clubs.find(c => c.id === clubId);
  if (!club) throw Error("Club unavailable.");
  return { s, club };
}
export function getPipelineSettings(clubId: string) {
  const { s, club } = manager(clubId);
  return { pipelineVersion: club.pipelineVersion ?? 0, pipelineRounds: [...club.rounds].sort((a,b) => a.order - b.order || a.id.localeCompare(b.id)).map(r => ({ ...r, _count: { applications: s.applications.filter(a => a.roundId === r.id).length, interviewRooms: s.interviewRooms.filter(a => a.roundId === r.id).length, interviewRecords: s.interviews.filter(a => a.roundId === r.id).length, votingSessions: s.votingSessions.filter(a => a.roundId === r.id).length, scheduledBookings: s.roomBookings.filter(a => a.roundId === r.id).length } })) };
}
export function savePipelineSettings(raw: unknown) {
  const input = pipelineSettingsSchema.parse(raw), { s, club } = manager(input.clubId);
  if ((club.pipelineVersion ?? 0) !== input.version) throw Error("Recruiting pipeline changed. Reload before saving.");
  const related = (id: string) => s.applications.some(a => a.roundId === id) || s.interviewRooms.some(r => r.roundId === id) || s.interviews.some(r => r.roundId === id) || s.roomBookings.some(r => r.roundId === id) || s.votingSessions.some(r => r.roundId === id) || s.recruitingRules.some(r => r.roundId === id) || !!s.applicantDisplay[id] || s.applications.some(a => a.evaluations.some(e => e.roundId === id));
  for (const old of club.rounds) {
    const next = input.rounds.find(r => r.id === old.id);
    if (next && next.type !== old.type && (s.interviewRooms.some(r => r.roundId === old.id) || s.interviews.some(r => r.roundId === old.id) || s.roomBookings.some(r => r.roundId === old.id) || s.votingSessions.some(r => r.roundId === old.id) || old.interviewKit.length || demoBookingSettings(old.id).bookingPublishedAt || !isInterviewRecruitmentRound(next.type) && s.applications.some(a => a.roundId === old.id && a.status === "INTERVIEWING"))) throw Error("The round type is protected by its interview or voting history.");
    if (next && old.archivedAt) throw Error("Archived rounds cannot be reused.");
    if (!next && !old.archivedAt && (s.applications.some(a => a.roundId === old.id && !["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(a.status)) || s.interviewRooms.some(r => r.roundId === old.id && r.isOpen))) throw Error("Move active applicants and close rooms before removing this round.");
    if (next && club.rounds.some(r => r.id !== next.id && r.name.toLowerCase() === next.name.toLowerCase())) throw Error("That round name belongs to existing review history. Choose a new name.");
  }
  for (const next of input.rounds) if (s.clubs.some(c => c.id !== club.id && c.rounds.some(r => r.id === next.id))) throw Error("Round belongs to another club.");
  demoStore.mutate(state => {
    const target = state.clubs.find(c => c.id === input.clubId)!;
    const previous = target.rounds;
    target.rounds = input.rounds.map((r, order) => {
      const saved = previous.find(old => old.id === r.id);
      return saved ? { ...saved, ...r, configuration: { ...saved.configuration, ...r.configuration }, order } : { ...r, order, clubId: target.id, anonymousReview: false, archivedAt: null, interviewKit: [], kitVersion: 0 };
    });
    target.rounds.push(...previous.filter(old => !input.rounds.some(r => r.id === old.id) && (related(old.id) || old.interviewKit.length || old.archivedAt)).map(old => ({ ...old, archivedAt: old.archivedAt ?? new Date() })));
    target.pipelineVersion = input.version + 1;
  });
  return { version: input.version + 1 };
}
export function getPipelineInterviewStatus(clubId: string) {
  const { club, s } = manager(clubId);
  return club.rounds.filter(r => !r.archivedAt && isInterviewRecruitmentRound(r.type)).map(r => { const booking = demoBookingSettings(r.id); return interviewSetupStatus({ roundId: r.id, questions: r.interviewKit.length, rooms: s.interviewRooms.filter(room => room.roundId === r.id).length, anonymous: r.anonymousReview, published: !!booking.bookingPublishedAt, paused: booking.bookingPaused, coverage: demoBookingCoverage(clubId, r.id) }); });
}

import { z } from "zod";
export const tutorialExperience = z.enum(["student", "leader"]);
export type TutorialExperience = z.infer<typeof tutorialExperience>;
export type TutorialProgress = { status: string; step: number; version: number };
export const tutorialSteps = {
  student: [
    { title: "Your profile", text: "Build one profile for your applications. Keep your education, experience, and resume up to date from your account menu.", anchor: "profile", view: "student-profile" },
    { title: "Explore OutClass", text: "Browse Explore by interest, search and compare clubs, and open a club’s page for its recruitment details and public events.", anchor: "nav-explore", view: "explore" },
    { title: "Your clubs", text: "My Clubs brings your memberships together. Open a club to find its meetings, tasks, and workspace tools available to you.", anchor: "mode-clubs", view: "my-clubs" },
    { title: "Applications", text: "Start from a club’s page, answer its questions, and check your profile before submitting. Track all your applications here.", anchor: "mode-applications", view: "tracker" },
    { title: "Application status", text: "Your tracker shows each application’s current status, interview invitations, and released decisions. Open an application for details.", anchor: "mode-applications", view: "tracker" },
    { title: "Calendar and events", text: "Find upcoming events and interview times in Calendar. Open an event for its details and attendance options.", anchor: "nav-calendar", view: "calendar" },
    { title: "Your Corkboard", text: "Save interesting clubs from Explore or a club profile. Revisit them on Corkboard, or remove a saved club whenever your interests change. Saving does not apply or subscribe you.", anchor: "nav-corkboard", view: "corkboard" },
    { title: "Stay in the loop", text: "Use the bell for notifications and application updates. You can restart this walkthrough anytime using Tutorial help.", anchor: "notifications", view: "inbox" },
  ],
  leader: [
    { title: "Your applicant workspace", text: "Recruiting brings applications and your review tools together. Tools are shown according to your current club permissions.", anchor: "mode-recruiting", section: "recruitment", tool: "applicants" },
    { title: "Review applicants", text: "Open an applicant to review answers and record evaluations. Respect anonymous review: identifying details stay hidden when your round requires it.", anchor: "nav-applicants", section: "recruitment", tool: "applicants" },
    { title: "Interviews", text: "Use Interviews to manage availability, bookings, rooms, and interview evaluations according to your assigned permissions.", anchor: "nav-interviews", section: "recruitment", tool: "interviews" },
    { title: "Voting and decisions", text: "Use the decision tools your club has enabled. Voting access and permission to release decisions are separate. A voting permission alone does not grant decision publishing; the recruitment voting board preserves ballots across passes until authorized leadership explicitly publishes outcomes.", anchor: "nav-decisions", section: "recruitment", tool: "decisions" },
    { title: "Recruitment rounds", text: "Rounds organize the recruiting process. Authorized managers configure rounds and anonymous review in the recruiting workspace; reviewers follow the current round’s rules.", anchor: "mode-recruiting", section: "recruitment", tool: "overview" },
    { title: "Club management", text: "Switch to Club for meetings, tasks, members, and club settings. Access depends on your role. Tutorial help restarts this leader walkthrough independently of your student tutorial.", anchor: "mode-club", section: "overview", tool: "" },
  ],
} as const;
export const tutorialInput = z.object({
  experience: tutorialExperience,
  clubId: z.string().uuid().optional(),
  action: z.enum(["progress", "complete", "skip", "restart"]),
  step: z.number().int().min(0).max(7),
}).superRefine((value, ctx) => {
  if (value.step >= tutorialSteps[value.experience].length) ctx.addIssue({ code: "custom", message: "Invalid tutorial step" });
});

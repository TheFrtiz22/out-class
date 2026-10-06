import { z } from "zod";
export const tutorialExperience = z.enum(["student", "leader"]);
export type TutorialExperience = z.infer<typeof tutorialExperience>;
export type TutorialProgress = { status: string; step: number; version: number };
export const tutorialSteps = {
  student: [
    { title: "Your profile", text: "Build one profile for your applications. Keep your education, experience, and resume up to date from your account menu.", anchor: "profile", view: "student-profile" },
    { title: "Explore OutClass", text: "Browse Explore by interest, search and compare clubs, and open a club’s page for its recruitment details and public events.", anchor: "nav-explore", view: "explore" },
    { title: "Your clubs", text: "My Clubs brings your memberships together. Open a club to find its meetings, tasks, and workspace tools available to you.", anchor: "nav-clubs", view: "my-clubs" },
    { title: "Applications", text: "Start from a club’s page, answer its questions, and check your profile before submitting. Track all your applications here.", anchor: "nav-applications", view: "tracker" },
    { title: "Application status", text: "Status brings review progress, interview scheduling, and released decisions together. Open an application to review its next step.", anchor: "nav-status", view: "status" },
    { title: "Calendar and events", text: "Find upcoming events and interview times in Calendar. Open an event for its details and attendance options.", anchor: "nav-calendar", view: "calendar" },
    { title: "Campus Corkboard", text: "Find approved campus event flyers on Corkboard. Filter by date or interest, open a flyer for details, and RSVP. Your saved clubs remain available through Saved clubs.", anchor: "nav-corkboard", view: "corkboard" },
    { title: "Stay in the loop", text: "Use the bell for notifications and application updates. You can restart this walkthrough anytime using Tutorial help.", anchor: "notifications", view: "inbox" },
  ],
  leader: [
    { title: "Your applicant workspace", text: "Recruiting brings applications and your review tools together. Tools are shown according to your current club permissions.", anchor: "mode-recruiting", section: "recruitment", tool: "applicants" },
    { title: "Review applicants", text: "Open an applicant to review the configured profile, academics, experiences, answers, and evaluations. Record evidence in Pros and Cons where identified review permits it. Respect anonymous review: identifying details stay hidden when your round requires it.", anchor: "nav-applicants", section: "recruitment", tool: "applicants" },
    { title: "Interviews", text: "Use Interviews to configure round-specific interview kits and rooms. Open Interview Mode to save per-question notes, additional questions, and an overall evaluation. Availability, bookings, and access follow your assigned permissions.", anchor: "nav-interviews", section: "recruitment", tool: "interviews" },
    { title: "Voting and decisions", text: "Use the decision tools your club has enabled. Voting access and permission to release decisions are separate. A voting permission alone does not grant decision publishing; the recruitment voting board preserves ballots across passes. Review Pass, Hold / Fringe, and Do Not Pass outcomes, start another pass or finish, reopen where authorized, then explicitly review and publish final decisions. Target size does not end voting automatically.", anchor: "nav-decisions", section: "recruitment", tool: "decisions" },
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

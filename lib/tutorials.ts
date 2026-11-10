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
    { title: "Application stages", text: "Applications sorts your work into Drafts, In review, Interviews and Decisions. Open an application to review its next step.", anchor: "nav-applications", view: "status" },
    { title: "Calendar and events", text: "Find upcoming events and interview times in Calendar. Open an event for its details and attendance options.", anchor: "nav-calendar", view: "calendar" },
    { title: "Campus events", text: "Find approved campus event flyers in Events. Filter by date or interest, open a flyer for details, and RSVP. Your saved clubs remain available through Saved clubs.", anchor: "nav-corkboard", view: "corkboard" },
    { title: "Stay in the loop", text: "Use the bell for your Inbox: notifications and application updates. You can restart this walkthrough anytime using Tutorial help.", anchor: "notifications", view: "inbox" },
  ],
  leader: [
    { title: "Your applicant workspace", text: "Recruiting brings applications and your review tools together. Tools are shown according to your current club permissions.", anchor: "mode-recruiting", section: "recruitment", tool: "applicants" },
    { title: "Review applicants", text: "Open an applicant to review the profile, academics, experiences, answers, and evaluations. Record evidence in Pros and Cons when the round shows applicant names. Respect anonymous review: identifying details stay hidden when your round requires it.", anchor: "nav-applicants", section: "recruitment", tool: "applicants" },
    { title: "Interviews", text: "Use Interviews to set up each round’s questions and rooms. Open Interview Mode to save per-question notes, additional questions, and an overall evaluation. What you can see and change depends on your role.", anchor: "nav-interviews", section: "recruitment", tool: "interviews" },
    { title: "Decide", text: "Decide runs in two steps for the round you pick. Vote: start or join voting sessions and work through Pass, Hold / Fringe and Do Not Pass. Send: review each closed session’s outcomes, preview the letter for each outcome, then send now or schedule. Voting access and permission to send decisions are separate; what you see depends on your role.", anchor: "nav-decisions", section: "recruitment", tool: "decisions" },
    { title: "Recruitment rounds", text: "Rounds organize the recruiting process. Authorized managers set anonymous review and auto-reject rules in Recruiting settings, the gear on Applicants (also in club Settings); reviewers follow the current round’s rules.", anchor: "mode-recruiting", section: "recruitment", tool: "overview" },
    { title: "Club management", text: "The Club section runs the club week to week: Home (with announcements), Calendar for meetings and events, Tasks, and Members. Settings is at the bottom of the rail. Access depends on your role. Tutorial help restarts this leader walkthrough independently of your student tutorial.", anchor: "mode-club", section: "overview", tool: "" },
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

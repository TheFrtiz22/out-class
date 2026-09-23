import type { InterviewQuestion, WorkspaceRound } from "@/lib/data"

export const demoInterviewQuestions: InterviewQuestion[] = [
  { id: "q-g1", label: "Tell us about yourself", duration: "5 mins", prompt: "SAMPLE DATA: Can you walk us through your background and what led you to apply to our organization?", benchmarks: ["Clarity of narrative", "Relevant highlights", "Conciseness"] },
  { id: "q-g2", label: "Why this org", duration: "5 mins", prompt: "SAMPLE DATA: What specific aspects of our organization's work or culture made you want to join?", benchmarks: ["Specific references to org work", "Alignment with mission"] },
  { id: "q-g3", label: "What would you contribute", duration: "5 mins", prompt: "SAMPLE DATA: Based on your skills and background, what unique value would you bring to our projects?", benchmarks: ["Self-awareness", "Understanding of org needs"] },
  { id: "q-g4", label: "Team conflict", duration: "5 mins", prompt: "SAMPLE DATA: Describe a time you had a conflict with a team member. How did you handle it?", benchmarks: ["Professionalism", "Empathy", "Resolution focus"] },
  { id: "q-g5", label: "Leadership", duration: "5 mins", prompt: "SAMPLE DATA: Give an example of a time you stepped up as a leader when it wasn't officially your role.", benchmarks: ["Initiative", "Influence without authority"] },
  { id: "q-g6", label: "What you hope to gain", duration: "5 mins", prompt: "SAMPLE DATA: What are you hoping to learn or achieve by being part of this organization?", benchmarks: ["Growth mindset", "Realistic expectations"] },

  { id: "q-b1", label: "Failure/learning", duration: "10 mins", prompt: "SAMPLE DATA: Tell us about a time you failed or made a significant mistake. What did you learn?", benchmarks: ["Accountability", "Ability to reflect and improve"] },
  { id: "q-b2", label: "Teammate disagreement", duration: "5 mins", prompt: "SAMPLE DATA: Tell me about a time you strongly disagreed with a teammate's proposal. How did you move forward?", benchmarks: ["Constructive feedback", "Collaboration"] },
  { id: "q-b3", label: "Incomplete information", duration: "5 mins", prompt: "SAMPLE DATA: Describe a situation where you had to make a decision with incomplete information.", benchmarks: ["Analytical thinking", "Risk management"] },
  { id: "q-b4", label: "Proud project", duration: "10 mins", prompt: "SAMPLE DATA: Walk me through a project you're particularly proud of. What was your specific contribution?", benchmarks: ["Passion", "Clear impact and role"] },

  { id: "q-c1", label: "Market Sizing Case", duration: "15 mins", prompt: "SAMPLE DATA: Estimate the daily revenue of a typical coffee shop in a college town.", benchmarks: ["Structured breakdown", "Reasonable assumptions", "Math accuracy"] },
  { id: "q-c2", label: "Profitability Case", duration: "20 mins", prompt: "SAMPLE DATA: A local restaurant has seen declining profits despite steady revenue. How would you investigate?", benchmarks: ["Identifying cost vs revenue", "MECE framework"] },
  { id: "q-c3", label: "Growth Strategy Case", duration: "20 mins", prompt: "SAMPLE DATA: A successful regional gym chain wants to expand nationally. What factors should they consider?", benchmarks: ["Market analysis", "Operational risks", "Financial viability"] },

  { id: "q-f1", label: "Investment Pitch", duration: "15 mins", prompt: "SAMPLE DATA: Pitch a stock you'd buy right now. What is your thesis and the main risks?", benchmarks: ["Clear thesis", "Valuation reasoning", "Risk awareness"] },
  { id: "q-f2", label: "Market Trends", duration: "10 mins", prompt: "SAMPLE DATA: What current macroeconomic trend do you think is underappreciated by the market?", benchmarks: ["Knowledge of current events", "Analytical depth"] },
  { id: "q-f3", label: "Valuation Concepts", duration: "10 mins", prompt: "SAMPLE DATA: Walk me through how you would value an apple orchard.", benchmarks: ["DCF concepts", "Asset-based valuation", "Creativity"] },

  { id: "q-m1", label: "Rebranding Strategy", duration: "15 mins", prompt: "SAMPLE DATA: Pick a brand you think is struggling. How would you rebrand them?", benchmarks: ["Target audience identification", "Creative strategy"] },
  { id: "q-m2", label: "Campaign Metrics", duration: "10 mins", prompt: "SAMPLE DATA: If we launch a social media campaign for a new product, what metrics would you track to measure success?", benchmarks: ["Knowledge of KPIs", "Strategic alignment"] },
  { id: "q-m3", label: "Target Audience", duration: "10 mins", prompt: "SAMPLE DATA: How would you market a premium study app to college students?", benchmarks: ["Understanding of demographic", "Channel selection"] }
];

export const demoWorkspaceRounds: WorkspaceRound[] = [
  {
    id: "wr-1",
    label: "Round 1: Behavioral Screen",
    questions: [
      {
        id: "wq-1",
        prompt: "SAMPLE DATA: Tell us about yourself and why you want to join.",
        collaboratorComments: [
          { interviewer: "John Doe", initials: "JD", score: 4, note: "Good clear narrative. Mentioned specific projects from our website." },
          { interviewer: "Jane Smith", initials: "JS", score: 5, note: "Very passionate. Clearly researched the org." }
        ]
      },
      {
        id: "wq-2",
        prompt: "SAMPLE DATA: Tell us about a time you failed.",
        collaboratorComments: [
          { interviewer: "John Doe", initials: "JD", score: 3, note: "A bit defensive, but eventually showed learning." },
          { interviewer: "Jane Smith", initials: "JS", score: 4, note: "Good example, took accountability." }
        ]
      }
    ]
  },
  {
    id: "wr-2",
    label: "Round 2: Technical/Case",
    questions: [
      {
        id: "wq-3",
        prompt: "SAMPLE DATA: Market Sizing: How many tennis balls fit in a Boeing 747?",
        collaboratorComments: [
          { interviewer: "Alex Wong", initials: "AW", score: 4, note: "Structured approach. Math got a bit messy at the end but the logic was sound." },
          { interviewer: "Sarah Lee", initials: "SL", score: 5, note: "Excellent breakdown. Very communicative throughout the process." }
        ]
      },
      {
        id: "wq-4",
        prompt: "SAMPLE DATA: Describe your proudest project.",
        collaboratorComments: [
          { interviewer: "Alex Wong", initials: "AW", score: 4, note: "Showed strong technical skills." }
        ]
      }
    ]
  },
  {
    id: "wr-3",
    label: "Round 3: Final Partner Interview",
    questions: [
      {
        id: "wq-5",
        prompt: "SAMPLE DATA: What would you contribute uniquely?",
        collaboratorComments: [
          { interviewer: "Mike Davis", initials: "MD", score: 5, note: "Incredible maturity. Would be a great addition to the team." },
          { interviewer: "Emily Chen", initials: "EC", score: 5, note: "Strong yes. Fits the culture perfectly." }
        ]
      }
    ]
  }
];

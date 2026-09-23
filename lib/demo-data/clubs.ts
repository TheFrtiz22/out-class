import type {
  Club,
  PipelineRound,
  BuilderQuestion,
  RosterMember,
  ClubExecutive,
  ClubBrandingProfile,
  BrandingClubCategory,
  TimeCommitment,
} from "@/lib/data"
import type { DirectoryClub } from "@/lib/club-directory"

// Helper for deterministic selections
const detSelect = <T,>(arr: T[], index: number): T => arr[index % arr.length];

const CATEGORIES: BrandingClubCategory[] = [
  "Finance & Investing",
  "Consulting",
  "Tech & Engineering",
  "Impact & Social Enterprise",
  "Pre-Professional / Greek",
  "Sports & Recreation"
];

const COLORS = [
  "#1E3A8A", "#064E3B", "#7F1D1D", "#4C1D95", "#0F766E",
  "#B45309", "#4338CA", "#BE185D", "#0369A1", "#1D4ED8",
  "#047857", "#B91C1C", "#6D28D9", "#0E7490", "#C2410C",
  "#4F46E5", "#BE123C", "#0284C7", "#3730A3", "#065F46"
];

const FICTIONAL_NAMES = [
  "Alex Chen", "Jordan Taylor", "Casey Smith", "Morgan Lee", "Riley Davis",
  "Taylor Swift", "Jamie Rivera", "Avery Patel", "Quinn Garcia", "Skyler Kim",
  "Cameron Martinez", "Drew Wilson", "Reese Anderson", "Blake Thompson", "Rowan White",
  "Peyton Clark", "Logan Lewis", "Dakota Walker", "Kendall Hall", "Ellis Young"
];

const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("");

const baseClubs = [
  { id: "mii", name: "MII", cat: "Finance & Investing" },
  { id: "gmg", name: "GMG", cat: "Finance & Investing" },
  { id: "aif", name: "AIF", cat: "Finance & Investing" },
  { id: "vvf", name: "VVF", cat: "Finance & Investing" },
  { id: "tamid", name: "TAMID", cat: "Consulting" },
  { id: "180dc", name: "180 Degrees Consulting", cat: "Consulting" },
  { id: "ama", name: "AMA", cat: "Pre-Professional / Greek" },
  { id: "acct-society", name: "Accounting Society", cat: "Pre-Professional / Greek" },
  { id: "akpsi", name: "AKPsi", cat: "Pre-Professional / Greek" },
  { id: "enactus", name: "Enactus", cat: "Impact & Social Enterprise" },
  { id: "bes", name: "Business Ethics Society", cat: "Impact & Social Enterprise" },
  { id: "mdsa", name: "MDSA", cat: "Tech & Engineering" },
  { id: "fbif", name: "FBIF", cat: "Finance & Investing" },
  { id: "grc", name: "GRC", cat: "Consulting" },
  { id: "portico", name: "Portico", cat: "Finance & Investing" },
  { id: "sales-trading", name: "Sales and Trading", cat: "Finance & Investing" },
  { id: "seed", name: "SEED", cat: "Impact & Social Enterprise" },
  { id: "vcg", name: "VCG", cat: "Consulting" },
  { id: "common-cents", name: "Common Cents", cat: "Finance & Investing" },
  { id: "mna", name: "Mergers & Acquisitions", cat: "Finance & Investing" }
];

export const demoClubs: Club[] = [];
export const demoDiscoverClubs: DirectoryClub[] = [];
export const demoClubPipelines: Record<string, PipelineRound[]> = {};
export const demoClubQuestions: Record<string, BuilderQuestion[]> = {};
export const demoClubRosters: Record<string, RosterMember[]> = {};
export const demoClubExecutives: Record<string, ClubExecutive[]> = {};
export const demoClubBranding: Record<string, ClubBrandingProfile> = {};

const currentDate = new Date();

baseClubs.forEach((base, index) => {
  const color = detSelect(COLORS, index);
  const logoText = base.name.substring(0, 3).toUpperCase();
  const membersCount = 15 + (index * 7 % 45); // Varies between 15 and ~60
  
  // 1. Club object
  const club: Club = {
    id: base.id,
    name: base.name,
    tagline: `A student organization focused on ${base.cat.toLowerCase()}.`,
    logoUrl: null,
    logoText,
    color,
    acceptanceRate: "Sample Data",
    aum: "Sample Data",
    members: membersCount,
    description: `We are a demo student organization dedicated to helping members grow professionally and academically in the field of ${base.cat}. This is sample demo data.`,
    exec: [
      { name: detSelect(FICTIONAL_NAMES, index), role: "President", initials: getInitials(detSelect(FICTIONAL_NAMES, index)) },
      { name: detSelect(FICTIONAL_NAMES, index + 1), role: "Vice President", initials: getInitials(detSelect(FICTIONAL_NAMES, index + 1)) }
    ]
  };
  demoClubs.push(club);

  // 2. DiscoverClub / DirectoryClub
  const directoryClub: DirectoryClub = {
    id: base.id,
    name: base.name,
    logoUrl: null,
    logoText,
    color,
    category: base.cat,
    pitch: `Join ${base.name} to accelerate your career.`,
    tags: ["demo", "student-led", "professional"],
    acceptanceRate: null,
    aumValue: null,
    timeCommitment: (["1-3", "3-5", "5+"] as TimeCommitment[])[index % 3],
    recommended: index % 4 === 0,
    source: "database",
    description: `Welcome to the ${base.name} directory page. We focus on ${base.cat.toLowerCase()}.`,
    bannerUrl: null,
    applicationAvailable: true,
    requirements: ["Resume", "Cover Letter (Optional)"],
    publicEvents: [
      {
        id: `evt-${base.id}-1`,
        title: "Info Session 1",
        date: new Date(currentDate.getTime() + 86400000 * 2).toISOString(),
        location: "Virtual",
        description: "Come learn about our organization!"
      }
    ]
  };
  demoDiscoverClubs.push(directoryClub);

  // 3. Pipeline Rounds
  const numRounds = 2 + (index % 3); // 2, 3, or 4 rounds
  const rounds: PipelineRound[] = [];
  for (let r = 0; r < numRounds; r++) {
    rounds.push({
      id: `rnd-${base.id}-${r}`,
      name: r === 0 ? "Application Review" : r === numRounds - 1 ? "Final Interview" : `Round ${r + 1}`,
      duration: "1 Week",
      scoringMetric: (r === 0 ? "Pass/Fail" : "1-5 Scale") as any,
      questions: [
        { id: `q-${r}-1`, text: "Candidate Fit" },
        { id: `q-${r}-2`, text: "Technical Skills" }
      ]
    });
  }
  demoClubPipelines[base.id] = rounds;

  // 4. Questions
  const numQuestions = 3 + (index % 4);
  const questions: BuilderQuestion[] = [];
  for (let q = 0; q < numQuestions; q++) {
    questions.push({
      id: `bq-${base.id}-${q}`,
      type: (q === 0 ? "essay" : q === 1 ? "file-upload" : "multiple-choice") as any,
      prompt: q === 0 ? "Why do you want to join?" : q === 1 ? "Upload your resume" : "What is your year?",
      required: true,
      enforceWordCount: q === 0,
      minWords: q === 0 ? 50 : undefined,
      maxWords: q === 0 ? 250 : undefined,
      allowedFileTypes: q === 1 ? ".pdf" : undefined,
      maxFileSizeMb: q === 1 ? 5 : undefined,
      options: q > 1 ? ["First Year", "Second Year", "Third Year", "Fourth Year"] : undefined
    });
  }
  demoClubQuestions[base.id] = questions;

  // 5. Roster
  const roster: RosterMember[] = [];
  for (let m = 0; m < 5; m++) {
    const memberName = detSelect(FICTIONAL_NAMES, index + m * 2);
    roster.push({
      id: `mem-${base.id}-${m}`,
      name: memberName,
      initials: getInitials(memberName),
      email: `${memberName.split(" ")[0].toLowerCase()}@demo.edu`,
      role: (m === 0 ? "President / Super Admin" : m === 1 ? "Recruitment Lead / Evaluator" : "General Member") as any,
      canViewSensitiveData: m <= 1,
      canScoreInterviews: m <= 1,
      canEditQuestions: m === 0
    });
  }
  demoClubRosters[base.id] = roster;

  // 6. Executives
  const execs: ClubExecutive[] = [
    {
      id: `exec-${base.id}-1`,
      name: detSelect(FICTIONAL_NAMES, index),
      initials: getInitials(detSelect(FICTIONAL_NAMES, index)),
      title: "President"
    },
    {
      id: `exec-${base.id}-2`,
      name: detSelect(FICTIONAL_NAMES, index + 1),
      initials: getInitials(detSelect(FICTIONAL_NAMES, index + 1)),
      title: "Vice President"
    }
  ];
  demoClubExecutives[base.id] = execs;

  // 7. Branding Profile
  demoClubBranding[base.id] = {
    name: base.name,
    tagline: `Accelerating careers in ${base.cat}.`,
    category: base.cat as BrandingClubCategory,
    logoUrl: null,
    bannerUrl: null,
    accentColor: color,
    acceptanceRate: "Sample Data",
    aum: "Sample Data",
    displayAum: base.cat === "Finance & Investing",
    memberCount: membersCount.toString(),
    placements: ["Sample Data"],
    accolades: [{ id: "demo", text: "Sample accolade — demo data" }],
    website: `https://${base.id}-demo.edu`,
    linkedin: `https://linkedin.com/company/${base.id}-demo`,
    instagram: `@${base.id}_demo`,
    contactEmail: `contact@${base.id}-demo.edu`
  };
});

import type { DemoRecruitingRule, DemoRecruitingFlag, DemoRuleAudit } from "./recruiting-rules"
import { defaultVotingDisplay } from "@/lib/voting-presentation"
import { defaultDisplayConfig } from "@/lib/applicant-display"
import { readMarketing } from "@/lib/club-marketing"
import { seedTasks } from "./task-seed"
import { sampleInterviewKit, type InterviewSessionData } from "@/lib/interview-kits"
import { demoMonogram } from "./assets"
import type { AppStatus as ApplicationStatus } from "@prisma/client"

// Only the organization names below are real labels supplied for the presentation.
// Everything else is fictional sample information, not verified club claims.
export const DEMO_CLUBS = [
  ["mii", "MII", "Finance", "equity research"],
  ["gmg", "GMG", "Finance", "global markets"],
  ["aif", "AIF", "Finance", "alternative investments"],
  ["vvf", "VVF", "Finance", "venture investing"],
  ["tamid", "TAMID", "Consulting", "growth strategy"],
  ["180dc", "180 Degrees Consulting", "Consulting", "nonprofit consulting"],
  ["ama", "AMA", "Marketing", "brand strategy"],
  ["accounting", "Accounting Society", "Professional", "financial reporting"],
  ["akpsi", "AKPsi", "Professional", "professional leadership"],
  ["enactus", "Enactus", "Entrepreneurship", "social enterprise"],
  ["ethics", "Business Ethics Society", "Professional", "responsible business"],
  ["mdsa", "MDSA", "Professional", "inclusive community"],
  ["fbif", "FBIF", "Finance", "fundamental investing"],
  ["grc", "GRC", "Consulting", "community research"],
  ["portico", "Portico", "Entrepreneurship", "early-stage ideas"],
  ["trading", "Sales and Trading", "Finance", "market structure"],
  ["seed", "SEED", "Entrepreneurship", "sustainable ventures"],
  ["vcg", "VCG", "Consulting", "structured problem solving"],
  ["common-cents", "Common Cents", "Professional", "financial education"],
  ["ma", "Mergers & Acquisitions", "Finance", "corporate transactions"],
] as const
const first = [
  "Jordan",
  "Amara",
  "Theo",
  "Priya",
  "Mateo",
  "Leila",
  "Owen",
  "Sora",
  "Nadia",
  "Elias",
  "Maya",
  "Arjun",
  "Zoe",
  "Kian",
  "Imani",
  "Noah",
  "Lucia",
  "Ravi",
  "Isla",
  "Felix",
]
const last = [
  "Avery",
  "Merritt",
  "Solano",
  "Bennett",
  "Okafor",
  "Navarro",
  "Desai",
  "Park",
  "Whitaker",
  "Haddad",
]
const majors = [
  "Economics",
  "Computer Science",
  "Commerce",
  "Statistics",
  "Systems Engineering",
  "Global Studies",
  "Psychology",
  "English",
  "Biology",
  "Public Policy",
]
const activities = [
  "Research assistant",
  "Software internship",
  "Community project lead",
  "Editorial intern",
  "Volunteer coordinator",
  "Student venture project",
]
const skills = [
  "Python and data analysis",
  "Financial modeling",
  "Writing and research",
  "Design and prototyping",
  "Public speaking",
  "Project coordination",
]
export const uid = (kind: number, n: number) =>
  `de000000-0000-4000-8000-${String(kind * 100000 + n).padStart(12, "0")}`
export function createDemoSeed(anchor = new Date().toISOString().slice(0, 10)) {
  const at = (days: number, hour = 16, minute = 30) => {
    const d = new Date(`${anchor}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    d.setUTCHours(hour + 4, minute, 0, 0)
    return d
  }
  const year = new Date(anchor).getUTCFullYear()
  const students = Array.from({ length: 200 }, (_, i) => ({
    id: uid(1, i),
    email: `student${i + 1}@demo.invalid`,
    role: "STUDENT" as const,
    createdAt: at(-60),
    profile: {
      id: uid(2, i),
      userId: uid(1, i),
      firstName: first[i % 20],
      lastName: last[Math.floor(i / 20)],
      computingId: `sample${i + 1}`,
      major: majors[i % majors.length],
      gradYear: year + 1 + (i % 4),
      gpa: i === 0 ? 3.72 : i % 7 === 0 ? null : Number((3.1 + (i % 19) * 0.045).toFixed(2)),
      actScore: i === 0 ? 33 : i % 3 ? 24 + (i % 13) : null,
      actEnglish: null as number | null, actMath: null as number | null, actReading: null as number | null, actScience: null as number | null,
      satScore: i === 0 ? 1480 : i % 4 ? 1250 + (i % 16) * 20 : null,
      bio:
        i % 9 === 8
          ? null
          : `Fictional UVA student exploring ${majors[i % majors.length].toLowerCase()}. Interested in ${skills[i % skills.length].toLowerCase()} and practical, collaborative projects.`,
      linkedinUrl: `https://linkedin.com/in/outclass-demo-${i + 1}`,
      resumeUrl: i % 3 !== 2 ? "/demo/sample-resume.pdf" : null,
      headshotUrl: i % 5 === 4 ? null : "/demo/sample-headshot.svg",
      experiences: Array.from({ length: i % 5 === 4 ? 1 : 3 }, (_, j) => ({
        id: uid(3, i * 3 + j),
        studentProfileId: uid(2, i),
        title: activities[(i + j) % activities.length],
        subtitle: `Fictional ${["campus research team", "local startup", "community organization"][j]} · ${skills[(i + j) % skills.length]}`,
        period: `${year - 1 + (j % 2)} · ${j === 0 ? "Present" : "Summer"}`,
      })),
    },
  }))
  const clubs = DEMO_CLUBS.map(([slug, name, category, theme], i) => ({
    id: uid(4, i),
    slug,
    name,
    testRequirement: ["BOTH", "SAT", "ACT", "SAT_OR_ACT", "OPTIONAL"][i % 5],
    claimed: i < 17,
    earlyAdopter: i < 3,
    category,
    theme,
    tagline: "",
    bannerUrl: null as string | null,
    marketing: {} as import("@/lib/club-marketing").ClubMarketing,
    acceptanceRate: (15 + (i % 7) * 3) as number | null,
    aumValue: null as number | null,
    logoText: name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3),
    logoUrl: demoMonogram(name, ["#142d4e", "#315b51", "#514961"][i % 3]),
    color: ["#142d4e", "#315b51", "#514961"][i % 3],
    description: `DEMO / SAMPLE: ${name} is presented here through a fictional ${theme} recruitment scenario. Projects, people, dates and results are illustrative, not verified organization facts.`,
    target: 12 + (i % 5) * 2,
    deadline: at(3 + (i % 10), 19, 59),
    questions: [
      {
        id: uid(5, i * 3),
        prompt: `Why would you like to explore ${theme} with ${name}?`,
        type: "ESSAY" as const,
        required: true,
        wordLimit: 200,
      },
      {
        id: uid(5, i * 3 + 1),
        prompt: `Describe a project where you used ${category === "Finance" ? "evidence to revise an assumption" : category === "Consulting" ? "a structured approach to an ambiguous problem" : category === "Marketing" ? "audience insight to improve an idea" : "collaboration to make progress"}.`,
        type: "ESSAY" as const,
        required: true,
        wordLimit: 250,
      },
      {
        id: uid(5, i * 3 + 2),
        prompt: `What would you contribute to our sample ${theme} project?`,
        type: "ESSAY" as const,
        required: false,
        wordLimit: 150,
      },
    ],
    interviewQuestions:
      category === "Finance"
        ? [
            `How would you investigate a ${theme} opportunity?`,
            "What evidence would change your thesis?",
            "Describe a disagreement over an assumption.",
          ]
        : category === "Consulting"
          ? [
              `Structure a ${theme} project for a local organization.`,
              "How would you estimate demand with limited data?",
              "How would you communicate an uncertain recommendation?",
            ]
          : category === "Marketing"
            ? [
                "Design a campaign for a campus refill station.",
                "Which audience would you prioritize and why?",
                "How would you measure incremental impact?",
              ]
            : [
                `Pitch a small ${theme} initiative.`,
                "What would you test before committing resources?",
                "Describe a time you helped a quieter teammate contribute.",
              ],
    rounds: [
      "Applied",
      "Review",
      "Round 1",
      ...(i % 3 ? ["Round 2"] : []),
      "Interview",
      "Final Decision",
    ].map((name, order) => ({ interviewKit: sampleInterviewKit(), kitVersion: 0, anonymousReview: name === "Review", id: uid(6, i * 10 + order), clubId: uid(4, i), name, order })),
  }))
  const memberships = clubs.filter(club => club.claimed).flatMap((club, c) =>
    Array.from({ length: 12 + (c % 12) }, (_, m) => ({
      id: uid(7, c * 30 + m),
      groups: m % 2 === 0 ? ["Equity research", "Presentations"] : ["Market research"],
      cohort: m < 6 ? "Fall 2026" : "Spring 2026" as string | null,
      clubId: club.id,
      userId: c === 0 && m === 0 ? students[0].id : c === 4 && m === 4 ? students[0].id : students[1 + ((c * 7 + m + 120) % 199)].id,
      role:
        m === 0
          ? ("PRESIDENT" as const)
          : m < 4
            ? ("RECRUITMENT_LEAD" as const)
            : ("GENERAL_MEMBER" as const),
    })),
  )
  const applications = clubs.filter(club => club.claimed).flatMap((club, c) =>
    Array.from({ length: 40 + (c % 6) * 8 }, (_, a) => {
      const student = students[a === 0 && c < 8 ? 0 : 1 + ((a + c * 3) % 119)]
      const stages = [
        "SUBMITTED",
        "IN_REVIEW",
        "INTERVIEWING",
        "INTERVIEWING",
        "ACCEPTED",
        "REJECTED",
        "WAITLISTED",
      ] as ApplicationStatus[]
      const status: ApplicationStatus =
        a === 0
          ? (["INTERVIEWING", "IN_REVIEW", "DRAFTING", "SUBMITTED", "ACCEPTED", "WAITLISTED"][
              c % 6
            ] as ApplicationStatus)
          : stages[(a + c) % stages.length]
      const round =
        club.rounds[
          status === "INTERVIEWING"
            ? a % 3 === 0
              ? club.rounds.length - 2
              : 2 + (a % Math.max(1, club.rounds.length - 4))
            : ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(status)
              ? club.rounds.length - 1
              : status === "IN_REVIEW"
                ? 1
                : 0
        ]
      const id = uid(8, c * 100 + a)
      return {
        id,
        studentId: student.id,
        clubId: club.id,
        roundId: round.id,
        status,
        anonymousReviewText: round.anonymousReview ? "Manager-reviewed sample: compared alternative approaches, tested assumptions against evidence, and revised a team recommendation." : null as string | null,
        submittedAt: status === "DRAFTING" ? null : at(-8 + (a % 5)),
        answers: club.questions.slice(0, status === "DRAFTING" ? 1 : 3).map((q, j) => ({
          id: `${id}-answer-${j}`,
          applicationId: id,
          questionId: q.id,
          response: `Fictional response: ${j === 0 ? `I want to learn ${club.theme} by testing ideas with a team.` : j === 1 ? `In my ${activities[(a + c) % activities.length].toLowerCase()} project, I compared three approaches, asked teammates to challenge my assumptions, and revised our recommendation.` : `I would contribute ${skills[(a + c) % skills.length].toLowerCase()} and document what we learn.`} At ${club.name}, I would begin with a small research question and bring evidence to our next discussion.`,
        })),
        evaluations:
          ["DRAFTING", "SUBMITTED"].includes(status) || a % 5 === 1
            ? []
            : Array.from({ length: 1 + (a % 3) }, (_, e) => ({
                id: `${id}-eval-${e}`,
                applicationId: id,
                interviewerId: memberships.find(
                  (m) => m.clubId === club.id && m.role === "PRESIDENT",
                )!.id,
                round: club.rounds[Math.min(e + 1, club.rounds.length - 1)].name,
                score: 5 + ((a + e + c) % 6),
                notes: `Sample review: ${["Clear reasoning and thoughtful follow-up questions.", "Strong collaboration example; explore ownership in the next round.", "Promising preparation; ask for a more specific trade-off."][(a + e) % 3]}`,
                createdAt: at(-3 + e),
              })),
      }
    }),
  )
  const slots = clubs.filter(club => club.claimed).flatMap((club, c) =>
    Array.from({ length: 12 }, (_, i) => {
      const candidate = applications.filter(
        (a) => a.clubId === club.id && a.status === "INTERVIEWING",
      )[i]
      if (i < 8 && candidate)
        candidate.roundId = club.rounds.find((r) => r.name === "Interview")!.id
      return {
        id: uid(9, c * 20 + i),
        clubId: club.id,
        startTime: at(i > 5 && i < 8 ? -1 : 1 + (c % 5) + Math.floor(i / 4), 14 + (i % 4)),
        endTime: at(i > 5 && i < 8 ? -1 : 1 + (c % 5) + Math.floor(i / 4), 14 + (i % 4), 50),
        location: [
          "Newcomb Hall · sample room",
          "Clemons · sample meeting room",
          "Online · sample session",
        ][c % 3],
        applicationId: i < 8 && candidate ? candidate.id : null,
        interviewerId: memberships.find((m) => m.clubId === club.id && m.role === "PRESIDENT")!.id,
      }
    }),
  )
  const interviews: (InterviewSessionData & { applicationId: string; interviewerId: string; roundId: string; clubId: string; anonymousReview: boolean })[] = clubs.filter(club => club.claimed).flatMap(club => {
    const round = club.rounds.find(r => r.name === "Interview")!
    const interviewer = memberships.find(m => m.clubId === club.id && m.role === "PRESIDENT")!
    return applications.filter(a => a.clubId === club.id && a.roundId === round.id).slice(0, 2).map((app, i) => {
      const draft = { questionNotes: sampleInterviewKit().map((q, n) => ({ questionId: q.id, notes: ["Supported the thesis with a concrete example and acknowledged uncertainty.", "Explained the disagreement thoughtfully and took responsibility for follow-through.", "Interested in weekly research and learning from peer feedback."][n] })), additionalQuestions: [{ id: uid(15, clubs.indexOf(club) * 2 + i), question: "What evidence would make you abandon your original idea?", notes: "Would revisit the thesis if the key assumptions stopped holding." }], overallReview: "Fictional interview: thoughtful reasoning, clear communication, and practical curiosity.", score: 8 }
      const priorEvaluation = app.evaluations.find(e => e.interviewerId === interviewer.id && e.round === round.name)
      if (priorEvaluation) { draft.score = priorEvaluation.score; draft.overallReview = priorEvaluation.notes || draft.overallReview }
      const completedAt = i === 0 ? at(-1).toISOString() : null
      if (completedAt && !app.evaluations.some(e => e.interviewerId === interviewer.id && e.round === round.name)) app.evaluations.push({ id: uid(16, clubs.indexOf(club)), applicationId: app.id, interviewerId: interviewer.id, round: round.name, score: 8, notes: draft.overallReview, createdAt: at(-1) })
      return { id: uid(14, clubs.indexOf(club) * 2 + i), applicationId: app.id, interviewerId: interviewer.id, roundId: round.id, clubId: club.id, anonymousReview: false, revision: 1, questions: sampleInterviewKit(), draft, completedAt }
    })
  })
  for (const record of interviews.filter(record => record.completedAt)) {
    for (const slot of slots.filter(slot => slot.applicationId === record.applicationId)) {
      slot.startTime = at(-1, 14); slot.endTime = at(-1, 14, 50)
    }
  }
  // Current-product fixtures share the existing profiles, rounds, interviews, and applications.
  students[0].profile.experiences = [
    ["Education · UVA", "Economics · coursework in econometrics and statistics", `${year - 2}–Present`],
    ["Research assistant", "Fictional campus team · tested local transit demand assumptions", `${year - 1}–Present`],
    ["Data analyst intern", "Fictional community enterprise · Python analysis and reporting", `${year} · Summer`],
    ["Campus refill project", "Fictional student project · interviews, prototype, and budget planning", `${year} · Spring`],
    ["Skills and interests", "Python, financial modeling, research writing, and team facilitation", "Ongoing"],
  ].map(([title, subtitle, period], i) => ({ id: uid(30, i), studentProfileId: students[0].profile.id, title, subtitle, period }))
  clubs[0].tagline = "Sample research, thoughtful debate, and practical learning"
  clubs[0].marketing = readMarketing({ memberCount: memberships.filter(m => m.clubId === clubs[0].id).length, showAum: false, benefits: ["Fictional weekly research teams", "Sample peer mentoring"], commitment: "Sample: 3–5 hours per week", eligibility: "Fictional undergraduate recruitment example", faqs: [{ question: "What is this demonstration?", answer: "All people, projects, and outcomes are fictional. Nothing is submitted to a real club." }] })
  const mii = clubs[0], manager = memberships.find(m => m.clubId === mii.id && m.role === "PRESIDENT")!
  const interviewRound = mii.rounds.find(r => r.name === "Interview")!
  const reviewRound = mii.rounds.find(r => r.name === "Review")!
  const interviewPool = applications.filter(a => a.clubId === mii.id && a.roundId === interviewRound.id && a.status === "INTERVIEWING").slice(0, 6)
  const observations = interviewPool.slice(0, 3).flatMap((app, i) => (["PRO", "CON"] as const).map((kind, j) => ({
    id: uid(31, i * 2 + j), applicationId: app.id, kind, author: "Jordan Avery", own: true,
    body: kind === "PRO" ? "Sample: explained the evidence behind a revised recommendation." : "Sample: follow up on ownership and how the project result was measured.",
    createdAt: at(-1).toISOString(), updatedAt: at(-1).toISOString(),
  })))
  const applicantDisplay = Object.fromEntries(mii.rounds.map(r => [r.id, { config: structuredClone(defaultDisplayConfig), version: 1 }]))
  const recruitingRules: DemoRecruitingRule[] = [{ roundId: reviewRound.id, minGpa: 3.3, minSat: 1350, minAct: 28, revision: 1, updatedAt: at(-4) }]
  type Session = NonNullable<Awaited<ReturnType<typeof import("@/actions/voting").getVotingWorkspace>>["session"]>
  function votingFixture(n: number, pool: typeof applications, published: boolean): Session {
    const id = uid(32, n), started = at(published ? -5 : -1), decisions = ["PASS", "PASS", "HOLD", "NOT_PASS", "HOLD", "HOLD"] as const
    const choice = (app: typeof applications[number], i: number) => published ? app.status === "ACCEPTED" ? "PASS" : app.status === "WAITLISTED" ? "HOLD" : "NOT_PASS" : decisions[i]
    const entries = pool.map((app, position) => ({ sessionId: id, passNumber: 1, applicationId: app.id, position, override: null, overrideBy: null, overrideAt: null, ballots: [{ id: uid(33, n * 20 + position), sessionId: id, passNumber: 1, applicationId: app.id, memberId: manager.id, decision: choice(app, position), createdAt: started }] }))
    return { id, clubId: mii.id, roundId: pool[0].roundId, state: published ? "COMPLETED" : "OPEN", displayConfig:structuredClone(defaultVotingDisplay),joinOpenedAt:started,activeApplicationId:published?null:pool[2]?.id??null, targetSize: 2, autoAdvance: "UNANIMOUS", threshold: 100, currentPass: published ? 1 : 2, revision: published ? 5 : 12, createdBy: manager.userId, startedAt: started, endedAt: published ? at(-4) : null, publishedAt: published ? at(-4) : null, publishedBy: published ? manager.userId : null, createdAt: started, updatedAt: published ? at(-4) : at(0),
      participants: [{ sessionId: id, memberId: manager.id, joinedAt:started }],
      candidates: pool.map((app, position) => ({ sessionId: id, applicationId: app.id, position, expectedStatus: published ? "INTERVIEWING" : app.status, publishedStatus: published ? app.status : null })),
      passes: [{ sessionId: id, number: 1, state: "COMPLETED", startedAt: started, completedAt: at(published ? -4 : -1, 17), candidates: entries }, ...(published ? [] : [{ sessionId: id, number: 2, state: "OPEN" as const, startedAt: at(0), completedAt: null, candidates: pool.map((app, i) => ({ app, i })).filter(({i}) => i >= 2 && i !== 3).map(({app, i}, position) => ({ sessionId: id, passNumber: 2, applicationId: app.id, position, override: null, overrideBy: null, overrideAt: null, ballots: i === 2 ? [{ id: uid(33, n * 20 + 10), sessionId: id, passNumber: 2, applicationId: app.id, memberId: manager.id, decision: "HOLD" as const, createdAt: at(0) }] : [] })) }])],
    }
  }
  const finalPool = applications.filter(a => a.clubId === mii.id && ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(a.status)).slice(0, 3)
  const votingSessions = [votingFixture(0, finalPool, true), votingFixture(1, interviewPool, false)]
  const votingAudit = votingSessions.flatMap(session => ["voting.session.created", "voting.start_pass", "voting.ballot.submitted", "voting.complete_pass", ...(session.publishedAt ? ["voting.finish", "voting.publish"] : ["voting.start_pass"])].map(action => ({ action, sessionId: session.id, at: session.updatedAt })))
  // A booked historical interview and open future slots use the same room/calendar graph.
  const studentSlot = slots.find(slot => slot.applicationId === interviewPool[0].id)!
  const roomId = uid(34, 0), historicalSlot = uid(35, 0)
  const interviewRooms: import("@/lib/interview-rooms").InterviewRoom[] = [{ id: roomId, clubId: mii.id, roundId: interviewRound.id, name: "Sample research panel", location: studentSlot.location, kind: "IN_PERSON", timezone: "America/New_York", duration: 20, buffer: 5, isOpen: true, panelMemberIds: [manager.id], slots: [{ id: historicalSlot, startTime: studentSlot.startTime.toISOString(), endTime: studentSlot.endTime.toISOString(), capacity: 1, booked: 0 }, ...[0, 1, 2].map(i => ({ id: uid(35, i + 1), startTime: at(4, 10, i * 25).toISOString(), endTime: at(4, 10, i * 25 + 20).toISOString(), capacity: 1, booked: 0 }))] }]
  const roomBookings: import("@/lib/interview-rooms").RoomBooking[] = [{ id: studentSlot.id, applicationId: interviewPool[0].id, slotId: historicalSlot, roomId, roundId: interviewRound.id, candidate: "Jordan Avery", startTime: studentSlot.startTime.toISOString(), endTime: studentSlot.endTime.toISOString(), location: studentSlot.location }]
  // GMG is already on Jordan's Corkboard: its invitation demonstrates self-service booking.
  const invitedClub = clubs[1], invitedRound = invitedClub.rounds.find(r => r.name === "Interview")!
  const invitedApplication = applications.find(a => a.clubId === invitedClub.id && a.studentId === students[0].id)!
  invitedApplication.status = "INTERVIEWING"; invitedApplication.roundId = invitedRound.id
  interviewRooms.push({ id: uid(34, 1), clubId: invitedClub.id, roundId: invitedRound.id, name: "Sample markets conversation", location: "Clemons · sample meeting room", kind: "IN_PERSON", timezone: "America/New_York", duration: 20, buffer: 5, isOpen: true, panelMemberIds: [memberships.find(m => m.clubId === invitedClub.id && m.role === "PRESIDENT")!.id], slots: [0, 1, 2].map(i => ({ id: uid(35, 10 + i), startTime: at(5, 10, i * 25).toISOString(), endTime: at(5, 10, i * 25 + 20).toISOString(), capacity: 1, booked: 0 })) })

  const meetings = clubs.filter(club => club.claimed).flatMap((club,c) => Array.from({length:5},(_,i)=>({
    id: uid(17,c*10+i), clubId:club.id, club:{name:club.name}, title: `${club.name} · sample ${i<3?"interest meeting":"member meeting"} ${i+1}`,
    description: "Fictional meeting for the OutClass demonstration.", date:at(i<2?-7+i*3:i===2?0:i===3?-2:5,12), endDate:at(i<2?-7+i*3:i===2?0:i===3?-2:5,13) as Date | null,
    location:"Newcomb Hall · sample room", audience:i<3?"RECRUITMENT":"MEMBERS", isPublic:i<3,
    agenda:"Introductions\nDiscussion and practical examples\nQuestions and next steps", recap:i===0||i===1||i===3?"Sample recap: discussed the agenda, shared resources, and outlined next steps.":"",
    resources:[{id:uid(18,c*10+i),label:i % 2 ? "Sample meeting handout" : "UVA campus resources (sample link)",kind:(i % 2 ? "FILE" : "LINK") as "LINK" | "FILE" | "SLIDES",url:i % 2 ? "/demo/sample-meeting.txt" : "https://www.virginia.edu"}],revision:0,
  })))
  const meetingAttendances = meetings.filter(m=>m.date<at(0,0)).flatMap((meeting,i)=>students.filter(student=>meeting.audience==="RECRUITMENT" ? students.indexOf(student)%4===i%4 : memberships.some(m=>m.clubId===meeting.clubId&&m.userId===student.id)).slice(0,15).map((student,j)=>({id:uid(19,i*20+j),eventId:meeting.id,studentId:student.id,checkedInAt:new Date(meeting.date.getTime()+j*60000)})))
  const meetingTokens: {meetingId:string;token:string;expiresAt:string;issuedBy:string}[] = []
  return {
    tasks: seedTasks(clubs[0].id, memberships.filter(m=>m.clubId===clubs[0].id).map(m=>({...m,user:{id:m.userId,email:students.find(s=>s.id===m.userId)!.email,studentProfile:students.find(s=>s.id===m.userId)!.profile}})), anchor),
    meetings, meetingAttendances, meetingTokens,
    interviews,
    tutorials: { student: { status: "SKIPPED", step: 0, version: 1 }, leader: { status: "SKIPPED", step: 0, version: 1 } } as Record<import("@/lib/tutorials").TutorialExperience, import("@/lib/tutorials").TutorialProgress>,
    applicantDisplay,
    votingSessions,
    votingAudit,
    observations: observations as (import("@/lib/applicant-display").ObservationView & { applicationId: string })[],
    recruitingRules,
    recruitingFlags: [] as DemoRecruitingFlag[],
    recruitingRuleAudit: [] as DemoRuleAudit[],
    version: 1 as const,
    anchor,
    perspective: { role: "student" as "student" | "leader", clubId: clubs[0].id },
    students,
    clubs,
    memberships,
    applications,
    interviewRooms,
    roomBookings,
    slots,
    corkboard: clubs.slice(1, 3).map(club => ({ clubId: club.id, savedAt: new Date(`${anchor}T12:00:00Z`) })),
    subscriptions: clubs.slice(0, 7).map((c) => c.id),
    readNotifications: [] as string[],
    deletedNotifications: [] as string[],
    responses: {} as Record<string, "going" | "confirmed" | "declined">,
  }
}
export type DemoState = ReturnType<typeof createDemoSeed>

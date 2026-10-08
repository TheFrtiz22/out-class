export const publicFaqGroups = [
  {
    id: "getting-started", label: "Getting started", items: [
      { id: "what-is-outclass", question: "What is OutClass?", answer: "OutClass is a platform for college club recruitment. It brings organization discovery, applications, interviews, and recruitment status into one experience for students, with recruiting tools for club leaders." },
      { id: "who-can-use-outclass", question: "Who can use OutClass?", answer: "Account access currently begins with verified University of Virginia email addresses for the campus pilot. Students, club leaders, and university administrators from any university can request their school without creating an account." },
      { id: "campus-pilot", question: "When will OutClass be available?", answer: "OutClass is beginning with a campus pilot at the University of Virginia. Clubs join the pilot individually; no general launch date has been announced." },
    ],
  },
  {
    id: "students-applications", label: "Students & applications", items: [
      { id: "student-applications", question: "How do students apply to clubs?", answer: "Get Started opens student profile setup for new visitors. Use your UVA account, complete your profile, and explore participating clubs. Submit each club’s application when recruitment is open; requirements and decisions are set by the club." },
      { id: "shared-profile", question: "What goes in my shared profile?", answer: "Your profile brings together your academics, experience, and resume. Clubs can ask their own application questions alongside that shared introduction, so each application may have different requirements." },
      { id: "interview-booking", question: "How do interviews work?", answer: "When a participating club invites you to interview, you can book from the times it makes available. Your interview booking and application status stay in OutClass. An application does not guarantee an interview or acceptance." },
    ],
  },
  {
    id: "club-leaders", label: "Club leaders", items: [
      { id: "leader-tools", question: "What can club leaders do?", answer: "Club leaders can configure applications, manage applicants, coordinate interviews and scheduling, collaborate on evaluations, and manage recruitment decisions. Access to specific tools depends on the permissions granted in their club workspace." },
    ],
  },
  {
    id: "accounts-campus", label: "Accounts & campus", items: [
      { id: "sign-in-options", question: "How do I sign in?", answer: "Choose Log In to use the existing UVA sign-in flow. You can continue with UVA, or use your UVA email and password. Existing accounts can also request an email sign-in code." },
      { id: "application-access", question: "Are application responses on public club profiles?", answer: "Public club profiles describe organizations; they do not display student application responses. Applications are reviewed through authenticated club workspaces with role and permission checks." },
      { id: "uva-independence", question: "Is OutClass part of the University of Virginia?", answer: "OutClass is an independent platform being built for students and student organizations beginning at the University of Virginia. It is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university." },
    ],
  },
  {
    id: "other-universities", label: "Other universities", items: [
      { id: "request-another-university", question: "How can another university request access?", answer: "Choose Request Your School and share your university and contact details. No account is required. OutClass administrators review requests; submitting a request does not approve a university or immediately enable account access." },
    ],
  },
] as const

export const publicFaqs = publicFaqGroups.flatMap<{ id: string; question: string; answer: string }>(group => group.items)

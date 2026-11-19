// Staging-only seed for the mobile build (docs/mobile/BUILD_PROMPT.md). Clearly FICTIONAL data.
//
//   node scripts/staging/seed.cjs            seed (safe to re-run)
//   node scripts/staging/seed.cjs --verify   read-only row counts, key record ids, sign-in check
//
// Fails closed: guard.cjs exits unless every connection names the staging project.
// Idempotent: every row has a stable id derived from a key, and existing rows are left alone
// (many tables are immutable by trigger). A re-run only (a) rotates the five account passwords
// and rewrites docs/mobile/STAGING_ACCOUNTS.local.md, (b) moves the "live now" meeting to the
// current time, (c) extends open application deadlines, and (d) tops up future interview times
// and events as the calendar moves on. Nothing is deleted.
// Email safety: bulk students use the undeliverable @staging.test domain, every queued
// notification email is marked SUPPRESSED in the same transaction that created it, and the five
// sign-in accounts have optional email turned off. Never prints secrets or passwords.
"use strict";
const { loadStagingEnv } = require("./guard.cjs");
const env = loadStagingEnv();
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");

const VERIFY = process.argv.includes("--verify");
const db = new PrismaClient({ datasourceUrl: env.migrationUrl, log: [] });
const ACCOUNTS_FILE = path.join(env.root, "docs/mobile/STAGING_ACCOUNTS.local.md");
const NOW = new Date();
const TX = { timeout: 240000, maxWait: 30000 };
const ZONE = "America/New_York";
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

// ---------- small helpers ----------
const scrub = text => String(text || "").replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]").replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted]").replace(/sb_(secret|publishable)_\w+/g, "[redacted]");
function uid(key) {
  const h = crypto.createHash("sha256").update(`outclass-staging-seed:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function rng(key) {
  let a = parseInt(crypto.createHash("sha256").update(String(key)).digest("hex").slice(0, 8), 16) >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
function sample(r, list, n) { const copy = [...list], out = []; while (copy.length && out.length < n) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]); return out; }
const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const wallFmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function wall(date) { const p = Object.fromEntries(wallFmt.formatToParts(date).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; }
const etDay = date => wall(date).slice(0, 10);
/** Eastern wall time -> instant (EST/EDT resolved; seed times never fall in a DST gap). */
function et(day, time) {
  const target = `${day}T${time}`, base = new Date(`${target}:00Z`).getTime();
  for (const h of [4, 5]) { const d = new Date(base + h * HOUR); if (wall(d) === target) return d; }
  throw new Error(`No Eastern instant for ${target}`);
}
const addDays = (day, n) => new Date(+new Date(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekday = day => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 Sun .. 6 Sat
const TODAY = etDay(NOW);
const WEEK = addDays(TODAY, -((weekday(TODAY) + 6) % 7)); // Monday of this Eastern week: stable anchor for re-runs
const hhmm = minutes => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Create only rows whose id is not there yet; BEFORE INSERT guards never see a duplicate. */
async function insertMissing(tx, model, rows, size = 400) {
  let created = 0;
  rows = [...new Map(rows.map(row => [row.id, row])).values()];
  for (const part of chunk(rows, size)) {
    const have = new Set((await tx[model].findMany({ where: { id: { in: part.map(r => r.id) } }, select: { id: true } })).map(r => r.id));
    const fresh = part.filter(r => !have.has(r.id));
    if (fresh.length) created += (await tx[model].createMany({ data: fresh })).count;
  }
  return created;
}
/** Notification rows queue an email by trigger; staging never sends them. Same transaction. */
const suppressEmail = tx => tx.$executeRaw`UPDATE "NotificationEmailOutbox" SET status='SUPPRESSED' WHERE status='PENDING'`;
const quiet = fn => db.$transaction(async tx => { const result = await fn(tx); await suppressEmail(tx); return result; }, TX);

// ---------- fictional people ----------
const FIRST = ["Avery", "Jordan", "Maya", "Elias", "Priya", "Noah", "Camila", "Theo", "Zara", "Micah", "Leila", "Owen", "Nadia", "Felix", "Imani", "Caleb", "Sofia", "Desmond", "Hana", "Lucas", "Amara", "Julian", "Tessa", "Rohan", "Elena", "Marcus", "Yuki", "Gabriel", "Naomi", "Silas", "Farah", "Wyatt", "Ines", "Kofi", "Clara", "Dmitri", "Lena", "Mateo", "Juniper", "Ravi"];
const LAST = ["Ashcombe", "Bellweather", "Calloway", "Dunmore", "Everhart", "Fairbanks", "Greywood", "Holloway", "Ivanhoe", "Jessup", "Kingsley", "Larkspur", "Merriweather", "Northcott", "Oakhurst", "Pemberton", "Quillfeather", "Ravenscroft", "Stonebridge", "Thackeray", "Underhill", "Vandermeer", "Whitlock", "Yarborough", "Zeller", "Abernathy", "Blackwood", "Castellan", "Delacroix", "Ellingham", "Featherstone", "Galloway", "Hartwell", "Islington", "Jorgensen", "Kensington", "Lockridge", "Montclair", "Nightingale", "Okonkwo"];
const MAJORS = ["Commerce", "Economics", "Computer Science", "Statistics", "Psychology", "Biology", "Mechanical Engineering", "Systems Engineering", "Public Policy", "English", "Global Studies", "Mathematics", "Media Studies", "Biomedical Engineering", "Political Science", "Cognitive Science", "Data Science", "Environmental Sciences", "Architecture", "Undeclared"];
const BULK = 300;
function bulkStudent(i) {
  const first = FIRST[i % FIRST.length], last = LAST[(i * 7 + Math.floor(i / FIRST.length) * 3) % LAST.length], r = rng(`student:${i}`);
  const n = String(i).padStart(3, "0");
  // 0..119 are upperclass members and leaders; 120..299 are the applicant pool.
  const gradYear = i < 120 ? (i % 2 ? 2027 : 2028) : (i % 3 === 0 ? 2028 : i % 3 === 1 ? 2029 : 2030);
  return {
    id: uid(`user:bulk:${i}`), email: `${first}.${last}.${n}@staging.test`.toLowerCase(),
    profile: { id: uid(`profile:bulk:${i}`), userId: uid(`user:bulk:${i}`), firstName: first, lastName: last, computingId: `stg${n}zz`, major: pick(r, MAJORS), gradYear,
      phone: `+1434555${String(100 + i).padStart(4, "0")}`, gpa: Number((3 + r() * 0.98).toFixed(2)), bio: `Fictional staging profile ${n}. Enjoys ${pick(r, ["trail runs", "film photography", "pickup soccer", "baking", "chess", "open mic nights", "volunteering", "sketching"])} and ${pick(r, ["case competitions", "side projects", "intramurals", "community service", "campus radio", "study groups"])}.` },
  };
}

// ---------- the five sign-in accounts ----------
// Requested as <role>@staging.test, but sign-in is limited to @virginia.edu twice over: the
// auth.users trigger (prisma/setup_auth_trigger.sql) and isUvaEmail (lib/auth.ts).
const ACCOUNTS = [
  { key: "student", requested: "student@staging.test", email: "student.staging@virginia.edu", first: "Sam", last: "Staging-Student", computingId: "stgstudent", major: "Commerce", gradYear: 2029, phone: "+14345550001" },
  { key: "leader", requested: "leader@staging.test", email: "leader.staging@virginia.edu", first: "Lee", last: "Staging-Leader", computingId: "stgleader", major: "Economics", gradYear: 2027, phone: "+14345550002" },
  { key: "interviewer", requested: "interviewer@staging.test", email: "interviewer.staging@virginia.edu", first: "Indra", last: "Staging-Interviewer", computingId: "stginterviewer", major: "Systems Engineering", gradYear: 2028, phone: "+14345550003" },
  { key: "alumni", requested: "alumni@staging.test", email: "alumni.staging@virginia.edu", first: "Alex", last: "Staging-Alumni", computingId: "stgalumni", major: "Commerce", gradYear: 2026, phone: "+14345550004" },
  { key: "admin", requested: "admin@staging.test", email: "admin.staging@virginia.edu", first: "Addison", last: "Staging-Admin", computingId: "stgadmin", major: "Computer Science", gradYear: 2027, phone: "+14345550005" },
];
const supabaseOptions = { auth: { persistSession: false, autoRefreshToken: false } };
async function authUsersByEmail(admin) {
  const found = new Map();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Auth admin list failed: ${error.message}`);
    for (const user of data.users) if (user.email) found.set(user.email.toLowerCase(), user);
    if (data.users.length < 200) break;
  }
  return found;
}
async function ensureAccounts() {
  const admin = createClient(env.supabaseUrl, env.secretKey, supabaseOptions);
  const existing = await authUsersByEmail(admin), result = {};
  for (const account of ACCOUNTS) {
    const password = `${crypto.randomBytes(18).toString("base64url")}aK7!`;
    let user = existing.get(account.email);
    if (user) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (error) throw new Error(`Auth update failed for the ${account.key} account: ${error.message}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true });
      if (error) throw new Error(`Auth create failed for the ${account.key} account: ${error.message}`);
      user = data.user;
    }
    // The auth trigger already wrote the public User row with this id; keep the upsert as a net.
    await db.user.upsert({ where: { id: user.id }, update: {}, create: { id: user.id, email: account.email, role: "STUDENT" } });
    result[account.key] = { ...account, id: user.id, password };
  }
  const lines = [
    "# Staging accounts (LOCAL ONLY, never commit)", "",
    "Supabase project: staging (brrdatmhoagaxmggurki). Written by `node scripts/staging/seed.cjs`;",
    "every run rotates these passwords and rewrites this file. All data is fictional.", "",
    "Sign-in only accepts @virginia.edu, so the requested `<role>@staging.test` names map to:", "",
    "| Role | Requested name | Actual sign-in email | Password |", "| --- | --- | --- | --- |",
    ...ACCOUNTS.map(a => `| ${a.key} | ${a.requested} | ${a.email} | \`${result[a.key].password}\` |`), "",
    `Last written: ${NOW.toISOString()}`, "",
  ];
  fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, lines.join("\n"), { mode: 0o600 });
  return result;
}

// ---------- clubs ----------
const PERMISSIONS = ["club.settings", "members.manage", "meetings.manage", "meetings.attendance", "tasks.manage", "application.manage", "recruitment.manage", "applications.review", "applicants.identify", "interviews.manage", "decisions.vote", "decisions.manage", "decisions.publish", "decisions.view", "decisions.start", "decisions.reopen", "decisions.finish", "leaders.manage"]; // lib/permissions.ts clubPermissions
const STAFF_PERMISSIONS = ["applications.review", "applicants.identify", "decisions.vote"];
// [slug, name, shortName, category, color, stage, tagline, description]
const CLUBS = [
  ["blue-ridge-consulting", "Blue Ridge Consulting Collective", "BRCC", "Consulting", "#1F3A5F", "LEADER", "Student consultants for local founders and nonprofits.", "Blue Ridge Consulting Collective pairs small teams of students with Charlottesville-area founders and nonprofits for semester-long strategy projects. Members learn structured problem solving, client communication and slide craft through real engagements and weekly training."],
  ["lawn-street-capital", "Lawn Street Capital", "LSC", "Finance & Investing", "#14532D", "INTERVIEW", "A student-run long-only equity fund.", "Lawn Street Capital is a fictional student-run investment group. Analysts cover a sector, build models, and pitch one long idea each semester to the full membership. New members complete an eight-week valuation bootcamp."],
  ["rotunda-equity-research", "Rotunda Equity Research Society", "RERS", "Finance & Investing", "#7C2D12", "DECIDED", "Deep-dive company research, published every month.", "Rotunda Equity Research Society writes long-form research notes on public companies and debates them in open sessions. Members rotate between industry pods and learn accounting, valuation and clear writing."],
  ["rivanna-marketing-guild", "Rivanna Marketing Guild", "RMG", "Business", "#9D174D", "REVIEW", "Brand, growth and creative work for campus ventures.", "Rivanna Marketing Guild runs brand and growth sprints for student ventures and local shops. Teams ship campaigns, measure results and present what they learned at a showcase each term."],
  ["piedmont-founders-lab", "Piedmont Founders Lab", "PFL", "Business", "#B45309", "OPEN", "Build something real with other student founders.", "Piedmont Founders Lab is a community for students who are starting things. Weekly build nights, founder dinners and a spring demo day give members structure, feedback and a place to find co-founders."],
  ["corner-code-collective", "Corner Code Collective", "CCC", "Tech & Engineering", "#0B63E5", "INTERVIEW", "Ship software for campus with a team.", "Corner Code Collective builds and maintains software used by student groups. Project teams of five work with a product lead and a designer, and every member ships to production in their first semester."],
  ["albemarle-data-science", "Albemarle Data Science Circle", "ADSC", "Tech & Engineering", "#0E7490", "DECIDED", "Applied data projects with community partners.", "Albemarle Data Science Circle takes on applied analytics projects for community partners and runs workshops on statistics, visualization and machine learning for members at every level."],
  ["emmet-product-lab", "Emmet Street Product Lab", "ESPL", "Tech & Engineering", "#4338CA", "REVIEW", "Product thinking, from interview to launch.", "Emmet Street Product Lab teaches product management by doing it. Members run user interviews, write specs, and launch small products with partner engineering teams."],
  ["thornton-rocketry", "Thornton Rocketry Team", "TRT", "Tech & Engineering", "#B91C1C", "INTERVIEW", "Design, build and fly high-power rockets.", "Thornton Rocketry Team designs and launches high-power rockets for collegiate competitions. Subteams cover propulsion, avionics, structures and recovery; no prior experience is needed."],
  ["rice-hall-cyber", "Rice Hall Cybersecurity Club", "RHCC", "Tech & Engineering", "#111827", "REVIEW", "Capture-the-flag practice and security talks.", "Rice Hall Cybersecurity Club practices for capture-the-flag competitions and hosts hands-on labs on web, binary and network security. Beginners start with a guided track."],
  ["monroe-hill-debate", "Monroe Hill Debate Union", "MHDU", "Academic", "#1E3A8A", "INTERVIEW", "Competitive parliamentary debate.", "Monroe Hill Debate Union competes in parliamentary debate across the region and runs a novice program each fall. Practices focus on argument structure, rebuttal and speaking under time pressure."],
  ["piedmont-policy-forum", "Piedmont Policy Forum", "PPF", "Academic", "#065F46", "REVIEW", "Student policy briefs on state and local issues.", "Piedmont Policy Forum researches and writes policy briefs on state and local questions. Members work in small teams with a faculty reader and present their findings each spring."],
  ["rugby-road-review", "Rugby Road Review", "RRR", "Arts", "#6D28D9", "REVIEW", "A student literary and arts magazine.", "Rugby Road Review publishes fiction, poetry, essays and visual art by students twice a year. Editorial staff read submissions, workshop pieces and design each issue."],
  ["gilmer-biotech", "Gilmer Biotech Society", "GBS", "Academic", "#047857", "INTERVIEW", "Where biology meets industry.", "Gilmer Biotech Society connects students interested in biotechnology through journal clubs, lab tours and a mentored project program with graduate students."],
  ["theta-lambda-psi", "Theta Lambda Psi Business Fraternity", "TLP", "Pre-Professional / Greek", "#7F1D1D", "INTERVIEW", "A co-ed professional fraternity.", "Theta Lambda Psi is a fictional co-ed professional fraternity. Members build career skills together through workshops, mentorship families and service projects."],
  ["fourth-wall-improv", "Fourth Wall Improv Troupe", "FWIT", "Arts", "#C2410C", "DECIDED", "Long-form improv, performed monthly.", "Fourth Wall Improv Troupe performs long-form improv comedy and teaches open workshops. Cast members rehearse twice a week and perform a free show each month."],
  ["premed-shadowing", "Pre-Med Shadowing Network", "PMSN", "Pre-Professional / Greek", "#0F766E", "DECIDED", "Clinical exposure and peer mentoring.", "Pre-Med Shadowing Network matches members with clinical shadowing placements and upperclass mentors, and hosts application workshops throughout the year."],
  ["venture-impact-fellows", "Venture Impact Fellows", "VIF", "Impact & Social Enterprise", "#166534", "DECIDED", "Consulting for mission-driven organizations.", "Venture Impact Fellows supports mission-driven organizations with research, measurement and growth projects. Fellows train together for four weeks before joining a client team."],
  ["moot-court-circle", "Pre-Law Moot Court Circle", "PLMC", "Pre-Professional / Greek", "#374151", "REVIEW", "Appellate advocacy for undergraduates.", "Pre-Law Moot Court Circle prepares undergraduates for appellate advocacy competitions. Members write briefs, practice oral argument and receive feedback from law students."],
  ["women-in-quant", "Women in Quant Finance Circle", "WQFC", "Finance & Investing", "#831843", "OPEN", "Quantitative finance, taught peer to peer.", "Women in Quant Finance Circle runs a peer-taught curriculum in probability, programming and markets, plus mock interviews and small-group mentoring."],
  ["orange-blue-robotics", "Orange & Blue Robotics Workshop", "OBRW", "Tech & Engineering", "#EA580C", "OPEN", "Build robots, compete, teach.", "Orange & Blue Robotics Workshop builds competition robots and runs outreach workshops for local schools. Members choose mechanical, electrical or software tracks."],
  ["shenandoah-sustainability", "Shenandoah Sustainability Alliance", "SSA", "Impact & Social Enterprise", "#15803D", "OPEN", "Campus sustainability projects that ship.", "Shenandoah Sustainability Alliance runs student-led projects on energy, food and waste. Project teams scope an idea, find a campus partner and report results each term."],
  ["charlottesville-tutoring", "Charlottesville Tutoring Corps", "CTC", "Service", "#1D4ED8", "OPEN", "Weekly tutoring in local schools.", "Charlottesville Tutoring Corps places volunteers in weekly tutoring sessions with local elementary and middle school students, with training and transportation provided."],
  ["global-health-collective", "Global Health Collective", "GHC", "Service", "#0369A1", "OPEN", "Learn and act on global health.", "Global Health Collective hosts speakers, runs a reading group and organizes service projects focused on health access at home and abroad."],
  ["south-lawn-photo", "South Lawn Photography Club", "SLPC", "Arts", "#27272A", "OPEN", "Photo walks, critiques and a spring exhibit.", "South Lawn Photography Club organizes photo walks, darkroom nights and critiques. Members exhibit their work in a juried show each spring."],
  ["lambeth-jazz", "Lambeth Jazz Ensemble", "LJE", "Arts", "#92400E", "OPEN", "Small-group jazz, open sessions weekly.", "Lambeth Jazz Ensemble rehearses in small combos and hosts an open session every week. Auditions place musicians into groups by experience."],
  ["dawsons-row-acappella", "Dawson's Row A Cappella", "DRAC", "Arts", "#BE185D", "OPEN", "Contemporary a cappella, all voice parts.", "Dawson's Row A Cappella is a fictional all-voices group that arranges and performs contemporary music. The group records an album every other year and tours over spring break."],
  ["carrs-hill-film", "Carr's Hill Film Society", "CHFS", "Arts", "#3F3F46", "OPEN", "Make short films together.", "Carr's Hill Film Society produces student short films from script to screening. Members join a crew each semester and learn camera, sound and editing on set."],
  ["clemons-writers", "Clemons Writers Workshop", "CWW", "Academic", "#5B21B6", "OPEN", "A weekly workshop for fiction and essays.", "Clemons Writers Workshop meets weekly to read and respond to members' drafts. All genres are welcome, and each term ends with a public reading."],
  ["alderman-language-exchange", "Alderman Language Exchange", "ALE", "Cultural", "#0D9488", "OPEN", "Practice a language with a partner.", "Alderman Language Exchange pairs students for conversation practice in more than a dozen languages and hosts culture nights each month."],
  ["kaleidoscope-showcase", "Kaleidoscope Cultural Showcase", "KCS", "Cultural", "#A21CAF", "OPEN", "A spring showcase of dance, music and food.", "Kaleidoscope Cultural Showcase produces an annual student showcase of dance, music and food from cultural organizations across campus. Committees handle production, outreach and hospitality."],
  ["ragged-mountain-hiking", "Ragged Mountain Hiking Club", "RMHC", "Sports & Recreation", "#3F6212", "NONE", "Weekend hikes for every pace.", "Ragged Mountain Hiking Club leads free weekend hikes in the Blue Ridge for every experience level. Gear lending and carpools are organized by trip leaders."],
  ["scott-stadium-run", "Scott Stadium Run Club", "SSRC", "Sports & Recreation", "#DC2626", "NONE", "Group runs three mornings a week.", "Scott Stadium Run Club meets three mornings a week for group runs at several paces and trains together for a spring half marathon."],
  ["mad-bowl-ultimate", "Mad Bowl Ultimate", "MBU", "Sports & Recreation", "#2563EB", "NONE", "Pickup and club ultimate.", "Mad Bowl Ultimate plays open pickup twice a week and fields club teams for regional tournaments. New players are always welcome."],
  ["nameless-field-volleyball", "Nameless Field Volleyball Club", "NFVC", "Sports & Recreation", "#D97706", "NONE", "Recreational and competitive volleyball.", "Nameless Field Volleyball Club runs open gyms, a recreational league and travel teams. Skills clinics are held at the start of each term."],
  ["slaughter-climbing", "Slaughter Climbing Club", "SCC", "Sports & Recreation", "#57534E", "NONE", "Climb indoors and out.", "Slaughter Climbing Club meets at the indoor wall three nights a week and organizes outdoor trips with trained student leaders."],
  ["old-dorms-chess", "Old Dorms Chess Club", "ODCC", "Social", "#18181B", "NONE", "Casual games and rated tournaments.", "Old Dorms Chess Club plays casual games every week and hosts a rated tournament each month. Lessons for beginners run alongside open play."],
  ["newcomb-board-games", "Newcomb Board Game League", "NBGL", "Social", "#7E22CE", "NONE", "Hundreds of games, one big table.", "Newcomb Board Game League keeps a lending library of several hundred games and hosts two open game nights each week."],
  ["blue-ridge-astronomy", "Blue Ridge Astronomy Club", "BRAC", "Academic", "#1E1B4B", "NONE", "Public observing nights and dark-sky trips.", "Blue Ridge Astronomy Club hosts public observing nights, runs telescope training and organizes dark-sky trips each semester."],
  ["wahoo-culinary", "Wahoo Culinary Society", "WCS", "Social", "#B45309", "NONE", "Cook, eat and learn together.", "Wahoo Culinary Society teaches hands-on cooking classes, hosts potlucks and partners with local chefs for demonstrations."],
].map(([slug, name, shortName, category, color, stage, tagline, description], index) => ({ slug, name, shortName, category, color, stage, tagline, description, index, id: uid(`club:${slug}`) }));
const club = slug => { const found = CLUBS.find(c => c.slug === slug); if (!found) throw new Error(`Unknown club ${slug}`); return found; };
const LEADER_CLUB = club("blue-ridge-consulting");
const RECRUITING = CLUBS.filter(c => c.stage !== "NONE");
const roundId = (c, order) => uid(`round:${c.slug}:${order}`);
const cycleId = c => uid(`cycle:${c.slug}`);
const memberId = (c, userId) => uid(`member:${c.slug}:${userId}`);
const appId = (c, userId) => uid(`app:${c.slug}:${userId}`);
const bulkId = i => uid(`user:bulk:${i}`);

function marketing(c) {
  const r = rng(`marketing:${c.slug}`);
  return {
    sections: [
      { kind: "about", title: "What we do", visible: true, body: c.description, cards: [] },
      { kind: "programs", title: "How members spend their time", visible: true, body: "A mix of project work, training and community.", cards: [
        { title: "Project teams", description: "Small teams with a clear goal and a lead who has done it before.", url: "", image: "" },
        { title: "Training", description: "A structured first semester so new members can contribute quickly.", url: "", image: "" },
        { title: "Community", description: "Dinners, mentorship pairs and an end-of-term celebration.", url: "", image: "" }] },
    ],
    memberCount: 18 + Math.floor(r() * 60), showMembers: true, showAcceptance: true, showAum: false,
    commitment: pick(r, ["About 3 hours a week", "4 to 6 hours a week", "Two meetings a week", "One evening a week"]),
    eligibility: "Open to all undergraduates in any school or year.", dues: pick(r, ["No dues", "$20 per semester", "$35 per year"]),
    benefits: ["Hands-on experience from the first month", "A mentor in your first semester", "A community that shows up for each other"],
    faqs: [{ question: "Do I need experience?", answer: "No. New members are trained together during their first term." }, { question: "How do I join?", answer: c.stage === "NONE" ? "Come to any meeting. There is no application." : "Submit the application on this page, then watch your inbox for next steps." }],
  };
}

const QUESTION_SETS = c => [
  { type: "ESSAY", prompt: `Why do you want to join ${c.name}?`, required: true, wordLimit: 150, options: [] },
  { type: "ESSAY", prompt: "Tell us about a time you worked on a team to get something difficult done. What was your part?", required: true, wordLimit: 400, options: [] },
  { type: "MULTIPLE_CHOICE", prompt: "How many hours a week can you commit this semester?", required: true, wordLimit: null, options: ["1 to 3 hours", "3 to 5 hours", "More than 5 hours"] },
  { type: "MULTI_SELECT", prompt: "Which areas interest you most? Choose any that apply.", required: false, wordLimit: null, options: ["Project work", "Training and workshops", "Events and community", "Leadership"] },
  { type: "FILE_UPLOAD", prompt: "Résumé (optional, PDF)", required: false, wordLimit: null, options: [] },
].map((q, order) => ({ ...q, order, id: uid(`question:${c.slug}:${order}`), clubId: c.id }));
const SHORT_ANSWERS = ["I went to the fall info session and left with a page of notes. The projects are the kind of work I want to learn by doing, and the members I met were generous with their time.", "A friend in the group showed me what her team built last spring. I want to work with people who hold each other to that standard and still have fun doing it.", "I am looking for a place to practice the skills I only read about in class. The training program and the small teams are exactly what I was hoping to find.", "I care about this work and I want to get better at it alongside people who care too. I would bring curiosity, reliability and a lot of energy."];
const LONG_ANSWERS = ["Last spring four of us had ten days to rebuild a class project after our data source disappeared. I took on finding a replacement and rewriting the pipeline while the others reworked the analysis. I set up a short check-in each evening so nobody was blocked overnight, and I wrote down every decision so we could explain it later. We presented on time. What I learned was that being clear about what I owned made it easier for everyone else to move fast.", "In my first year I helped organize a fundraiser for a local food pantry with a team that had never worked together. Two days before the event our venue fell through. I called every space on our list, found a replacement, and then rewrote the volunteer schedule so the change did not cost us any shifts. We raised more than our goal. I learned to stay calm, split a problem into pieces, and ask for help early.", "During a summer job our small team had to migrate a scheduling system in the middle of the busiest month. My part was testing: I wrote the checklist, ran it with two coworkers, and kept a shared list of what broke. It was not glamorous, but it meant the switch happened without a missed appointment. I like being the person a team can rely on for the unexciting part that makes the rest work."];
function answersFor(c, questions, studentKey, draft) {
  const r = rng(`answers:${c.slug}:${studentKey}`), id = appId(c, studentKey), rows = [];
  const add = (q, response) => rows.push({ id: uid(`answer:${id}:${q.id}`), applicationId: id, questionId: q.id, response });
  add(questions[0], pick(r, SHORT_ANSWERS));
  if (draft) return rows;
  add(questions[1], pick(r, LONG_ANSWERS));
  add(questions[2], pick(r, questions[2].options));
  if (r() < 0.7) add(questions[3], JSON.stringify(sample(r, questions[3].options, 1 + Math.floor(r() * 2))));
  return rows;
}

// lib/decision-letters.ts defaultLetters, resolved the same way resolveLetter does.
function letterContent(decision, c, fullName, expiresAt) {
  const long = date => date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const base = { studentName: fullName, clubName: c.name, logoReference: null, accent: c.color, date: long(NOW), footer: "", signer: c.name };
  if (decision === "ACCEPTED") return { ...base, title: `Congratulations, and welcome to ${c.name}`, body: `On behalf of everyone at ${c.name}, it is our great pleasure to offer you membership. Congratulations!\n\nYour application, and the care and thought you brought to every stage of recruitment, stood out to us. We are genuinely excited about the perspective, curiosity, and energy you will bring to our community.\n\nPlease review your offer below and respond by ${expiresAt ? long(expiresAt) : "the deadline shown with your offer"}. We very much hope you will say yes, and we look forward to welcoming you.`, closing: "With warm congratulations,", celebration: "confetti" };
  if (decision === "WAITLISTED") return { ...base, title: "Your recruitment decision", body: `Thank you for your interest in ${c.name} and for the time you devoted to your application.\n\nWe are writing to let you know that you have been placed on our waitlist. We appreciate the opportunity to learn about you. A place on the waitlist does not guarantee a future offer of membership.\n\nIf your decision changes, we will share an update here. Thank you for your patience and continued interest.`, closing: "Sincerely," };
  return { ...base, title: "Your recruitment decision", body: `Thank you for your interest in ${c.name} and for sharing your time and experiences with us.\n\nAfter careful consideration, we are unable to offer you membership through this recruitment process. We recognize the effort that goes into applying and appreciate the opportunity to learn about you.\n\nWe wish you every success in finding communities and opportunities that inspire you.`, closing: "Sincerely," };
}

const WEEKLY_OPEN = { timezone: ZONE, weekly: Array.from({ length: 7 }, () => [[480, 1260]]), weeklySubmitted: true, exceptions: {} }; // 8 AM to 9 PM Eastern
const WEEKLY_PERSONAL = { timezone: ZONE, weekly: [[[600, 720], [900, 1080]], [[780, 1020]], [[600, 720], [900, 1080]], [[780, 1020]], [[600, 900]], [], []], weeklySubmitted: true, exceptions: {} };

// =====================================================================================
async function seed() {
  const accounts = await ensureAccounts();
  const A = Object.fromEntries(Object.entries(accounts).map(([key, value]) => [key, value.id]));
  const summary = {};

  // ----- school, people -----
  await db.school.upsert({ where: { id: "school-uva" }, update: {}, create: { id: "school-uva", key: "uva", name: "University of Virginia" } });
  const bulk = Array.from({ length: BULK }, (_, i) => bulkStudent(i));
  await quiet(async tx => {
    await insertMissing(tx, "user", bulk.map(s => ({ id: s.id, email: s.email, role: "STUDENT", createdAt: new Date(+NOW - (30 + (s.profile.gradYear % 7) * 9) * DAY) })));
    await insertMissing(tx, "studentProfile", bulk.map(s => s.profile));
    // Aug 1, 00:00 Eastern of the graduation year (lib/graduation.ts graduationDefaultAt).
    const graduatedAt = et("2026-08-01", "00:00");
    for (const account of Object.values(accounts)) {
      const alumni = account.key === "alumni";
      const data = { firstName: account.first, lastName: account.last, major: account.major, gradYear: account.gradYear, phone: account.phone, gpa: 3.7,
        bio: "Fictional staging account for mobile testing.", pronouns: "They/Them",
        ...(alumni ? { graduatedAt, graduationConfirmedAt: new Date(+graduatedAt - 40 * DAY), postGradEmployer: "Harborlight Advisory (fictional)", postGradRole: "Analyst" } : {}) };
      await tx.studentProfile.upsert({ where: { userId: account.id }, update: {}, create: { id: uid(`profile:${account.key}`), userId: account.id, computingId: account.computingId, ...data } });
      // Optional email off: these are real-domain addresses and staging must never mail them.
      await tx.userNotificationPreference.upsert({ where: { userId: account.id }, update: {}, create: { userId: account.id, emailAnnouncements: false, emailMessages: false, emailApplications: false, emailInterviews: false, emailInvitations: false, emailTasks: false, emailPlatform: false, emailFrequency: "OFF" } });
      await tx.userAvailability.upsert({ where: { userId: account.id }, update: {}, create: { userId: account.id, schedule: WEEKLY_PERSONAL } });
    }
    const studentProfile = await tx.studentProfile.findUniqueOrThrow({ where: { userId: A.student } });
    await insertMissing(tx, "experience", [
      { id: uid("experience:student:1"), studentProfileId: studentProfile.id, title: "Summer Analyst Intern", subtitle: "Harborlight Advisory (fictional)", period: "Jun 2026 to Aug 2026" },
      { id: uid("experience:student:2"), studentProfileId: studentProfile.id, title: "Peer Tutor, Statistics", subtitle: "Campus Learning Center", period: "Sep 2025 to May 2026" },
    ]);
    await tx.platformAdmin.upsert({ where: { userId: A.admin }, update: {}, create: { userId: A.admin, active: true } });
  });

  // ----- clubs, cycles, rounds, questions, members -----
  const ownerOf = c => c === LEADER_CLUB ? A.leader : bulkId(c.index);
  const staffOf = c => c === LEADER_CLUB ? [A.interviewer, bulkId(40), bulkId(80), bulkId(0)] : [bulkId(40 + c.index), bulkId(80 + c.index)];
  const membersByClub = new Map();
  await quiet(async tx => {
    await insertMissing(tx, "club", CLUBS.map(c => {
      const r = rng(`club:${c.slug}`), selective = ["LEADER", "INTERVIEW", "DECIDED", "REVIEW"].includes(c.stage);
      return { id: c.id, slug: c.slug, name: c.name, shortName: c.shortName, tagline: c.tagline, description: c.description, color: c.color, category: c.category,
        schoolId: "school-uva", campusKey: "uva", isDiscoverable: true, claimedAt: new Date(+NOW - 60 * DAY), marketingApprovedAt: new Date(+NOW - 45 * DAY),
        acceptanceRate: selective ? Math.round(8 + r() * 30) : null, marketing: marketing(c),
        applicationOpen: c.stage === "OPEN" || c.stage === "LEADER", applicationDeadline: null };
    }));
    // Open applications always close 6 to 20 days out, counted from this run.
    for (const c of CLUBS.filter(c => c.stage === "OPEN" || c.stage === "LEADER"))
      await tx.club.update({ where: { id: c.id }, data: { applicationOpen: true, applicationDeadline: et(addDays(TODAY, 6 + (c.index % 15)), "23:59") } });
    await insertMissing(tx, "recruitmentCycle", RECRUITING.map(c => ({ id: cycleId(c), clubId: c.id, name: "Spring 2027 Recruitment", createdAt: new Date(+NOW - 21 * DAY) })));
    await insertMissing(tx, "pipelineRound", RECRUITING.flatMap(c => [
      { id: roundId(c, 0), clubId: c.id, name: "Application Review", type: "APPLICATION_REVIEW", order: 0, configuration: { instructions: "Read both essays before scoring.", duration: 30 } },
      { id: roundId(c, 1), clubId: c.id, name: "Interview", type: "INTERVIEW", order: 1, configuration: { instructions: "One behavioral question, one short case.", duration: 30 },
        interviewKit: [] },
      { id: roundId(c, 2), clubId: c.id, name: "Final Deliberation", type: c === LEADER_CLUB ? "VOTE" : "FINAL_DECISION", order: 2, configuration: { instructions: "", duration: 30 } },
    ]));
    await insertMissing(tx, "applicationQuestion", RECRUITING.flatMap(c => QUESTION_SETS(c)));

    const members = [];
    for (const c of CLUBS) {
      const r = rng(`members:${c.slug}`), owner = ownerOf(c), staff = staffOf(c), taken = new Set([owner, ...staff]);
      const list = [{ userId: owner, isOwner: true, accessRole: "OWNER", role: "PRESIDENT", title: "President", permissions: PERMISSIONS, interviewOffices: ["PRESIDENT"] }];
      staff.forEach((userId, n) => list.push({ userId, accessRole: "INTERVIEWER", role: n === 1 ? "RECRUITMENT_LEAD" : "GENERAL_MEMBER", title: n === 1 ? "VP Recruitment" : null, permissions: STAFF_PERMISSIONS, groups: ["Recruitment committee"] }));
      const general = sample(r, Array.from({ length: 120 }, (_, i) => bulkId(i)).filter(id => !taken.has(id)), c === LEADER_CLUB ? 16 : 6 + Math.floor(r() * 9));
      general.forEach(userId => list.push({ userId, accessRole: "MEMBER", role: "GENERAL_MEMBER", title: null, permissions: [] }));
      if (c === LEADER_CLUB || c.slug === "ragged-mountain-hiking") list.push({ userId: A.student, accessRole: "MEMBER", role: "GENERAL_MEMBER", title: null, permissions: [], cohort: "Fall 2026" });
      // Real alumni mechanism: graduated profile plus alumniSince on each membership (lib/graduation.ts).
      if (c === LEADER_CLUB || c.slug === "rotunda-equity-research") list.push({ userId: A.alumni, accessRole: "MEMBER", role: "GENERAL_MEMBER", title: null, permissions: [], alumniSince: et("2026-08-01", "00:00"), joinedAt: new Date("2023-09-15T16:00:00Z") });
      const rows = list.map((m, n) => ({ id: memberId(c, m.userId), clubId: c.id, joinedAt: new Date(+NOW - (200 - n) * DAY), ...m }));
      membersByClub.set(c.slug, rows); members.push(...rows);
    }
    await insertMissing(tx, "clubMember", members, 200);
  });
  summary.members = [...membersByClub.values()].reduce((n, rows) => n + rows.length, 0);

  // ----- applications -----
  // Applicant pool is bulk 120..299. Interview-stage applicants are disjoint across clubs so no
  // student ever holds two overlapping bookings.
  const applicant = n => bulkId(120 + n);
  const interviewClubs = CLUBS.filter(c => c.stage === "INTERVIEW");
  const plans = new Map(); // slug -> [{ studentId, status, round, decided }]
  const add = (c, studentId, status, round) => { if (!plans.has(c.slug)) plans.set(c.slug, []); plans.get(c.slug).push({ studentId, status, round }); };
  {
    let n = 0; const next = () => applicant(n++);
    for (let i = 0; i < 4; i++) add(LEADER_CLUB, next(), "DRAFTING", 0);
    for (let i = 0; i < 18; i++) add(LEADER_CLUB, next(), "SUBMITTED", 0);
    for (let i = 0; i < 14; i++) add(LEADER_CLUB, next(), "IN_REVIEW", 0);
    for (let i = 0; i < 22; i++) add(LEADER_CLUB, next(), "INTERVIEWING", 1);
    for (let i = 0; i < 8; i++) add(LEADER_CLUB, next(), "IN_REVIEW", 2); // the live vote's candidates
    for (let i = 0; i < 4; i++) add(LEADER_CLUB, next(), "ACCEPTED", 2);
    for (let i = 0; i < 4; i++) add(LEADER_CLUB, next(), "REJECTED", 0);
    for (let i = 0; i < 2; i++) add(LEADER_CLUB, next(), "WAITLISTED", 2);
    // n is 76 here; 76..159 feed the six interview clubs, 14 each.
    for (const c of interviewClubs) for (let i = 0; i < 14; i++) add(c, next(), i < 10 ? "INTERVIEWING" : "REJECTED", i < 10 ? 1 : 0);
  }
  for (const c of RECRUITING.filter(c => c !== LEADER_CLUB)) {
    const r = rng(`apps:${c.slug}`), used = new Set((plans.get(c.slug) || []).map(p => p.studentId));
    const others = sample(r, Array.from({ length: 180 }, (_, i) => applicant(i)).filter(id => !used.has(id)), 20);
    const mix = c.stage === "OPEN" ? [["DRAFTING", 0, 5], ["SUBMITTED", 0, 7]]
      : c.stage === "REVIEW" ? [["SUBMITTED", 0, 8], ["IN_REVIEW", 0, 10]]
      : c.stage === "INTERVIEW" ? [["SUBMITTED", 0, 3], ["IN_REVIEW", 0, 5]]
      : [["ACCEPTED", 2, 6], ["REJECTED", 0, 11], ["WAITLISTED", 2, 3]];
    let at = 0; for (const [status, round, count] of mix) for (let i = 0; i < count; i++) add(c, others[at++], status, round);
  }
  // The student account: one application in each requested state.
  const S = { draft: club("piedmont-founders-lab"), submitted: club("women-in-quant"), bookable: club("lawn-street-capital"), booked: club("corner-code-collective"), accepted: club("rotunda-equity-research"), rejected: club("albemarle-data-science") };
  add(S.draft, A.student, "DRAFTING", 0); add(S.submitted, A.student, "SUBMITTED", 0); add(S.bookable, A.student, "INTERVIEWING", 1);
  add(S.booked, A.student, "INTERVIEWING", 1); add(S.accepted, A.student, "ACCEPTED", 2); add(S.rejected, A.student, "REJECTED", 0);

  const names = new Map(bulk.map(s => [s.id, `${s.profile.firstName} ${s.profile.lastName}`]));
  names.set(A.student, `${accounts.student.first} ${accounts.student.last}`);
  const emails = new Map(bulk.map(s => [s.id, s.email])); emails.set(A.student, accounts.student.email);
  const DECIDED = ["ACCEPTED", "REJECTED", "WAITLISTED"];
  let applicationCount = 0;
  for (const c of RECRUITING) {
    const plan = plans.get(c.slug) || [], questions = QUESTION_SETS(c), staff = staffOf(c).map(userId => memberId(c, userId)), offerExpiry = new Date(+NOW + 21 * DAY);
    applicationCount += plan.length;
    await quiet(async tx => {
      const r = rng(`appdata:${c.slug}`);
      await insertMissing(tx, "application", plan.map(p => ({ id: appId(c, p.studentId), studentId: p.studentId, clubId: c.id, roundId: roundId(c, p.round), status: p.status,
        submittedAt: p.status === "DRAFTING" ? null : new Date(+NOW - (3 + Math.floor(r() * 14)) * DAY - Math.floor(r() * 20) * HOUR),
        recruitmentCycleId: p.status === "DRAFTING" ? null : cycleId(c), decisionVersion: DECIDED.includes(p.status) ? 1 : 0 })));
      await insertMissing(tx, "applicationAnswer", plan.flatMap(p => answersFor(c, questions, p.studentId, p.status === "DRAFTING")));
      // Two reviewers score everything past "submitted". Scores are half points from 1 to 10.
      const scored = plan.filter(p => !["DRAFTING", "SUBMITTED"].includes(p.status));
      await insertMissing(tx, "evaluation", scored.flatMap(p => staff.slice(0, 2).map((interviewerId, n) => {
        const e = rng(`eval:${c.slug}:${p.studentId}:${n}`), lift = p.status === "REJECTED" ? 4 : p.status === "IN_REVIEW" ? 6 : 7;
        return { id: uid(`eval:${appId(c, p.studentId)}:${interviewerId}`), applicationId: appId(c, p.studentId), interviewerId, roundId: roundId(c, 0), round: "Application Review",
          score: Math.min(10, Math.round((lift + e() * 2.5) * 2) / 2), notes: pick(e, ["Clear, specific essays. Strong teamwork example.", "Good motivation; the second essay could be more concrete.", "Thoughtful answers and realistic about time.", "Solid overall. Would like to hear more in an interview."]), submittedAt: new Date(+NOW - 2 * DAY) };
      })));
      // Published decisions: letter, inbox notification and, for acceptances, a pending offer.
      const decided = plan.filter(p => DECIDED.includes(p.status));
      await insertMissing(tx, "clubInvitation", decided.filter(p => p.status === "ACCEPTED").map(p => ({ id: uid(`offer:${appId(c, p.studentId)}`), applicationId: appId(c, p.studentId), clubId: c.id, schoolId: "school-uva",
        email: emails.get(p.studentId), invitedBy: ownerOf(c), requestedRole: "MEMBER", purpose: "MEMBERSHIP", authoritySource: "CLUB_MEMBER", permissions: [], expiresAt: offerExpiry })));
      await insertMissing(tx, "decisionLetter", decided.map(p => ({ id: uid(`letter:${appId(c, p.studentId)}:1`), applicationId: appId(c, p.studentId), clubId: c.id, version: 1, decision: p.status,
        content: letterContent(p.status, c, names.get(p.studentId), p.status === "ACCEPTED" ? offerExpiry : null) })));
      await insertMissing(tx, "userNotification", decided.map(p => ({ id: uid(`notification:decision:${appId(c, p.studentId)}`), userId: p.studentId, clubId: c.id, type: "DECISION", eventKey: `decision:${appId(c, p.studentId)}:1`,
        title: `Your decision from ${c.name} is available`, body: "Open your decision on OutClass.", href: `/applications/${appId(c, p.studentId)}/decision?letterId=${uid(`letter:${appId(c, p.studentId)}:1`)}`,
        createdAt: new Date(+NOW - 26 * HOUR), readAt: p.studentId === A.student && p.status === "REJECTED" ? new Date(+NOW - 20 * HOUR) : null })));
    });
  }
  summary.applications = applicationCount;

  // ----- interview rounds: rooms, published bookable times, bookings, panel grants -----
  const slotTimes = [600, 645, 690, 780, 825, 870, 915, 960]; // 10:00 AM to 4:00 PM starts; 30 min + 15 min buffer
  const interviewInfo = {};
  for (const c of [LEADER_CLUB, ...interviewClubs]) {
    const leader = c === LEADER_CLUB, staff = staffOf(c).map(userId => memberId(c, userId)), round = roundId(c, 1), owner = ownerOf(c);
    const rooms = leader
      ? [{ name: "Room A", location: "Commerce Annex 204", panel: [staff[0], staff[1]] }, { name: "Room B", location: "Commerce Annex 206", panel: [staff[2], staff[3]] }]
      : [{ name: "Interview Room", location: `Student Union ${210 + c.index}`, panel: staff }];
    const days = [];
    for (let n = 1; n <= 19 && days.length < (leader ? 6 : 4); n++) { const day = addDays(TODAY, n); if ((leader ? [2, 3, 4] : [2, 4]).includes(weekday(day)) && n >= (leader ? 1 : 3)) days.push(day); }
    const starts = days.flatMap(day => slotTimes.map(m => et(day, hhmm(m))));
    // Leader club also interviews today, so the interviewer account has panel duty today.
    const today = leader ? Array.from({ length: 17 }, (_, i) => et(TODAY, hhmm(480 + i * 45))).filter(d => +d > +NOW + 20 * MIN) : [];
    await quiet(async tx => {
      await insertMissing(tx, "interviewRoundParticipation", staff.map(id => ({ id: uid(`participation:${id}:${round}`), clubId: c.id, memberId: id, roundId: round, availability: WEEKLY_OPEN, requestedAt: new Date(+NOW - 6 * DAY), confirmedAt: new Date(+NOW - 5 * DAY) })));
      const roomRows = rooms.map(room => ({ id: uid(`room:${c.slug}:${room.name}`), clubId: c.id, roundId: round, name: room.name, location: room.location, kind: "IN_PERSON", timezone: ZONE, duration: 30, buffer: 15, isOpen: true,
        interviewersNeeded: room.panel.length, panelMemberIds: room.panel, approvedPanelMemberIds: room.panel, panelApprovedBy: owner, createdAt: new Date(+NOW - 5 * DAY) }));
      await insertMissing(tx, "interviewRoom", roomRows);
      await insertMissing(tx, "interviewSlot", roomRows.flatMap(room => [...today, ...starts].map(start => ({ id: uid(`slot:${room.id}:${start.toISOString()}`), clubId: c.id, roomId: room.id, startTime: start, endTime: new Date(+start + 30 * MIN), location: room.location, capacity: 1 }))));
      // Publish booking for this cycle with the snapshot the app checks (lib/interview-rooms.ts bookingSlotSnapshot).
      const future = await tx.interviewSlot.findMany({ where: { clubId: c.id, roomId: { in: roomRows.map(r => r.id) }, startTime: { gt: NOW } }, orderBy: { startTime: "asc" }, take: 500 });
      const current = await tx.pipelineRound.findUniqueOrThrow({ where: { id: round } });
      await tx.pipelineRound.update({ where: { id: round }, data: { bookingPublishedAt: current.bookingPublishedAt ?? new Date(+NOW - 3 * DAY), bookingPaused: false, bookingCycleId: cycleId(c), bookingRevision: current.bookingRevision + 1,
        bookingAllowCancellation: true, bookingAllowRescheduling: true, bookingSlots: future.map(s => ({ id: s.id, roomId: s.roomId, startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(), capacity: s.capacity, duration: 30, buffer: 15 })) } });

      // Bookings: bulk interviewees who have none yet take free future times; the student books one too.
      const interviewing = (plans.get(c.slug) || []).filter(p => p.status === "INTERVIEWING");
      const wanted = interviewing.filter((p, n) => p.studentId === A.student ? c === S.booked : leader ? n < 14 : n < 6);
      const booked = new Set((await tx.interviewBooking.findMany({ where: { roundId: round }, select: { applicationId: true } })).map(b => b.applicationId));
      const taken = new Set((await tx.interviewBooking.findMany({ where: { slot: { clubId: c.id } }, select: { slotId: true } })).map(b => b.slotId));
      const free = future.filter(s => !taken.has(s.id));
      // Today's times first for the leader club (alternating rooms), so panel duty today has candidates.
      for (const p of wanted) {
        const application = appId(c, p.studentId); if (booked.has(application)) continue;
        const at = p.studentId === A.student ? free.findIndex(s => +s.startTime > +NOW + 2 * DAY) : 0;
        const [slot] = free.splice(Math.max(at, 0), 1); if (!slot) break;
        const booking = await tx.interviewBooking.create({ data: { id: uid(`booking:${application}:${slot.id}`), slotId: slot.id, applicationId: application, roundId: round } });
        const panel = roomRows.find(r => r.id === slot.roomId).panelMemberIds;
        // Same grants syncBookingPanel writes when an applicant books (utils/interview-scheduling-access.ts).
        await tx.interviewPanelAssignment.createMany({ data: panel.map(member => ({ id: uid(`grant:${application}:${round}:${member}`), applicationId: application, roundId: round, memberId: member, grantedBy: owner, bookingManaged: true, bookingId: booking.id })) });
      }
    });
    interviewInfo[c.slug] = { roundId: round };
  }

  // ----- meetings and campus events -----
  const EVENT_KINDS = [
    { title: c => `${c.name}: Spring Info Session`, category: "Professional", description: "Meet current members, hear what a semester looks like, and ask anything about joining.", time: "18:00", minutes: 60 },
    { title: c => `${c.shortName} Open House`, category: "Social", description: "Drop in, grab a snack and meet the group. No sign-up needed, but an RSVP helps us plan.", time: "17:00", minutes: 90 },
    { title: c => `Workshop Night with ${c.shortName}`, category: "Academic", description: "A hands-on session led by members. Beginners welcome; bring a laptop if you have one.", time: "19:00", minutes: 75 },
  ];
  const CATEGORY_OVERRIDE = { "Sports & Recreation": "Sports", Arts: "Arts", Service: "Service" };
  const VENUES = ["Student Union Ballroom B", "Commerce Annex 120", "Engineering Commons 204", "Library Auditorium", "Arts Grounds Studio 3", "South Lawn Tent", "Recreation Center Court 2", "Science Hall 101"];
  const events = [], publications = [];
  for (const c of CLUBS) {
    const r = rng(`events:${c.slug}`), upcoming = c.stage === "NONE" ? 1 : 2, venue = () => pick(r, VENUES);
    for (let j = 0; j < upcoming + 1; j++) {
      const kind = EVENT_KINDS[(c.index + j) % EVENT_KINDS.length], past = j === upcoming;
      // Anchored to the Monday of this week so a re-run in the same week adds nothing.
      const day = addDays(WEEK, past ? -(1 + ((c.index * 3) % 20)) : 3 + ((c.index * 5 + j * 9) % 28));
      if (!past && day <= TODAY) continue;
      const date = et(day, kind.time), id = uid(`event:${c.slug}:${day}:${j}`);
      events.push({ id, clubId: c.id, title: kind.title(c), date, endDate: new Date(+date + kind.minutes * MIN), location: venue(), description: kind.description, audience: "RECRUITMENT", isPublic: true, past, club: c });
      publications.push({ eventId: id, status: "PUBLISHED", category: CATEGORY_OVERRIDE[c.category] || kind.category, contact: "", rsvpEnabled: true, rsvpRequired: false, capacity: past ? null : 40 + Math.floor(r() * 80),
        template: pick(r, ["academic", "orange", "navy", "sage"]), submittedAt: new Date(+date - 12 * DAY), submittedBy: ownerOf(c), reviewedAt: new Date(+date - 11 * DAY), reviewedBy: A.admin, approvedRevision: 0, publishedAt: new Date(+date - 11 * DAY) });
    }
  }
  // Members-only meetings: the leader club has a full calendar; every third club has two.
  const memberMeetings = [];
  for (const c of CLUBS.filter(c => c === LEADER_CLUB || c.index % 3 === 0)) {
    const offsets = c === LEADER_CLUB ? [-21, -14, -7, 7, 14, 21, 28] : [-7, 14];
    for (const offset of offsets) {
      const day = addDays(WEEK, offset + 2), date = et(day, "19:30");
      memberMeetings.push({ id: uid(`meeting:${c.slug}:${day}`), clubId: c.id, title: c === LEADER_CLUB ? "General Body Meeting" : "Members Meeting", date, endDate: new Date(+date + 60 * MIN), location: c === LEADER_CLUB ? "Commerce Annex 120" : "Student Union 301",
        description: "Weekly members meeting.", audience: "MEMBERS", isPublic: false, agenda: "1. Project updates\n2. Recruitment check-in\n3. Upcoming events\n4. Open floor", past: +date < +NOW, club: c });
    }
  }
  const LIVE_MEETING = uid("meeting:blue-ridge-consulting:live");
  const strip = ({ past: _past, club: _club, ...row }) => row;
  await quiet(async tx => {
    await insertMissing(tx, "meeting", [...events, ...memberMeetings].map(strip));
    const have = new Set((await tx.eventPublication.findMany({ where: { eventId: { in: publications.map(p => p.eventId) } }, select: { eventId: true } })).map(p => p.eventId));
    const fresh = publications.filter(p => !have.has(p.eventId));
    if (fresh.length) await tx.eventPublication.createMany({ data: fresh });
    // The meeting that is happening now: started 15 minutes ago, ends in two hours. Moved on every run.
    const live = { title: "General Body Meeting (happening now)", date: new Date(+NOW - 15 * MIN), endDate: new Date(+NOW + 2 * HOUR), location: "Commerce Annex 120", description: "Staging meeting kept current by the seed so QR check-in can be issued.", audience: "MEMBERS", isPublic: false, agenda: "1. Welcome\n2. Client project updates\n3. Recruitment: final deliberation tonight\n4. Announcements" };
    await tx.meeting.upsert({ where: { id: LIVE_MEETING }, update: { date: live.date, endDate: live.endDate }, create: { id: LIVE_MEETING, clubId: LEADER_CLUB.id, ...live } });

    // RSVPs (future published events only; the database refuses anything else) and saved events.
    const rsvps = [];
    for (const event of events.filter(e => !e.past && +e.date > +NOW + HOUR)) {
      const r = rng(`rsvp:${event.id}`);
      for (const userId of sample(r, bulk.map(s => s.id), 6 + Math.floor(r() * 28))) rsvps.push({ eventId: event.id, userId, createdAt: new Date(+NOW - Math.floor(r() * 6 * DAY)) });
    }
    const upcomingPublic = events.filter(e => !e.past && +e.date > +NOW + HOUR).sort((a, b) => +a.date - +b.date);
    for (const event of upcomingPublic.filter((_, n) => [1, 4, 9].includes(n))) rsvps.push({ eventId: event.id, userId: A.student, createdAt: new Date(+NOW - DAY) });
    const haveRsvp = new Set((await tx.eventRsvp.findMany({ where: { eventId: { in: [...new Set(rsvps.map(r => r.eventId))] } }, select: { eventId: true, userId: true } })).map(r => `${r.eventId}:${r.userId}`));
    const newRsvps = rsvps.filter(r => !haveRsvp.has(`${r.eventId}:${r.userId}`));
    for (const part of chunk(newRsvps, 300)) await tx.eventRsvp.createMany({ data: part });
    await tx.savedCampusEvent.createMany({ data: upcomingPublic.filter((_, n) => [0, 4, 7].includes(n)).map(e => ({ userId: A.student, eventId: e.id })), skipDuplicates: true });

    // Attendance for past events and meetings, and a few early check-ins at the live meeting.
    const attendance = [];
    const attend = (eventId, studentId, checkedInAt) => attendance.push({ id: uid(`attendance:${eventId}:${studentId}`), eventId, studentId, checkedInAt });
    for (const event of events.filter(e => e.past)) { const r = rng(`attend:${event.id}`); for (const userId of sample(r, bulk.map(s => s.id), 8 + Math.floor(r() * 22))) attend(event.id, userId, new Date(+event.date + Math.floor(r() * 20) * MIN)); }
    for (const meeting of memberMeetings.filter(m => m.past)) {
      const r = rng(`attend:${meeting.id}`), roster = membersByClub.get(meeting.club.slug).filter(m => !m.alumniSince).map(m => m.userId);
      for (const userId of sample(r, roster, Math.ceil(roster.length * 0.7))) attend(meeting.id, userId, new Date(+meeting.date + Math.floor(r() * 12) * MIN));
    }
    const pastPublic = events.filter(e => e.past);
    attend(pastPublic[0].id, A.student, new Date(+pastPublic[0].date + 4 * MIN)); attend(pastPublic[1].id, A.alumni, new Date(+pastPublic[1].date + 6 * MIN));
    const leaderPast = memberMeetings.filter(m => m.past && m.club === LEADER_CLUB);
    if (leaderPast[0]) { attend(leaderPast[0].id, A.student, new Date(+leaderPast[0].date + 3 * MIN)); attend(leaderPast[0].id, A.interviewer, new Date(+leaderPast[0].date + 2 * MIN)); }
    // The student and interviewer are deliberately NOT checked in to the live meeting.
    membersByClub.get(LEADER_CLUB.slug).filter(m => !m.alumniSince && ![A.student, A.interviewer, A.leader].includes(m.userId)).slice(0, 8).forEach((m, n) => attend(LIVE_MEETING, m.userId, new Date(+NOW - (12 - n) * MIN)));
    await insertMissing(tx, "eventAttendance", attendance);
  });
  summary.events = events.length; summary.memberMeetings = memberMeetings.length + 1;

  // ----- live voting room (current model: mode LIVE, open electorate), ready for the leader to start -----
  const VOTING_SESSION = uid("voting:blue-ridge-consulting:spring-2027-final");
  await quiet(async tx => {
    if (await tx.votingSession.findUnique({ where: { id: VOTING_SESSION } })) return;
    const candidates = (plans.get(LEADER_CLUB.slug)).filter(p => p.round === 2 && p.status === "IN_REVIEW");
    const fields = ["name", "major", "academicYear"]; // lib/voting-room.ts liveRoomFields
    // Mirrors actions/voting-room.ts createLiveVotingRoom.
    await tx.votingSession.create({ data: { id: VOTING_SESSION, mode: "LIVE", clubId: LEADER_CLUB.id, cycleId: cycleId(LEADER_CLUB), roundId: roundId(LEADER_CLUB, 2), leaderMemberIds: [memberId(LEADER_CLUB, A.leader)],
      targetSize: 5, targetUnset: false, presentationOptions: { fields, highlights: {}, electorate: "OPEN" }, displayConfig: { version: 1, fields }, autoAdvance: "NONE", createdBy: A.leader,
      candidates: { create: candidates.map((p, position) => ({ applicationId: appId(LEADER_CLUB, p.studentId), position, expectedStatus: p.status })) } } });
    await tx.votingRoomCommand.create({ data: { sessionId: VOTING_SESSION, requestId: VOTING_SESSION, actorId: A.leader, fingerprint: crypto.createHash("sha256").update(VOTING_SESSION).digest("hex"), result: { sessionId: VOTING_SESSION } } });
    await tx.auditLog.create({ data: { id: uid(`audit:voting:${VOTING_SESSION}`), actorId: A.leader, clubId: LEADER_CLUB.id, targetId: VOTING_SESSION, action: "voting.room.created", details: { cycleId: cycleId(LEADER_CLUB), roundId: roundId(LEADER_CLUB, 2), candidateCount: candidates.length, electorate: "OPEN", notified: 0, targetSize: 5, source: "staging-seed" } } });
  });

  // ----- tasks, announcements and the student's inbox -----
  const studentMember = memberId(LEADER_CLUB, A.student);
  const TASKS = [
    { key: "onboarding", title: "Complete new member onboarding", description: "Read the member handbook and add your headshot to the roster.", status: "OPEN", due: 5, student: {} },
    { key: "client-research", title: "Client research brief: Rivanna Roasters (fictional)", description: "One page on the client's market, three competitors, and two questions you would ask in the kickoff.", status: "IN_PROGRESS", due: 9, student: { viewedAt: new Date(+NOW - 2 * DAY) } },
    { key: "case-practice", title: "Submit a practice case write-up", description: "Pick any case from the shared folder and submit a one-page structure.", status: "IN_PROGRESS", due: 2, student: { viewedAt: new Date(+NOW - 4 * DAY), submittedAt: new Date(+NOW - DAY), text: "Structure attached below: market size, unit economics, then two growth options with risks." } },
    { key: "retro", title: "Fall project retrospective", description: "Three things that worked and one thing to change next term.", status: "DONE", due: -6, student: { viewedAt: new Date(+NOW - 12 * DAY), submittedAt: new Date(+NOW - 8 * DAY), reviewedAt: new Date(+NOW - 6 * DAY), reviewedBy: A.leader, text: "Worked: weekly client check-ins, shared notes, early draft review. Change: start slides a week sooner.", feedback: "Thoughtful and specific. Thank you." } },
  ];
  const ANNOUNCEMENTS = [
    { key: "welcome", title: "Welcome to the spring semester", body: "Our first general body meeting is this week. Bring a friend who is curious about consulting.", hours: 190 },
    { key: "projects", title: "Spring client projects are posted", body: "Five client projects are open for ranking. Submit your preferences by Friday.", hours: 70 },
    { key: "deliberation", title: "Final deliberation tonight", body: "Members who review applications: the live vote opens after tonight's meeting. Please be on time.", hours: 5 },
  ];
  await quiet(async tx => {
    const audience = { everyone: true, match: "ANY", excludeMembers: [], excludeGroups: [], excludeTasks: [], random: null, members: [], groups: [], cohorts: [], academicYears: [], years: [], roles: [] };
    await insertMissing(tx, "clubTask", TASKS.map(t => ({ id: uid(`task:${t.key}`), clubId: LEADER_CLUB.id, title: t.title, description: t.description, status: t.status, kind: "TASK", audience, dueAt: et(addDays(TODAY, t.due), "17:00"), createdAt: new Date(+NOW - 14 * DAY) })));
    const others = membersByClub.get(LEADER_CLUB.slug).filter(m => m.accessRole === "MEMBER" && !m.alumniSince && m.userId !== A.student).slice(0, 6);
    await insertMissing(tx, "taskAssignment", TASKS.flatMap(t => [
      { id: uid(`assignment:${t.key}:student`), taskId: uid(`task:${t.key}`), memberId: studentMember, userId: A.student, assignedAt: new Date(+NOW - 13 * DAY), ...t.student },
      ...others.map(m => ({ id: uid(`assignment:${t.key}:${m.id}`), taskId: uid(`task:${t.key}`), memberId: m.id, userId: m.userId, assignedAt: new Date(+NOW - 13 * DAY) })),
    ]));
    await insertMissing(tx, "clubAnnouncement", ANNOUNCEMENTS.map(a => ({ id: uid(`announcement:${a.key}`), clubId: LEADER_CLUB.id, authorId: A.leader, title: a.title, body: a.body, audience: "MEMBERS", requestKey: uid(`announcement-key:${a.key}`), createdAt: new Date(+NOW - a.hours * HOUR), publishedAt: new Date(+NOW - a.hours * HOUR) })));

    const bookRound = c => `/interviews/book?clubId=${c.id}&roundId=${roundId(c, 1)}`;
    const inbox = [
      ...ANNOUNCEMENTS.map((a, n) => ({ key: `announcement:${a.key}`, type: "ANNOUNCEMENT", club: LEADER_CLUB, announcementId: uid(`announcement:${a.key}`), title: a.title, body: a.body, href: "/inbox", hours: a.hours, read: n === 0 })),
      { key: "interview-open", type: "INTERVIEW", club: S.bookable, title: "Interview times are open", body: `${S.bookable.name} has opened interview booking. Choose a time that works for you.`, href: bookRound(S.bookable), hours: 20, read: false },
      { key: "interview-reminder", type: "INTERVIEW", club: S.booked, title: "Interview reminder", body: `Your interview with ${S.booked.name} is coming up. Open your application for the time and room.`, href: bookRound(S.booked), hours: 9, read: false },
      { key: "application-received", type: "APPLICATION", club: S.submitted, title: "Application received", body: `${S.submitted.name} received your application. You will hear about next steps here.`, href: "/applications", hours: 96, read: true },
      { key: "draft-reminder", type: "APPLICATION", club: S.draft, title: "Finish your application", body: `Your application to ${S.draft.name} is still a draft. Applications close soon.`, href: "/applications", hours: 30, read: false },
      { key: "offer-reminder", type: "INVITATION", club: S.accepted, title: "Your offer is waiting", body: `${S.accepted.name} offered you membership. Review and respond before the offer expires.`, href: `/applications/${appId(S.accepted, A.student)}/decision?letterId=${uid(`letter:${appId(S.accepted, A.student)}:1`)}`, hours: 12, read: false },
      { key: "task-due", type: "TASK", club: LEADER_CLUB, title: "Due soon: Submit a practice case write-up", body: "Open your task for instructions and feedback.", href: `/club/${LEADER_CLUB.id}/workspace?section=tasks&taskView=mine&taskId=${uid("task:case-practice")}`, hours: 40, read: true },
      { key: "task-reviewed", type: "TASK", club: LEADER_CLUB, title: "Submission reviewed: Fall project retrospective", body: "Open your task for instructions and feedback.", href: `/club/${LEADER_CLUB.id}/workspace?section=tasks&taskView=mine&taskId=${uid("task:retro")}`, hours: 144, read: true },
      { key: "hiking-trip", type: "ANNOUNCEMENT", club: club("ragged-mountain-hiking"), title: "Saturday hike: Humpback Rocks", body: "Carpools leave at 8:00 AM from the main lot. Bring water and layers.", href: "/inbox", hours: 50, read: true },
      { key: "meeting-today", type: "ANNOUNCEMENT", club: LEADER_CLUB, title: "General body meeting is starting", body: "Check in with the QR code on the screen when you arrive.", href: "/inbox", hours: 0.2, read: false },
      { key: "platform-welcome", type: "PLATFORM", club: null, title: "Welcome to OutClass", body: "Your profile is complete. Explore clubs, save the ones you like, and apply when you are ready.", href: "/explore", hours: 400, read: true },
      { key: "platform-calendar", type: "PLATFORM", club: null, title: "Add your calendar feed", body: "Subscribe once and your meetings, interviews and events stay in your calendar.", href: "/settings", hours: 220, read: false },
    ];
    await insertMissing(tx, "userNotification", inbox.map(n => ({ id: uid(`notification:student:${n.key}`), userId: A.student, clubId: n.club?.id ?? null, announcementId: n.announcementId ?? null, eventKey: `staging-seed:${n.key}`, type: n.type, title: n.title, body: n.body, href: n.href,
      createdAt: new Date(+NOW - n.hours * HOUR), readAt: n.read ? new Date(+NOW - Math.max(0, n.hours - 2) * HOUR) : null })));
    // Every other current member also receives the three club announcements.
    const audienceMembers = membersByClub.get(LEADER_CLUB.slug).filter(m => !m.alumniSince && m.userId !== A.student);
    await insertMissing(tx, "userNotification", ANNOUNCEMENTS.flatMap(a => audienceMembers.map(m => ({ id: uid(`notification:${m.userId}:announcement:${a.key}`), userId: m.userId, clubId: LEADER_CLUB.id, announcementId: uid(`announcement:${a.key}`), eventKey: `staging-seed:announcement:${a.key}`, type: "ANNOUNCEMENT", title: a.title, body: a.body, href: "/inbox", createdAt: new Date(+NOW - a.hours * HOUR) }))));
    // Saved clubs (the Corkboard club list) for the student.
    await tx.corkboardClub.createMany({ data: ["lawn-street-capital", "piedmont-founders-lab", "thornton-rocketry", "dawsons-row-acappella"].map((slug, n) => ({ userId: A.student, clubId: club(slug).id, savedAt: new Date(+NOW - (n + 1) * DAY) })), skipDuplicates: true });
  });

  await suppressEmail(db);
  console.log(`Seed complete. Clubs ${CLUBS.length}, bulk students ${BULK}, memberships ${summary.members}, applications ${summary.applications}, public events ${summary.events}, member meetings ${summary.memberMeetings}.`);
  console.log(`Accounts written to docs/mobile/STAGING_ACCOUNTS.local.md (passwords are not printed).`);
}

// =====================================================================================
/** Runs the app's own bookability rule (utils/interview-booking.ts) against the seeded rows. */
function appLoader() {
  const ts = require("typescript"), cache = new Map();
  const mocks = { "server-only": {}, "@/utils/prisma": {}, "next/cache": { revalidatePath() {}, revalidateTag() {}, unstable_cache: fn => fn } };
  function load(file) {
    file = path.resolve(env.root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const source = fs.existsSync(file) ? file : file.replace(/\.ts$/, ".tsx");
    const code = ts.transpileModule(fs.readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name] : name.startsWith("@/") ? load(`${name.slice(2)}.ts`) : name.startsWith(".") ? load(`${path.resolve(path.dirname(file), name)}.ts`) : require(name), mod, mod.exports);
    return mod.exports;
  }
  return load;
}

async function verify() {
  const users = Object.fromEntries((await db.user.findMany({ where: { email: { in: ACCOUNTS.map(a => a.email) } }, select: { id: true, email: true } })).map(u => [ACCOUNTS.find(a => a.email === u.email).key, u.id]));
  const tables = ["school", "club", "user", "studentProfile", "clubMember", "recruitmentCycle", "pipelineRound", "applicationQuestion", "application", "applicationAnswer", "evaluation", "interviewRoom", "interviewSlot", "interviewBooking", "interviewPanelAssignment", "interviewRoundParticipation", "decisionLetter", "clubInvitation", "meeting", "eventPublication", "eventRsvp", "eventAttendance", "savedCampusEvent", "corkboardClub", "votingSession", "votingCandidate", "votingParticipant", "clubTask", "taskAssignment", "clubAnnouncement", "userNotification", "notificationEmailOutbox", "platformAdmin", "userAvailability", "auditLog"];
  console.log("== Row counts ==");
  for (const table of tables) console.log(`${table.padEnd(30)} ${await db[table].count()}`);
  const byStatus = await db.application.groupBy({ by: ["status"], _count: true });
  console.log(`applications by status         ${byStatus.map(s => `${s.status}=${s._count}`).join(" ")}`);
  console.log(`email outbox still PENDING     ${await db.notificationEmailOutbox.count({ where: { status: "PENDING" } })}`);
  console.log(`discoverable clubs             ${await db.club.count({ where: { isDiscoverable: true, suspendedAt: null } })}`);
  console.log(`published upcoming events      ${await db.meeting.count({ where: { audience: "RECRUITMENT", isPublic: true, publication: { is: { status: "PUBLISHED" } }, endDate: { gt: new Date() } } })}`);

  console.log("\n== Key records ==");
  console.log(`leader club                    ${LEADER_CLUB.id} (${LEADER_CLUB.slug})`);
  console.log(`  cycle                        ${cycleId(LEADER_CLUB)}`);
  console.log(`  rounds review/interview/vote ${roundId(LEADER_CLUB, 0)} / ${roundId(LEADER_CLUB, 1)} / ${roundId(LEADER_CLUB, 2)}`);
  console.log(`  applications (non-draft)     ${await db.application.count({ where: { clubId: LEADER_CLUB.id, status: { not: "DRAFTING" } } })}`);
  const live = await db.meeting.findUnique({ where: { id: uid("meeting:blue-ridge-consulting:live") }, select: { id: true, date: true, endDate: true, audience: true } });
  console.log(`  live meeting                 ${live?.id} ${live ? `(${live.audience}; started ${Math.round((Date.now() - +live.date) / MIN)} min ago, ends in ${Math.round((+live.endDate - Date.now()) / MIN)} min)` : "MISSING"}`);
  const session = await db.votingSession.findUnique({ where: { id: uid("voting:blue-ridge-consulting:spring-2027-final") }, select: { id: true, state: true, mode: true, _count: { select: { candidates: true } } } });
  console.log(`  voting session               ${session?.id} ${session ? `(${session.mode}, ${session.state}, ${session._count.candidates} candidates)` : "MISSING"}`);
  for (const key of Object.keys(users)) {
    const memberships = await db.clubMember.findMany({ where: { userId: users[key] }, select: { id: true, clubId: true, isOwner: true, accessRole: true, permissions: true, alumniSince: true, club: { select: { slug: true } } } });
    console.log(`${key.padEnd(12)} user ${users[key]}`);
    for (const m of memberships) console.log(`  member of ${m.club.slug} club=${m.clubId} member=${m.id} role=${m.accessRole}${m.isOwner ? " owner" : ""}${m.alumniSince ? " alumni" : ""} permissions=${m.permissions.length}`);
  }
  console.log(`admin PlatformAdmin active     ${!!(await db.platformAdmin.findUnique({ where: { userId: users.admin || "" } }))?.active}`);
  const alumni = users.alumni ? await db.studentProfile.findUnique({ where: { userId: users.alumni }, select: { graduatedAt: true, gradYear: true } }) : null;
  console.log(`alumni graduatedAt set         ${!!alumni?.graduatedAt} (class of ${alumni?.gradYear})`);
  if (users.student) {
    const apps = await db.application.findMany({ where: { studentId: users.student }, select: { id: true, status: true, roundId: true, clubId: true, club: { select: { slug: true } }, bookings: { select: { id: true, slot: { select: { startTime: true } } } }, recruitmentOffer: { select: { status: true } }, decisionLetters: { select: { id: true } } }, orderBy: { status: "asc" } });
    console.log("student applications:");
    for (const a of apps) console.log(`  ${a.status.padEnd(13)} ${a.id} club=${a.club.slug} (${a.clubId}) round=${a.roundId}${a.bookings.length ? ` booking=${a.bookings[0].id} at ${a.bookings[0].slot.startTime.toISOString()}` : ""}${a.recruitmentOffer ? ` offer=${a.recruitmentOffer.status}` : ""}${a.decisionLetters.length ? ` letter=${a.decisionLetters[0].id}` : ""}`);
    console.log(`student inbox                  ${await db.userNotification.count({ where: { userId: users.student, archivedAt: null } })} notifications, ${await db.userNotification.count({ where: { userId: users.student, archivedAt: null, readAt: null } })} unread`);
    console.log(`student tasks / saved clubs    ${await db.taskAssignment.count({ where: { userId: users.student } })} / ${await db.corkboardClub.count({ where: { userId: users.student } })}`);
    // Bookability, judged by the app's own coverage rule.
    try {
      const load = appLoader(), { interviewBookingCoverage } = load("utils/interview-booking.ts"), { isPublishedBookingSlot } = load("lib/interview-rooms.ts");
      for (const a of apps.filter(a => a.status === "INTERVIEWING")) {
        const count = await db.$transaction(async tx => {
          const coverage = await interviewBookingCoverage(tx, a.clubId, a.roundId, { id: a.id, studentId: users.student });
          const round = await tx.pipelineRound.findUniqueOrThrow({ where: { id: a.roundId } });
          const slots = await tx.interviewSlot.findMany({ where: { id: { in: coverage.filter(s => s.bookable).map(s => s.slotId) } }, include: { room: true, _count: { select: { bookings: true } } } });
          return { total: coverage.length, open: slots.filter(s => isPublishedBookingSlot(round.bookingSlots, s, s.room) && s._count.bookings < s.capacity).length, published: !!round.bookingPublishedAt && !round.bookingPaused, reasons: [...new Set(coverage.filter(s => !s.bookable).flatMap(s => s.reasons))].slice(0, 3) };
        }, TX);
        console.log(`  bookable check ${a.club.slug}: published=${count.published} future sessions=${count.total} open and bookable for the student=${count.open}${count.reasons.length ? ` blockers=${JSON.stringify(count.reasons)}` : ""}`);
      }
      const duty = await db.interviewSlot.count({ where: { room: { clubId: LEADER_CLUB.id, approvedPanelMemberIds: { has: memberId(LEADER_CLUB, users.interviewer) } }, startTime: { gte: et(TODAY, "00:00"), lt: et(addDays(TODAY, 1), "00:00") } } });
      const dutyBooked = await db.interviewPanelAssignment.count({ where: { memberId: memberId(LEADER_CLUB, users.interviewer), revokedAt: null, booking: { slot: { startTime: { gte: et(TODAY, "00:00"), lt: et(addDays(TODAY, 1), "00:00") } } } } });
      console.log(`interviewer panel duty today   ${duty} sessions, ${dutyBooked} with a booked candidate`);
    } catch (error) { console.log(`  bookable check could not run: ${scrub(error.message).slice(0, 300)}`); }
  }

  console.log("\n== Sign-in (publishable key, password grant) ==");
  if (!env.publishableKey) console.log("publishable key is not set; sign-in check skipped");
  else if (!fs.existsSync(ACCOUNTS_FILE)) console.log("accounts file is missing; run the seed first");
  else {
    const text = fs.readFileSync(ACCOUNTS_FILE, "utf8");
    for (const account of ACCOUNTS) {
      const row = text.split("\n").find(line => line.startsWith(`| ${account.key} |`)), password = row?.match(/`([^`]+)`/)?.[1];
      if (!password) { console.log(`${account.key.padEnd(12)} ${account.email}: no password on file`); continue; }
      const client = createClient(env.supabaseUrl, env.publishableKey, supabaseOptions);
      const { data, error } = await client.auth.signInWithPassword({ email: account.email, password });
      console.log(`${account.key.padEnd(12)} ${account.email}: ${error || !data.session ? `FAILED (${error?.status ?? ""} ${error?.code ?? "no session"})` : "success"}`);
      if (data?.session) await client.auth.signOut();
    }
  }
}

(VERIFY ? verify() : seed())
  .catch(error => { console.error(`Seed failed: ${scrub(error && (error.stack || error.message))}`); process.exitCode = 1; })
  .finally(() => db.$disconnect());

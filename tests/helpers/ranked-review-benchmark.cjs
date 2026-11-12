const {unwrapActions}=require('./action-result.cjs');
// Synthetic, in-memory benchmark harness for the Ranked review read. No database,
// no .env, no network: a mocked Prisma client returns fictional rows shaped exactly
// by the select/include/omit each query asks for, so the bytes it "fetches" are a
// faithful proxy for what PostgreSQL would send and Prisma would hydrate.
"use strict";
const fs = require("node:fs"), ts = require("typescript");

function load(file, mocks = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} }; cache.set(file, m);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(n => n in mocks ? mocks[n] : n.startsWith("@/") ? load(n.slice(2) + ".ts", mocks, cache) : require(n), m, m.exports);
  return m.exports;
}

const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clubId = uuid("00000000", 1), roundId = uuid("00000000", 2), otherRoundId = uuid("00000000", 3), cycleId = uuid("00000000", 4);
const viewer = { id: uuid("10000000", 1), userId: uuid("20000000", 1), status: "ACTIVE", isOwner: false, permissions: ["applicants.identify", "applications.review"], interviewOffices: ["PRESIDENT"] };
const interviewers = Array.from({ length: 5 }, (_, i) => ({ id: uuid("30000000", i + 1), userId: uuid("40000000", i + 1), clubId, status: "ACTIVE", isOwner: false, permissions: ["applicants.identify", "applications.review"], interviewOffices: [], title: "Member", joinedAt: new Date(0), createdAt: new Date(0) }));
const round = { id: roundId, clubId, name: "Interview", order: 1, type: "INTERVIEW", anonymousReview: false, applicantDisplay: { version: 1, fields: ["name"] }, archivedAt: null, configuration: { instructions: "Synthetic kit ".repeat(20) }, createdAt: new Date(0) };
const prose = n => "Synthetic answer text about a fictional applicant's interests and experience. ".repeat(n);
const relations = new Set(["round", "student", "studentProfile", "experiences", "evaluations", "interviewAssignments", "member", "answers", "question", "bookings", "slot", "recruitmentOffer"]);

/** Full fictional application rows (every column and relation) for `size` applicants, `scored` submitted evaluations each. */
function syntheticApplications(size, scored = 4, { anonymousReview = false, club = clubId, inRound = roundId, archivedAt = null, idPrefix = "5" } = {}) {
  const shownRound = { ...round, id: inRound, clubId: club, anonymousReview, archivedAt };
  return Array.from({ length: size }, (_, i) => {
    const id = uuid(idPrefix + "0000000", i + 1), studentId = uuid("60000000", i + 1);
    const status = ["INTERVIEWING", "IN_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED"][i % 5]; // decided applicants stay in the list
    const evaluations = interviewers.slice(0, scored + 1).map((m, j) => ({ id: uuid("70000000", i * 10 + j), applicationId: id, interviewerId: m.id, roundId, score: 1 + ((i * 7 + j * 3) % 19) / 2, submittedAt: j < scored ? new Date(1e12 + i) : null, createdAt: new Date(1e12 + j), updatedAt: new Date(1e12 + j), notes: prose(6), applicantQuestions: prose(2), criteria: { communication: 4, leadership: 3 } }));
    return { id, clubId: club, roundId: i % 20 === 19 ? otherRoundId : inRound, studentId, status, recruitmentCycleId: cycleId, submittedAt: new Date(1e12), createdAt: new Date(1e12), updatedAt: new Date(1e12), decisionVersion: 1, decisionStateRevision: 1, anonymousReviewText: null,
      round: shownRound, recruitmentOffer: status === "ACCEPTED" ? { status: "PENDING", expiresAt: new Date(2e12) } : null,
      student: { id: studentId, email: `applicant${i}@example.test`, role: "STUDENT", createdAt: new Date(0), disabledAt: null,
        studentProfile: { id: uuid("80000000", i + 1), userId: studentId, firstName: `Synthetic${i}`, lastName: "Applicant", computingId: `syn${i}`, major: "Fictional Studies", gradYear: 2028, gpa: 3.5, satScore: 1400, actScore: null, actEnglish: null, actMath: null, actReading: null, actScience: null, highSchool: "Example High", gender: null, pronouns: null, transferStudent: false, scholarStatus: null, linkedinUrl: null, bio: prose(4), resumeUrl: null, headshotUrl: i % 3 ? null : `${studentId}/headshot.png`,
          experiences: Array.from({ length: 3 }, (_, k) => ({ id: uuid("90000000", i * 10 + k), studentProfileId: uuid("80000000", i + 1), title: "Fictional role", subtitle: "Example org", period: "2025" })) } },
      evaluations,
      interviewAssignments: interviewers.slice(0, scored).map((m, j) => ({ id: uuid("a0000000", i * 10 + j), applicationId: id, memberId: m.id, roundId, revokedAt: null, createdAt: new Date(0), member: m })),
      answers: Array.from({ length: 8 }, (_, k) => ({ id: uuid("b0000000", i * 10 + k), applicationId: id, questionId: uuid("c0000000", k), value: prose(3), question: { id: uuid("c0000000", k), clubId, label: `Question ${k}`, type: "LONG_TEXT", order: k, required: true, options: null } })),
      bookings: [{ id: uuid("d0000000", i), applicationId: id, slotId: uuid("e0000000", i), createdAt: new Date(0), slot: { id: uuid("e0000000", i), roundId, startTime: new Date(2e12), endTime: new Date(2e12 + 18e5), location: "Fictional Hall" } }],
    };
  });
}

const whereMatches = (row, where) => !where || Object.entries(where).every(([k, v]) => v === null ? row[k] == null : v && typeof v === "object" && "not" in v ? (v.not === null ? row[k] != null : row[k] !== v.not) : row[k] === v);
function shapeRelation(value, args) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.filter(r => whereMatches(r, args === true ? null : args.where)).map(r => shape(r, args === true ? {} : args));
  return shape(value, args === true ? {} : args);
}
/** Prisma select/include/omit semantics over a full row. */
function shape(row, args = {}) {
  const out = {};
  if (args.select) { for (const [k, v] of Object.entries(args.select)) if (v) out[k] = relations.has(k) ? shapeRelation(row[k], v) : row[k]; return out; }
  for (const [k, v] of Object.entries(row)) if (!relations.has(k) && !(args.omit && args.omit[k])) out[k] = v;
  for (const [k, v] of Object.entries(args.include || {})) if (v) out[k] = shapeRelation(row[k], v);
  return out;
}

function harness(rows, { member = viewer, memberships = { [clubId]: member }, suspended = [] } = {}) {
  const stats = { authCalls: [], fetched: [], applicationQueries: 0, queries: 0, fetchedBytes() { return this.fetched.reduce((n, r) => n + JSON.stringify(r).length, 0); } };
  const permissions = load("lib/permissions.ts");
  const tx = {
    $queryRaw: async () => { stats.queries++; return []; },
    applicantRecusal: { findMany: async () => [], findFirst: async () => null },
    pipelineRound: { findMany: async ({ where }) => { stats.queries++; const found = new Map(rows.filter(r => r.round.clubId === where.clubId).map(r => [r.round.id, r.round])); if (where.clubId === clubId && !found.size) found.set(round.id, round); return [...found.values()]; }, findFirst: async () => { stats.queries++; return { id: roundId, configuration: round.configuration, anonymousReview: false }; } },
    recruitmentCycle: { findMany: async () => { stats.queries++; return [{ id: cycleId, name: "Fall" }]; } },
    application: { findMany: async args => {
      stats.queries++; stats.applicationQueries++;
      const where = args.where || {};
      const result = rows.filter(r => r.clubId === where.clubId && (!where.roundId || r.roundId === where.roundId) && (!where.round || r.round.anonymousReview === where.round.anonymousReview) && r.status !== "DRAFTING").map(r => shape(r, args));
      stats.fetched.push(result); // sized after timing, so measuring never inflates the timed read
      return result;
    } },
  };
  const auth = { requireClubPermission: async (club, required, options) => {
    stats.authCalls.push({ club, required, options });
    const m = memberships[club];
    if (!m || required.some(p => !permissions.hasPermission(m, p))) throw Error("Denied");
    if (suspended.includes(club) && !options?.allowSuspendedRead) throw Error("Club suspended");
    return { user: { id: m.userId }, membership: m };
  } };
  const mocks = { "@/utils/auth": auth, "@/utils/prisma": { prisma: { $transaction: async fn => fn(tx) } }, "next/cache": { revalidatePath() {}, revalidateTag() {} } };
  return { stats, crm: unwrapActions(load("actions/crm.ts", mocks)), ranked: load("lib/ranked-review.ts"), read: load("lib/ranked-review-read.ts") };
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function time(fn, runs = 5) { const samples = []; let result; for (let i = 0; i < runs; i++) { const t = performance.now(); result = await fn(); samples.push(performance.now() - t); } return { ms: median(samples), result }; }

module.exports = { load, harness, syntheticApplications, time, median, clubId, roundId, cycleId, viewer, interviewers, uuid };

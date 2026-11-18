// Live authorization matrix for the mobile API, against a local web server on staging data.
// Proves the API adds no access of its own: every operation answers exactly as its action decides
// for the student, an outsider to the club (interviewer of another... see below), alumni and no session.
// Run: node scripts/staging/api-authz.cjs [baseUrl]. Prints operation names, expected and actual status only.
"use strict";
const { signIn } = require("./accounts.cjs");
const base = process.argv[2] || "http://localhost:3000";

const LEADER_CLUB = "253d3ff8-35eb-4619-81bf-c7c195bbf4fe";      // blue-ridge-consulting
const LIVE_MEETING = "52fd84d2-ca4e-439c-b794-03ca91eca68b";
const VOTING_SESSION = "e89ed370-6e82-4b3d-a454-091e0b109207";
const OTHER_CLUB = "ee739f70-7a96-4368-a8c6-f4a3bda352b1";       // lawn-street-capital: none of the test accounts leads it
const STUDENT_DRAFT = "27933a5a-c44f-4416-aa03-f667be79bc23";
const STUDENT_OFFER = "84f4f4dc-3fdd-44ea-8331-0524ccad446f";
const STUDENT_LETTER = "37972775-3e1b-4faa-8295-6f46f4b1d8fe";
const STUDENT_BOOKABLE = "16e1fc5c-795e-484d-8826-973721f6996c";

async function call(token, name, input, method = "GET", headers = {}) {
  const url = new URL(`/api/mobile/v1/${name}`, base);
  if (method === "GET" && input !== undefined) url.searchParams.set("input", JSON.stringify(input));
  const response = await fetch(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(method === "POST" ? { "Content-Type": "application/json" } : {}), ...headers }, body: method === "POST" ? JSON.stringify(input ?? null) : undefined });
  let body = null; try { body = await response.json(); } catch { /* not json */ }
  return { status: response.status, code: body?.error?.code ?? null, data: body?.data };
}

(async () => {
  const [student, leader, interviewer, alumni] = await Promise.all(["student", "leader", "interviewer", "alumni"].map(signIn));
  const rows = []; let failed = 0;
  const check = (label, operation, expected, actual) => { const ok = expected === actual; if (!ok) failed++; rows.push({ check: label, operation, expected, actual, code: "", ok: ok ? "ok" : "FAIL" }); };
  const expect = async (label, who, name, input, method, allowed, extraHeaders) => {
    const result = await call(who?.token ?? null, name, input, method, extraHeaders);
    const ok = (Array.isArray(allowed) ? allowed : [allowed]).includes(result.status);
    if (!ok) failed++;
    rows.push({ check: label, operation: name, expected: String(allowed), actual: result.status, code: result.code ?? "", ok: ok ? "ok" : "FAIL" });
    return result;
  };

  // 1. No session, a forged token, and browser-only modes never reach an action.
  for (const name of ["me", "home.view", "applications", "inbox", "profile", "meetings", "clubs.saved"]) await expect("signed out", null, name, undefined, "GET", 401);
  await expect("forged token", { token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln" }, "me", undefined, "GET", 401);
  await expect("another project's style token", { token: student.token.split(".").slice(0, 2).join(".") + ".AAAA" }, "me", undefined, "GET", 401);
  await expect("demo cookie refused", student, "me", undefined, "GET", 403, { Cookie: "outclass-demo-session=1" });
  await expect("public read without a session", null, "explore.directory", undefined, "GET", 200);
  await expect("signed-out write", null, "clubs.save", { clubId: OTHER_CLUB, saved: true }, "POST", 401);

  // 2. Cross-user: one student's records are invisible to another account.
  for (const who of [interviewer, alumni, leader]) {
    const label = who === interviewer ? "cross-user (interviewer)" : who === alumni ? "cross-user (alumni)" : "cross-user (leader of another club)";
    await expect(label, who, "interviews.schedule", { applicationId: STUDENT_BOOKABLE }, "GET", [403, 404, 422]);
    // The letter query is scoped to the caller's own applications, so another account gets "no letter" (null), never the letter.
    const letter = await expect(label, who, "decisions.letter", { applicationId: STUDENT_LETTER }, "GET", 200);
    check(`${label}: no letter content`, "decisions.letter", "null", letter.data === null ? "null" : "DATA");
    await expect(label, who, "offers.respond", { applicationId: STUDENT_OFFER, response: "ACCEPT" }, "POST", [403, 404, 422]);
  }
  const mine = await expect("own applications", student, "applications", undefined, "GET", 200);
  const theirs = await expect("own applications (interviewer)", interviewer, "applications", undefined, "GET", 200);
  const leak = Array.isArray(theirs.data) && theirs.data.some(row => row.id === STUDENT_DRAFT);
  rows.push({ check: "another account's list never includes the student's draft", operation: "applications", expected: "absent", actual: leak ? "PRESENT" : "absent", code: "", ok: leak ? "FAIL" : "ok" }); if (leak) failed++;
  void mine;

  // 3. Club capability: leader tools need the club's permission; a plain member and an outsider are refused.
  const leaderOps = [["leader.overview", { clubId: LEADER_CLUB }, "GET"], ["leader.pipelinePage", { clubId: LEADER_CLUB }, "GET"], ["leader.rounds", { clubId: LEADER_CLUB }, "GET"], ["meetings.attendance", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING }, "GET"], ["meetings.checkIn.issue", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING }, "POST"], ["leader.announcements", { clubId: LEADER_CLUB }, "GET"]];
  for (const [name, input, method] of leaderOps) {
    if (name === "leader.overview") {
      // Any member may open their club's home; the recruiting parts are simply empty without the permission.
      for (const [label, who] of [["member without the permission", student]]) {
        const overview = await expect(label, who, name, { ...input, view: "recruiting" }, method, 200);
        const ops = overview.data?.operations ?? {};
        check(`${label}: no recruiting data`, name, "empty", [ops.rounds, ops.queue, ops.cycles, ops.bookings, ops.votes, ops.offers].every(list => Array.isArray(list) && !list.length) && overview.data?.recruitment == null ? "empty" : "DATA");
      }
      await expect("alumni (read-only)", alumni, name, input, method, [200, 403]);
    } else {
      await expect("member without the permission", student, name, input, method, [403, 422]);
      await expect("alumni (read-only)", alumni, name, input, method, [403, 422]);
    }
    await expect("leader of the club", leader, name, input, method, 200);
    await expect("leader, in a club they do not lead", leader, name, { ...input, clubId: OTHER_CLUB }, method, [403, 404]);
  }
  await expect("member cannot announce", student, "leader.announce", { clubId: LEADER_CLUB, title: "x", body: "y", audience: "MEMBERS", requestKey: "00000000-0000-4000-8000-000000000001" }, "POST", [403, 400, 422]);
  await expect("member cannot run the vote", student, "voting.command", { clubId: LEADER_CLUB, sessionId: VOTING_SESSION, action: "START" }, "POST", [403, 400, 422]);
  await expect("member cannot read the voting room", student, "voting.room", { clubId: LEADER_CLUB, sessionId: VOTING_SESSION }, "GET", [403, 404]);
  await expect("door scan needs meetings.attendance", student, "checkInPass.scan", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING, payload: "OCP1." + "ab".repeat(32) }, "POST", 403);
  await expect("door scan in a club the leader does not lead", leader, "checkInPass.scan", { clubId: OTHER_CLUB, meetingId: LIVE_MEETING, payload: "OCP1." + "ab".repeat(32) }, "POST", 403);
  await expect("door scan: meeting must belong to the club", leader, "checkInPass.scan", { clubId: LEADER_CLUB, meetingId: "00000000-0000-4000-8000-000000000000", payload: "OCP1." + "ab".repeat(32) }, "POST", 404);
  await expect("door scan: a made-up pass", leader, "checkInPass.scan", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING, payload: "OCP1." + "ab".repeat(32) }, "POST", 422);
  await expect("door scan: a /q link is not a pass", leader, "checkInPass.scan", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING, payload: "https://out-class.net/q/abcdef" }, "POST", 422);

  // 4. Alumni are read-only: every write the web refuses is refused here with the same code.
  await expect("alumni cannot get a pass", alumni, "checkInPass.issue", undefined, "POST", 403);
  await expect("alumni cannot save a club", alumni, "clubs.save", { clubId: OTHER_CLUB, saved: true }, "POST", [403, 422]);
  // startClubApplication answers a refusal as data ({ applicationId: null, unavailable }), as the web shows it.
  const started = await expect("alumni cannot start an application", alumni, "applications.start", { clubId: OTHER_CLUB }, "POST", [200, 403, 422]);
  if (started.status === 200) check("alumni: no application was created", "applications.start", "refused", started.data?.applicationId == null && typeof started.data?.unavailable === "string" ? "refused" : "CREATED");
  await expect("alumni cannot check in", alumni, "meetings.checkIn", { meetingId: LIVE_MEETING, token: "ab".repeat(32) }, "POST", [403, 422]);
  await expect("alumni can still read their inbox", alumni, "inbox", undefined, "GET", 200);

  // 5. Door mode end to end, and idempotency: a pass is single use, attendance is recorded once.
  const pass = await expect("student gets a pass", student, "checkInPass.issue", undefined, "POST", 200);
  const payload = pass.data?.payload;
  const first = await expect("leader scans it", leader, "checkInPass.scan", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING, payload }, "POST", 200);
  rows.push({ check: "scan outcome", operation: "checkInPass.scan", expected: "checked-in|already-checked-in", actual: first.data?.status ?? "none", code: "", ok: ["checked-in", "already-checked-in"].includes(first.data?.status) ? "ok" : "FAIL" });
  await expect("the same pass again is spent", leader, "checkInPass.scan", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING, payload }, "POST", 422);
  const pass2 = await call(student.token, "checkInPass.issue", undefined, "POST");
  const second = await call(leader.token, "checkInPass.scan", { clubId: LEADER_CLUB, meetingId: LIVE_MEETING, payload: pass2.data?.payload }, "POST");
  rows.push({ check: "a second pass for the same student does not double-count", operation: "checkInPass.scan", expected: "already-checked-in", actual: second.data?.status ?? second.status, code: "", ok: second.data?.status === "already-checked-in" ? "ok" : "FAIL" }); if (second.data?.status !== "already-checked-in") failed++;

  // 6. Input bounds and method rules at the boundary.
  await expect("oversized input", student, "inbox.read", { ids: Array.from({ length: 5000 }, () => "00000000-0000-4000-8000-000000000000"), read: true }, "POST", 400);
  await expect("malformed input", student, "interviews.reserve", { applicationId: "nope", slotId: "nope" }, "POST", 400);
  await expect("write sent as a read", student, "clubs.save", { clubId: OTHER_CLUB, saved: true }, "GET", 405);

  console.table(rows);
  console.log(`${rows.length} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error.message); process.exit(1); });

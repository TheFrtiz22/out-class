// Pre-launch attacker pass against the disposable local stack started by
// scripts/run-onboarding-e2e.cjs --club-integration (local Supabase Auth/Postgres/Storage/Mailpit
// and a production Next build on 127.0.0.1). Skipped without that runner's config.
//
// Accounts: student A, student B, leader L (owner of club X) and leader M (owner of club Y).
// Every probe is an unauthorized request; each must be denied and no seeded A/X value may
// appear in any response body. A JSON summary (case, result, notes) is written to
// test-results/attacker-pass.json even when a case fails.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const { Actor, readConfig, randomUUID } = require("./helpers/onboarding-e2e.cjs");
const { assertLocalTarget, markerList, findLeaks, metaRedirect, isOffOrigin, classify, shape, prismaTables, middlewareSetsCsp, rateLimitModule, AttackerSummary } = require("./helpers/attacker-pass.cjs");

const filename = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
const repo = path.resolve(__dirname, "..");
const output = path.join(repo, "test-results/attacker-pass.json");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("attacker pass: IDOR, logout replay, public-key access, headers, enumeration, redirects, rate limits and uploads", { skip: !filename, timeout: 600000 }, async t => {
  // Safety first: the runner's config must point at loopback services only. Nothing else is read.
  const c = readConfig(filename);
  assertLocalTarget(c.appUrl, "app URL");
  assertLocalTarget(c.status.API_URL, "Supabase URL");
  assertLocalTarget(c.status.DB_URL, "database URL");
  const summary = new AttackerSummary();
  t.after(() => summary.write(output));
  const db = new PrismaClient({ datasourceUrl: c.status.DB_URL });
  t.after(() => db.$disconnect());
  const service = createClient(c.status.API_URL, c.status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const API = c.status.API_URL.replace(/\/$/, ""), appOrigin = new URL(c.appUrl).origin;
  const publicKeys = [["publishable", { apikey: c.status.PUBLISHABLE_KEY }]];
  if (c.status.ANON_KEY) publicKeys.push(["legacy anon JWT", { apikey: c.status.ANON_KEY, authorization: `Bearer ${c.status.ANON_KEY}` }]);
  const q = (kind, args) => `/api/workspace?kind=${kind}&args=${encodeURIComponent(JSON.stringify(args))}`;

  // ---------- Seed (disposable stack only) ----------
  const seed = {};
  await summary.run("seed", async notes => {
    async function account(label) {
      const email = `attack.${label}.${randomUUID()}@virginia.edu`, password = "Disposable-attack!" + randomUUID();
      const lastName = `Probe${randomUUID().replaceAll("-", "").slice(0, 12)}`, computingId = `atk${label}${randomUUID().replaceAll("-", "").slice(0, 10)}`;
      const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null, `Local fixture account ${label}`);
      const id = created.data.user.id;
      await db.user.create({ data: { id, email, studentProfile: { create: { firstName: `Attacker${label.toUpperCase()}`, lastName, computingId, major: "Economics", gradYear: 2028 } } } });
      const actor = new Actor(c); await actor.signIn(email, password);
      return { id, email, password, lastName, computingId, actor };
    }
    for (const label of ["a", "b", "l", "m"]) seed[label] = await account(label);
    const { a: A, l: L, m: M } = seed;
    const suffix = randomUUID().slice(0, 8);
    seed.templateMarker = "PRIVATE-TEMPLATE-" + randomUUID();
    const club = (name, extra = {}) => db.club.create({ data: { slug: `attacker-${name}-${suffix}`, name: `Attacker ${name} ${suffix}`, tagline: "Disposable attacker pass", description: "Disposable organization for the attacker pass.", color: "#142d45", category: "Academic", claimedAt: new Date(), ...extra } });
    seed.x = await club("x", { decisionLetterTemplates: { ACCEPTED: { title: "Internal draft", body: seed.templateMarker, closing: "", signer: "", footer: "" } } });
    seed.y = await club("y");
    await db.clubMember.create({ data: { clubId: seed.x.id, userId: L.id, isOwner: true, accessRole: "OWNER" } });
    await db.clubMember.create({ data: { clubId: seed.y.id, userId: M.id, isOwner: true, accessRole: "OWNER" } });
    seed.round = await db.pipelineRound.create({ data: { clubId: seed.x.id, name: "Application Review", type: "APPLICATION_REVIEW", order: 0 } });
    seed.yRound = await db.pipelineRound.create({ data: { clubId: seed.y.id, name: "Application Review", type: "APPLICATION_REVIEW", order: 0 } });
    seed.application = await db.application.create({ data: { studentId: A.id, clubId: seed.x.id, roundId: seed.round.id, status: "SUBMITTED", submittedAt: new Date() } });
    // Private files in real (local) Storage, so a broken check would return bytes rather than a 404.
    seed.headshot = `${A.id}/${randomUUID()}.png`; seed.resume = `${A.id}/${randomUUID()}.pdf`;
    for (const [bucket, objectPath, bytes, type] of [["headshots", seed.headshot, PNG, "image/png"], ["resumes", seed.resume, PDF, "application/pdf"]]) {
      const { error } = await service.storage.from(bucket).upload(objectPath, bytes, { contentType: type, upsert: false });
      if (error) notes.push(`Storage seed for ${bucket} failed (${error.message}); route probes still run.`);
    }
    await db.studentProfile.update({ where: { userId: A.id }, data: { headshotUrl: seed.headshot, resumeUrl: seed.resume } });
    seed.calendarToken = randomBytes(32).toString("base64url");
    await db.calendarFeedToken.create({ data: { userId: A.id, tokenHash: createHash("sha256").update(seed.calendarToken, "utf8").digest("hex") } });
    // Optional richer seeds: a failure is noted, not fatal, so the other probes still run.
    seed.noteMarker = "PRIVATE-NOTE-" + randomUUID();
    try { await db.applicantObservation.create({ data: { applicationId: seed.application.id, authorId: L.id, kind: "PRO", body: seed.noteMarker, anonymousReview: false, clubId: seed.x.id, roundId: seed.round.id } }); }
    catch (error) { notes.push(`Applicant note seed skipped: ${error.message.split("\n").pop()}`); }
    try { seed.voting = await db.votingSession.create({ data: { clubId: seed.x.id, roundId: seed.round.id, targetSize: 1, createdBy: L.id } }); }
    catch (error) { notes.push(`Voting session seed skipped: ${error.message.split("\n").pop()}`); }
    seed.markers = markerList([
      ["A user id", A.id], ["A email", A.email], ["A last name", A.lastName], ["A computing id", A.computingId],
      ["A resume path", seed.resume], ["A headshot path", seed.headshot], ["A application id", seed.application.id],
      ["A calendar token", seed.calendarToken], ["X private template", seed.templateMarker], ["X applicant note", seed.noteMarker],
      ["X round id", seed.round.id], ["X voting session id", seed.voting?.id], ["L email", L.email], ["L last name", L.lastName],
    ]);
    notes.push(`Seeded 4 accounts, clubs X and Y, ${seed.markers.length} private markers.`);
  });
  const { a: A, b: B, l: L, m: M } = seed, X = seed.x, Y = seed.y, appId = seed.application.id;

  // ---------- Probe helpers ----------
  async function probe(rows, actor, label, url, { method = "GET", headers = {}, body, shell = false, selfScoped = false } = {}) {
    const response = actor ? await actor.request(url, { method, headers, body }) : await fetch(new URL(url, c.appUrl), { method, headers, body, redirect: "manual" });
    const bytes = Buffer.from(await response.arrayBuffer()), text = bytes.toString("utf8");
    const verdict = classify(response.status, { location: response.headers.get("location"), body: text, appUrl: c.appUrl });
    const leaks = findLeaks(bytes, seed.markers, [url, typeof body === "string" ? body : ""]);
    const row = { label, status: response.status, verdict, leaks, shell, selfScoped };
    rows.push(row);
    return { ...row, response, text };
  }
  async function actionProbe(rows, actor, label, file, name, args) {
    let row;
    try {
      const result = await actor.action(file, name, args);
      const leaks = findLeaks(JSON.stringify(result ?? null), seed.markers, [JSON.stringify(args)]);
      row = { label, status: "returned", verdict: result == null ? "denied" : "allowed", leaks };
    } catch (error) {
      // A missing action is a broken probe, not a denial.
      if (error?.code === "ERR_ASSERTION") throw error;
      row = { label, status: "rejected", verdict: "denied", leaks: [] };
    }
    rows.push(row);
    return row;
  }
  // Denied or (shell/self-scoped page) answered without data; never a leak, server error or off-origin redirect.
  function judge(rows, notes) {
    const failures = rows.filter(row => row.leaks.length || row.verdict === "error" ||
      (row.verdict === "allowed" && !row.shell && !row.selfScoped));
    const invalid = rows.filter(row => row.verdict === "invalid");
    notes.push(`${rows.length} probes: ${rows.filter(r => r.verdict === "denied").length} denied, ${rows.filter(r => r.verdict === "allowed" && (r.shell || r.selfScoped) && !r.leaks.length).length} shell/self-scoped without data, ${invalid.length} malformed, ${failures.length} failed.`);
    for (const row of invalid) notes.push(`Inconclusive (HTTP ${row.status}, probe rejected as malformed): ${row.label}`);
    for (const row of failures) notes.push(`FAILED ${row.label}: ${row.status} ${row.verdict}${row.leaks.length ? `, leaked ${row.leaks.join(", ")}` : ""}`);
    assert.equal(failures.length, 0, `Unauthorized requests were not denied or leaked data: ${failures.map(r => r.label).join("; ")}`);
    return invalid.length ? "partial" : undefined;
  }

  // ---------- 1. IDOR ----------
  await t.test("IDOR: student B cannot read student A's applications, résumé, headshot or attachments", async () => {
    await summary.run("idor-student-b-vs-a", async notes => {
      // Positive controls: A's own reads work, so the denials below are authorization, not breakage.
      const own = await probe([], A.actor, "A own student dashboard", q("studentDashboard", []));
      assert.equal(own.status, 200, "A can read A's own dashboard");
      const ownResume = await probe([], A.actor, "A own résumé", `/api/resumes?path=${encodeURIComponent(seed.resume)}`);
      notes.push(`Control: A's own résumé route answered ${ownResume.status} (${ownResume.verdict}).`);
      const rows = [];
      for (const [kind, args] of [["applicantDisplay", [{ clubId: X.id, applicationId: appId }]], ["attendance", [X.id, appId]], ["pipelinePage", [X.id]], ["pipeline", [X.id, { applicationId: appId }]], ["members", [X.id]], ["overview", [X.id]]])
        await probe(rows, B.actor, `B workspace ${kind} on X/A`, q(kind, args));
      for (const kind of ["studentDashboard", "notifications", "taskNotifications", "myAvailability"])
        await probe(rows, B.actor, `B workspace ${kind} (own scope)`, q(kind, []), { selfScoped: true });
      await probe(rows, B.actor, "B page A's decision letter", `/applications/${appId}/decision`, { shell: true });
      await probe(rows, B.actor, "B page applications status", "/applications/status", { selfScoped: true });
      await actionProbe(rows, B.actor, "B action getDecisionLetter(A app)", "actions/communications.ts", "getDecisionLetter", [appId]);
      await actionProbe(rows, B.actor, "B action getEvaluations(X, A app)", "actions/evaluations.ts", "getEvaluations", [X.id, appId]);
      await probe(rows, B.actor, "B /api/resumes A path", `/api/resumes?path=${encodeURIComponent(seed.resume)}`);
      await probe(rows, B.actor, "B /api/profile-photos A path", `/api/profile-photos?path=${encodeURIComponent(seed.headshot)}`);
      for (const mode of ["crm", "evaluation", "preview"])
        await probe(rows, B.actor, `B /api/profile-photos A path scoped to X (${mode})`, `/api/profile-photos?path=${encodeURIComponent(seed.headshot)}&clubId=${X.id}&applicationId=${appId}&mode=${mode}`);
      await probe(rows, B.actor, "B /api/recruiting-resumes X/A", `/api/recruiting-resumes?clubId=${X.id}&applicationId=${appId}`);
      await probe(rows, B.actor, "B /api/application-attachments A app", `/api/application-attachments?applicationId=${appId}&questionId=${randomUUID()}`);
      await probe(rows, B.actor, "B /api/interview-resumes X/A", `/api/interview-resumes?clubId=${X.id}&applicationId=${appId}&roundId=${seed.round.id}&documentId=${randomUUID()}`);
      return judge(rows, notes);
    });
  });

  await t.test("IDOR: leader M of club Y cannot read club X's applicants, notes, exports or voting", async () => {
    await summary.run("idor-leader-m-vs-club-x", async notes => {
      const controls = [];
      for (const [label, url] of [["L workspace members", q("members", [X.id])], ["L workspace pipelinePage", q("pipelinePage", [X.id])], ["L applicants export", `/api/club-exports?clubId=${X.id}&kind=applicants`]]) {
        const control = await probe(controls, L.actor, label, url);
        // Members is the asserted control; the others are recorded, since their output depends on recruiting setup.
        if (label === "L workspace members") assert.equal(control.status, 200, `Control: X's leader can use ${label}`);
        notes.push(`Control: ${label} ${control.status}${control.leaks.length ? ` (contains ${control.leaks.join(", ")})` : ""}.`);
      }
      const rows = [];
      const kinds = [["overview", [X.id]], ["members", [X.id]], ["pipeline", [X.id]], ["pipelinePage", [X.id]], ["pipelineSelection", [X.id]], ["rounds", [X.id]],
        ["applicationSettings", [X.id]], ["pipelineSettings", [X.id]], ["announcements", [X.id]], ["tasks", [X.id]], ["interviewWorkspace", [X.id]], ["interviewRounds", [X.id]],
        ["applicantDisplay", [{ clubId: X.id, applicationId: appId }]], ["attendance", [X.id, appId]], ["rankedReviewRound", [X.id, seed.round.id]],
        ["rankedReviewSettings", [X.id, seed.round.id]], ["dashboardReviews", [X.id, seed.round.id]], ["voting", seed.voting ? [X.id, seed.voting.id] : [X.id]]];
      for (const [kind, args] of kinds) await probe(rows, M.actor, `M workspace ${kind} on X`, q(kind, args));
      // Cross-club binding: M's own club id with X's application or session.
      await probe(rows, M.actor, "M workspace applicantDisplay Y + A app", q("applicantDisplay", [{ clubId: Y.id, applicationId: appId }]));
      await probe(rows, M.actor, "M workspace attendance Y + A app", q("attendance", [Y.id, appId]));
      if (seed.voting) {
        // M may read its own club Y; the X session id must not resolve. The leak scan skips
        // markers that appear in the request, so check for X's session explicitly.
        const row = await probe(rows, M.actor, "M workspace voting Y + X session", q("voting", [Y.id, seed.voting.id]), { selfScoped: true });
        if (row.verdict === "allowed" && row.text.includes(seed.voting.id)) rows[rows.length - 1].leaks.push("X voting session id in Y workspace");
      }
      for (const kind of ["applicants", "roster", "attendance", "rsvps"]) await probe(rows, M.actor, `M /api/club-exports ${kind} on X`, `/api/club-exports?clubId=${X.id}&kind=${kind}`);
      await probe(rows, M.actor, "M /api/club-exports applicants X round", `/api/club-exports?clubId=${X.id}&kind=applicants&roundId=${seed.round.id}`);
      await probe(rows, M.actor, "M /api/recruiting-resumes X/A", `/api/recruiting-resumes?clubId=${X.id}&applicationId=${appId}`);
      await probe(rows, M.actor, "M /api/recruiting-resumes Y + A app", `/api/recruiting-resumes?clubId=${Y.id}&applicationId=${appId}`);
      await probe(rows, M.actor, "M /api/profile-photos A path via Y crm", `/api/profile-photos?path=${encodeURIComponent(seed.headshot)}&clubId=${Y.id}&applicationId=${appId}&mode=crm`);
      await probe(rows, M.actor, "M /api/profile-photos A path via X crm", `/api/profile-photos?path=${encodeURIComponent(seed.headshot)}&clubId=${X.id}&applicationId=${appId}&mode=crm`);
      await probe(rows, M.actor, "M /api/interview-resumes X/A", `/api/interview-resumes?clubId=${X.id}&applicationId=${appId}&roundId=${seed.round.id}&documentId=${randomUUID()}`);
      await probe(rows, M.actor, "M page X workspace", `/club/${X.id}/workspace`, { shell: true });
      if (seed.voting) await probe(rows, M.actor, "M page X voting history", `/voting/rooms/${seed.voting.id}/history?clubId=${X.id}`, { shell: true });
      await actionProbe(rows, M.actor, "M action getEvaluations(X, A app)", "actions/evaluations.ts", "getEvaluations", [X.id, appId]);
      await actionProbe(rows, M.actor, "M action getDecisionTemplates(X)", "actions/communications.ts", "getDecisionTemplates", [X.id]);
      await actionProbe(rows, M.actor, "M action getApplicantDisplayConfiguration(X)", "actions/applicant-intelligence.ts", "getApplicantDisplayConfiguration", [X.id, seed.round.id]);
      if (seed.voting) for (const clubId of [X.id, Y.id]) {
        await actionProbe(rows, M.actor, `M action getLiveVotingRoom(${clubId === X.id ? "X" : "Y"}, X session)`, "actions/voting-room.ts", "getLiveVotingRoom", [{ clubId, sessionId: seed.voting.id }]);
        await actionProbe(rows, M.actor, `M action getLiveVotingSummary(${clubId === X.id ? "X" : "Y"}, X session)`, "actions/voting-room-finalization.ts", "getLiveVotingSummary", [{ clubId, sessionId: seed.voting.id }]);
      }
      if (!seed.voting) notes.push("Voting session seed unavailable: voting probes ran without a session id.");
      return judge(rows, notes);
    });
  });

  await t.test("IDOR: random calendar-feed tokens get 404", async () => {
    await summary.run("idor-calendar-feed", async notes => {
      const real = await fetch(new URL(`/api/calendar-feed/${seed.calendarToken}`, c.appUrl), { redirect: "manual" });
      await real.arrayBuffer();
      assert.equal(real.status, 200, "Control: A's real feed token works");
      const rows = [];
      for (let n = 0; n < 8; n++) await probe(rows, null, `random token ${n}`, `/api/calendar-feed/${randomBytes(32).toString("base64url")}`);
      await probe(rows, null, "random token .ics", `/api/calendar-feed/${randomBytes(32).toString("base64url")}.ics`);
      await probe(rows, null, "real token with one character changed", `/api/calendar-feed/${seed.calendarToken.slice(0, -1)}${seed.calendarToken.endsWith("A") ? "B" : "A"}`);
      for (const bad of ["short", "x".repeat(44)]) await probe(rows, null, `malformed token ${bad.slice(0, 8)}`, `/api/calendar-feed/${bad}`);
      const not404 = rows.filter(row => row.status !== 404);
      assert.equal(not404.length, 0, `Every unknown token returns 404: ${not404.map(r => `${r.label}=${r.status}`).join(", ")}`);
      return judge(rows, notes);
    });
  });

  // ---------- 2. Logout invalidation ----------
  await t.test("logout: replayed cookies after sign-out get a redirect or 401 with no data", async () => {
    await summary.run("logout-cookie-replay", async notes => {
      const session = new Actor(c); await session.signIn(A.email, A.password);
      assert.equal((await session.request("/api/users/me")).status, 200, "Control: the fresh session works before logout");
      const snapshot = [...session.cookies];
      const logout = await session.request("/api/auth/logout", { method: "POST", headers: { origin: appOrigin } });
      assert.equal(logout.status, 200, "App logout succeeds");
      const replay = new Actor(c); replay.cookies = new Map(snapshot);
      const rows = [];
      const page = await probe(rows, replay, "replay /profile", "/profile");
      const destination = page.response.headers.get("location") || metaRedirect(page.text);
      assert.ok(destination && new URL(destination, c.appUrl).pathname === "/login", `Protected page redirects to /login (got ${page.status})`);
      const me = await probe(rows, replay, "replay /api/users/me", "/api/users/me");
      assert.equal(me.status, 401, "Account API rejects the replayed cookie");
      const workspace = await probe(rows, replay, "replay /api/workspace studentDashboard", q("studentDashboard", []));
      assert.ok([401, 403].includes(workspace.status), `Workspace API rejects the replayed cookie (got ${workspace.status})`);
      notes.push(`Replayed: /profile ${page.status} -> /login, /api/users/me ${me.status}, /api/workspace ${workspace.status}.`);
      return judge(rows, notes);
    });
  });

  // ---------- 3. Public key direct access ----------
  await t.test("public key: PostgREST returns nothing for every Prisma table", async () => {
    await summary.run("anon-postgrest-tables", async notes => {
      const tables = [...prismaTables(fs.readFileSync(path.join(repo, "prisma/schema.prisma"), "utf8")), "_prisma_migrations"];
      const failures = [], statuses = {};
      for (const table of tables) for (const [keyName, headers] of publicKeys) {
        const response = await fetch(`${API}/rest/v1/${encodeURIComponent(table)}?select=*&limit=5`, { headers: { ...headers, accept: "application/json" } });
        const text = await response.text();
        statuses[response.status] = (statuses[response.status] || 0) + 1;
        let rows = null; try { rows = JSON.parse(text); } catch {}
        const leaks = findLeaks(text, seed.markers);
        if (response.status >= 500 || leaks.length || (response.ok && !(Array.isArray(rows) && rows.length === 0)))
          failures.push(`${table} (${keyName}): ${response.status}${leaks.length ? ` leaked ${leaks.join(", ")}` : Array.isArray(rows) ? ` returned ${rows.length} rows` : ""}`);
      }
      notes.push(`${tables.length} tables x ${publicKeys.length} public key forms; statuses ${JSON.stringify(statuses)}.`);
      for (const failure of failures) notes.push(`FAILED ${failure}`);
      assert.equal(failures.length, 0, `Public key reached table rows: ${failures.join("; ")}`);
    });
  });

  await t.test("public key: Storage list and download fail for every private bucket", async () => {
    await summary.run("anon-storage-buckets", async notes => {
      const listed = await service.storage.listBuckets();
      if (listed.error || !listed.data?.length) { notes.push(`No Storage buckets listed (${listed.error?.message || "empty"}); skipped.`); return "skip"; }
      const privateBuckets = listed.data.filter(bucket => !bucket.public).map(bucket => bucket.id);
      notes.push(`Private buckets: ${privateBuckets.join(", ")}. Public buckets (not probed): ${listed.data.filter(b => b.public).map(b => b.id).join(", ") || "none"}.`);
      for (const expected of ["resumes", "headshots"]) assert.ok(privateBuckets.includes(expected), `${expected} bucket is private`);
      const failures = [];
      for (const bucket of privateBuckets) {
        // A known object in each private bucket, so a successful download would be visible.
        let objectPath = bucket === "headshots" ? seed.headshot : bucket === "resumes" ? seed.resume : null;
        if (!objectPath) for (const [bytes, type, ext] of [[PNG, "image/png", "png"], [PDF, "application/pdf", "pdf"]]) {
          const candidate = `${A.id}/attacker-probe-${randomUUID()}.${ext}`;
          if (!(await service.storage.from(bucket).upload(candidate, bytes, { contentType: type })).error) { objectPath = candidate; break; }
        }
        if (!objectPath) notes.push(`${bucket}: no object could be seeded; list probes only.`);
        for (const [keyName, headers] of publicKeys) {
          for (const prefix of ["", A.id]) {
            const response = await fetch(`${API}/storage/v1/object/list/${bucket}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ prefix, limit: 100, offset: 0 }) });
            const text = await response.text(); let rows = null; try { rows = JSON.parse(text); } catch {}
            if (response.status >= 500 || findLeaks(text, seed.markers).length || (response.ok && !(Array.isArray(rows) && rows.length === 0)))
              failures.push(`${bucket} list "${prefix ? "A/" : ""}" (${keyName}): ${response.status}`);
          }
          if (!objectPath) continue;
          for (const [label, url, method, body] of [["download", `${API}/storage/v1/object/${bucket}/${objectPath}`, "GET"], ["authenticated download", `${API}/storage/v1/object/authenticated/${bucket}/${objectPath}`, "GET"], ["public URL", `${API}/storage/v1/object/public/${bucket}/${objectPath}`, "GET"], ["sign", `${API}/storage/v1/object/sign/${bucket}/${objectPath}`, "POST", JSON.stringify({ expiresIn: 60 })]]) {
            const response = await fetch(url, { method, headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) }, body });
            await response.arrayBuffer();
            if (response.ok || response.status >= 500) failures.push(`${bucket} ${label} (${keyName}): ${response.status}`);
          }
        }
      }
      for (const failure of failures) notes.push(`FAILED ${failure}`);
      assert.equal(failures.length, 0, `Public key reached private Storage: ${failures.join("; ")}`);
    });
  });

  // ---------- 4. Headers ----------
  const htmlPages = {};
  await t.test("headers: HTML forbids cross-origin framing", async () => {
    await summary.run("headers-framing", async notes => {
      for (const route of ["/", "/login", "/signup"]) {
        const response = await fetch(new URL(route, c.appUrl), { redirect: "manual" });
        htmlPages[route] = await response.text();
        const csp = response.headers.get("content-security-policy") || "", xfo = response.headers.get("x-frame-options") || "";
        notes.push(`${route} ${response.status}: CSP "${csp}", X-Frame-Options "${xfo}".`);
        assert.ok(/frame-ancestors\s+('self'|'none')/.test(csp) || /^(DENY|SAMEORIGIN)$/i.test(xfo), `${route} forbids cross-origin framing`);
      }
    });
  });
  await t.test("headers: repository and environment files are not served", async () => {
    await summary.run("headers-secret-paths", async notes => {
      for (const route of ["/.git/config", "/.git/HEAD", "/.env", "/.env.local", "/.env.production"]) {
        const response = await fetch(new URL(route, c.appUrl), { redirect: "manual" });
        const text = await response.text();
        notes.push(`${route}: ${response.status}`);
        assert.equal(response.status, 404, `${route} returns 404`);
        assert.doesNotMatch(text, /repositoryformatversion|\[core\]|ref: refs\/|DATABASE_URL\s*=|SUPABASE_[A-Z_]+\s*=/, `${route} exposes no file contents`);
      }
    });
  });
  await t.test("headers: no source maps under /_next/static", async () => {
    await summary.run("headers-source-maps", async notes => {
      for (const route of ["/", "/login", "/signup"]) if (!htmlPages[route]) htmlPages[route] = await (await fetch(new URL(route, c.appUrl), { redirect: "manual" })).text();
      const onDisk = [];
      const walk = dir => { if (!fs.existsSync(dir)) return; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (entry.name.endsWith(".map")) onDisk.push(path.relative(c.buildDir, full)); } };
      walk(path.join(c.buildDir, "static"));
      assert.equal(onDisk.length, 0, `No .map files in the served static folder: ${onDisk.slice(0, 5).join(", ")}`);
      const scripts = [...new Set(Object.values(htmlPages).flatMap(html => html.match(/\/_next\/static\/[^"'\s<>]+?\.js/g) || []))].slice(0, 20);
      assert.ok(scripts.length > 0, "Found Next static scripts to probe");
      let mappingComments = 0;
      for (const script of scripts) {
        const map = await fetch(new URL(script + ".map", c.appUrl), { redirect: "manual" }); await map.arrayBuffer();
        assert.equal(map.status, 404, `${script}.map is not served`);
        if (/sourceMappingURL=/.test(await (await fetch(new URL(script, c.appUrl))).text())) mappingComments++;
      }
      notes.push(`Build static folder: 0 maps. ${scripts.length} served scripts: every .map 404; ${mappingComments} still carry a sourceMappingURL comment (informational).`);
    });
  });
  await t.test("headers: middleware CSP present when the codebase sets one", async () => {
    await summary.run("headers-csp", async notes => {
      if (!middlewareSetsCsp(fs.readFileSync(path.join(repo, "middleware.ts"), "utf8"))) {
        notes.push("middleware.ts sets no Content-Security-Policy; only next.config's frame-ancestors applies. Skipped.");
        return "skip";
      }
      const response = await fetch(new URL("/login", c.appUrl), { redirect: "manual" }); await response.arrayBuffer();
      const enforced = response.headers.get("content-security-policy") || "", report = response.headers.get("content-security-policy-report-only") || "";
      notes.push(`Enforcing: "${enforced}". Report-Only: "${report}".`);
      assert.ok(report || /(default|script)-src/.test(enforced), "Middleware CSP (enforcing or Report-Only) is present on HTML");
    });
  });

  // ---------- 5. Enumeration ----------
  {
    const unknown = () => `attack.unknown.${randomUUID()}@virginia.edu`;
    const gotrue = (route, body) => fetch(`${API}/auth/v1/${route}`, { method: "POST", headers: { apikey: c.status.PUBLISHABLE_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
    const read = async response => { const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch {} return { status: response.status, json, text }; };
    await t.test("enumeration: login", () => summary.run("enumeration-login", async notes => {
      const known = await read(await gotrue("token?grant_type=password", { email: A.email, password: "Wrong-" + randomUUID() }));
      const other = await read(await gotrue("token?grant_type=password", { email: unknown(), password: "Wrong-" + randomUUID() }));
      notes.push(`Known ${known.status} ${known.json?.error_code || known.json?.code || ""}; unknown ${other.status} ${other.json?.error_code || other.json?.code || ""}.`);
      if ([known.status, other.status].includes(429)) { notes.push("Provider rate limit answered one request; comparison inconclusive."); return "partial"; }
      assert.equal(known.status, other.status, "Same status");
      assert.deepEqual(shape(known.json), shape(other.json), "Same body shape");
      assert.equal(known.json?.error_code, other.json?.error_code, "Same error code");
    }));
    await t.test("enumeration: forgot password", () => summary.run("enumeration-forgot-password", async notes => {
      // The route compares Origin with Next's request origin, which reports localhost for a loopback bind.
      const request = email => fetch(new URL("/api/auth/password-recovery", c.appUrl), { method: "POST", redirect: "manual", headers: { origin: c.appUrl.replace("127.0.0.1", "localhost"), "content-type": "application/json" }, body: JSON.stringify({ action: "request", email }) });
      const known = await read(await request(A.email)), other = await read(await request(unknown()));
      notes.push(`Known ${known.status}; unknown ${other.status}; bodies ${known.text === other.text ? "identical" : "differ"}.`);
      assert.equal(known.status, other.status, "Same status");
      assert.deepEqual(shape(known.json), shape(other.json), "Same body shape");
      assert.equal(known.text, other.text, "Same body");
    }));
    await t.test("enumeration: signup", () => summary.run("enumeration-signup", async notes => {
      const register = email => new Actor(c).action("actions/onboarding.ts", "registerStudent", [{ firstName: "Probe", lastName: "Visitor", email, password: "Disposable-attack!2026" }]);
      const known = await register(A.email), other = await register(unknown());
      notes.push(`Known ${JSON.stringify(shape(known))}; unknown ${JSON.stringify(shape(other))}.`);
      if (/Too many attempts/i.test(other?.error || "")) { notes.push("Provider email rate limit answered the unknown signup; comparison inconclusive (a known confirmed account never reaches that limit)."); return "partial"; }
      assert.deepEqual(shape(known), shape(other), "Same result shape");
      assert.deepEqual(known, other, "Same result");
    }));
    await t.test("enumeration: direct /auth/v1/otp (informational)", () => summary.run("enumeration-direct-otp", async notes => {
      const other = await read(await gotrue("otp", { email: unknown(), create_user: false }));
      notes.push(`Direct /auth/v1/otp for an unknown email with create_user=false: ${other.status} ${other.json?.error_code || other.json?.code || ""} (informational; the app never calls it this way).`);
      return "informational";
    }));
  }

  // ---------- 6. Open redirect ----------
  await t.test("open redirect: next parameters never leave the origin", async () => {
    await summary.run("open-redirect", async notes => {
      const payloads = ["//evil.example", "https://evil.example", "%2F%2Fevil.example", "/%5Cevil.example", "/%5C%5Cevil.example", "https:%2F%2Fevil.example", "%09//evil.example", "/%2F/evil.example", "///evil.example", "http:evil.example"];
      const failures = [];
      async function follow(actor, start) {
        let current = start;
        for (let hop = 0; hop < 5; hop++) {
          const response = await actor.request(current), text = await response.text();
          const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : metaRedirect(text);
          if (!location) return { status: response.status, final: current };
          if (isOffOrigin(location, c.appUrl)) return { offOrigin: location };
          const next = new URL(location, c.appUrl); current = next.pathname + next.search;
        }
        return { final: current };
      }
      let count = 0;
      for (const [who, actor] of [["anonymous", new Actor(c)], ["signed-in A", A.actor]])
        for (const route of ["/login", "/signup", "/auth/callback"])
          for (const payload of payloads) {
            const result = await follow(actor, `${route}?next=${payload}`); count++;
            if (result.offOrigin) failures.push(`${who} ${route}?next=${payload} -> ${result.offOrigin}`);
          }
      notes.push(`${count} redirect chains followed (up to 5 hops each).`);
      for (const failure of failures) notes.push(`FAILED ${failure}`);
      assert.equal(failures.length, 0, `Off-origin redirects: ${failures.join("; ")}`);
    });
  });

  // ---------- 7. Rate limits ----------
  await t.test("rate limits: bursts against /q and password recovery hit 429 when lib/rate-limit exists", async () => {
    await summary.run("rate-limits", async notes => {
      const limiter = rateLimitModule(repo);
      if (!limiter) { notes.push("No lib/rate-limit module in this build; burst checks skipped. Supabase Auth's own provider limits still apply."); return "skip"; }
      notes.push(`Rate-limit module: ${limiter}.`);
      // Each burst comes from its own documentation-range address (RFC 5737), so it proves one address is limited
      // without using up the shared loopback bucket that the other e2e files' recovery and claim flows run in.
      // Burst sizes follow the live policy table, so raising a limit cannot silently turn this check into a no-op.
      const policy = name => Number(fs.readFileSync(path.join(repo, "lib/rate-limit-core.ts"), "utf8").match(new RegExp(`${name}: \\{ name: "[^"]+", limit: (\\d+)`))?.[1]);
      const shortLinkLimit = policy("shortLinks"), recoveryLimit = policy("passwordRecovery");
      assert.ok(shortLinkLimit > 0 && recoveryLimit > 0, "policy limits are readable from lib/rate-limit-core.ts");
      const address = () => `198.51.100.${1 + randomBytes(1)[0] % 254}`;
      const shortLinkAddress = address(); let recoveryAddress = address(); while (recoveryAddress === shortLinkAddress) recoveryAddress = address();
      const burst = async (count, width, send) => { const statuses = []; for (let n = 0; n < count; n += width) statuses.push(...await Promise.all(Array.from({ length: Math.min(width, count - n) }, send))); return statuses; };
      const code = randomBytes(6).toString("base64url");
      const shortLinks = await burst(shortLinkLimit + 40, 25, async () => { const r = await fetch(new URL(`/q/${code}`, c.appUrl), { redirect: "manual", headers: { "x-forwarded-for": shortLinkAddress } }); await r.arrayBuffer(); return r.status; });
      const recovery = await burst(recoveryLimit + 10, 10, async () => { const r = await fetch(new URL("/api/auth/password-recovery", c.appUrl), { method: "POST", headers: { origin: c.appUrl.replace("127.0.0.1", "localhost"), "content-type": "application/json", "x-forwarded-for": recoveryAddress }, body: JSON.stringify({ action: "request", email: `attack.burst.${randomUUID()}@virginia.edu` }) }); await r.arrayBuffer(); return r.status; });
      notes.push(`/q burst: ${shortLinks.filter(s => s === 429).length}/${shortLinks.length} got 429. Recovery burst: ${recovery.filter(s => s === 429).length}/${recovery.length} got 429.`);
      assert.ok(shortLinks.includes(429), "/q/<code> burst is rate limited");
      assert.ok(recovery.includes(429), "Password recovery burst is rate limited");
    });
  });

  // ---------- 8. Uploads ----------
  await t.test("uploads: HTML or script disguised as a PNG headshot is rejected", async () => {
    await summary.run("uploads-headshot-html", async notes => {
      const upload = (bytes, name, type) => { const form = new FormData(); form.set("kind", "headshot"); form.set("file", new File([bytes], name, { type })); return B.actor.action("actions/storage.ts", "uploadProfileFile", [form]); };
      const control = await upload(PNG, "photo.png", "image/png");
      assert.ok(control?.reference?.startsWith(`${B.id}/`), "Control: a real PNG headshot uploads");
      const disguised = [
        ["HTML named .png", "<!doctype html><script>alert(document.cookie)</script>", "photo.png", "image/png"],
        ["SVG with script named .png", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "photo.png", "image/png"],
        ["HTML named .png without a type", "<html><body onload=alert(1)>", "photo.png", ""],
        ["HTML declared text/html", "<script>alert(1)</script>", "photo.png", "text/html"],
        ["JavaScript named .png", "fetch('/api/users/me').then(r=>r.text()).then(alert)", "photo.png", "image/png"],
      ];
      for (const [label, body, name, type] of disguised) {
        await assert.rejects(upload(Buffer.from(body), name, type), error => error?.code !== "ERR_ASSERTION", `${label} is rejected`);
        notes.push(`${label}: rejected.`);
      }
      // Informational: a PNG signature followed by HTML passes the magic-byte check; it must be served as an image with nosniff.
      try {
        const polyglot = await upload(Buffer.concat([PNG, Buffer.from("<script>alert(1)</script>")]), "photo.png", "image/png");
        const served = await B.actor.request(`/api/profile-photos?path=${encodeURIComponent(polyglot.reference)}`); await served.arrayBuffer();
        notes.push(`PNG+HTML polyglot accepted by signature (informational); served ${served.status} as ${served.headers.get("content-type")} with nosniff=${served.headers.get("x-content-type-options")}.`);
        assert.equal(served.headers.get("x-content-type-options"), "nosniff", "Accepted images are served with nosniff");
        if (served.status === 200) assert.match(served.headers.get("content-type") || "", /^image\//, "Accepted images are served as images");
      } catch (error) {
        if (error?.code === "ERR_ASSERTION") throw error;
        notes.push("PNG+HTML polyglot: rejected.");
      }
    });
  });
});

// Unit tests for the attacker-pass helpers. No services; runs in the plain `pnpm test` suite.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const h = require("./helpers/attacker-pass.cjs");

test("assertLocalTarget accepts only loopback hosts", () => {
  for (const url of ["http://127.0.0.1:3107", "http://localhost:55321", "postgresql://postgres:x@127.0.0.1:55322/postgres", "http://[::1]:3000"])
    assert.doesNotThrow(() => h.assertLocalTarget(url));
  for (const url of ["https://www.out-class.net", "https://abc.supabase.co", "http://10.0.0.5:3000", "http://127.0.0.1.evil.example", "not a url", "file:///etc/passwd"])
    assert.throws(() => h.assertLocalTarget(url), /refus/);
});

test("markerList drops short and duplicate values", () => {
  const markers = h.markerList([["id", "1234567"], ["email", "A@virginia.edu"], ["email again", "a@virginia.edu"], ["empty", null], ["name", "ProbeLastName9"]]);
  assert.deepEqual(markers.map(m => m.label), ["email", "name"]);
});

test("findLeaks finds raw, case-changed, URL-encoded and JSON-escaped markers", () => {
  const markers = h.markerList([["email", "alice.probe@virginia.edu"], ["note", "PRIVATE-NOTE-1234abcd"], ["path", "user-1/resume x.pdf"], ["quote", 'say "hi" now']]);
  assert.deepEqual(h.findLeaks("nothing here", markers), []);
  assert.deepEqual(h.findLeaks('{"email":"ALICE.PROBE@virginia.edu"}', markers), ["email"]);
  assert.deepEqual(h.findLeaks("<p>private-note-1234ABCD</p>", markers), ["note"]);
  assert.deepEqual(h.findLeaks("/api/resumes?path=user-1%2Fresume%20x.pdf", markers), ["path"]);
  assert.deepEqual(h.findLeaks(JSON.stringify({ text: 'say "hi" now' }), markers), ["quote"]);
  assert.deepEqual(h.findLeaks(Buffer.from("%PDF alice.probe@virginia.edu"), markers), ["email"]);
  assert.deepEqual(h.findLeaks({ nested: { v: "PRIVATE-NOTE-1234abcd" } }, markers), ["note"]);
});

test("findLeaks ignores markers the attacker sent itself", () => {
  const markers = h.markerList([["application", "0b6f3c1e-1111-4222-8333-944455556666"], ["email", "alice.probe@virginia.edu"]]);
  const body = 'self.__next_f.push([1,"applicationId":"0b6f3c1e-1111-4222-8333-944455556666"])';
  assert.deepEqual(h.findLeaks(body, markers), ["application"]);
  assert.deepEqual(h.findLeaks(body, markers, ["/applications/0b6f3c1e-1111-4222-8333-944455556666/decision"]), []);
  assert.deepEqual(h.findLeaks(body, markers, ["/api/x?args=%5B%220b6f3c1e-1111-4222-8333-944455556666%22%5D"]), []);
  assert.deepEqual(h.findLeaks(body + " alice.probe@virginia.edu", markers, ["/applications/0b6f3c1e-1111-4222-8333-944455556666"]), ["email"]);
});

test("metaRedirect reads Next streamed redirects only", () => {
  assert.equal(h.metaRedirect('<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/login?next=%2Fprofile&amp;a=1"/>'), "/login?next=%2Fprofile&a=1");
  assert.equal(h.metaRedirect('<meta name="viewport" content="width=device-width"/>'), null);
  assert.equal(h.metaRedirect(""), null);
});

test("isOffOrigin keeps loopback aliases on the app port and rejects everything else", () => {
  const app = "http://127.0.0.1:3107";
  for (const location of ["/login", "/login?next=%2F%2Fevil.example", "http://localhost:3107/home", "http://127.0.0.1:3107/x", "", null])
    assert.equal(h.isOffOrigin(location, app), false, String(location));
  for (const location of ["//evil.example", "https://evil.example/", "http://127.0.0.1:9999/", "/\\evil.example", "javascript:alert(1)", "http://localhost:55321/storage/v1/object/sign/resumes/x"])
    assert.equal(h.isOffOrigin(location, app), true, String(location));
});

test("classify separates denial, malformed probes, allowed data and server errors", () => {
  const appUrl = "http://127.0.0.1:3107";
  for (const status of [401, 403, 404, 405, 410]) assert.equal(h.classify(status, { appUrl }), "denied");
  assert.equal(h.classify(400, { appUrl }), "invalid");
  assert.equal(h.classify(307, { appUrl, location: "/login?next=%2Fprofile" }), "denied");
  assert.equal(h.classify(307, { appUrl, location: "http://127.0.0.1:55321/storage/v1/object/sign/resumes/a.pdf?token=x" }), "allowed");
  assert.equal(h.classify(200, { appUrl, body: "{}" }), "allowed");
  assert.equal(h.classify(200, { appUrl, body: '<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/login"/>' }), "denied");
  assert.equal(h.classify(200, { appUrl, body: '<meta http-equiv="refresh" content="1;url=https://evil.example"/>' }), "allowed");
  assert.equal(h.classify(500, { appUrl }), "error");
  assert.equal(h.classify(503, { appUrl }), "error");
});

test("shape compares keys and types, not values", () => {
  assert.deepEqual(h.shape({ code: 400, error_code: "invalid_credentials", msg: "x" }), h.shape({ msg: "y", code: 400, error_code: "other" }));
  assert.notDeepEqual(h.shape({ authenticated: false }), h.shape({ error: "Too many attempts" }));
  assert.deepEqual(h.shape([{ a: 1 }, { a: 2 }]), [{ a: "number" }]);
  assert.deepEqual(h.shape(null), "null");
});

test("prismaTables lists every model with its mapped name, and covers the real schema", () => {
  const source = 'model User {\n  id String @id\n}\n\nmodel Meeting {\n  id String @id\n  @@map("Event")\n}\nenum Role {\n  A\n}\n';
  assert.deepEqual(h.prismaTables(source), ["User", "Event"]);
  const real = h.prismaTables(fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8"));
  assert.ok(real.length > 50, "every Prisma model is probed");
  assert.ok(real.includes("Event") && !real.includes("Meeting"));
  assert.ok(real.includes("Application") && real.includes("ApplicantObservation") && real.includes("VotingBallot"));
});

test("middlewareSetsCsp and rateLimitModule detect optional protections", () => {
  assert.equal(h.middlewareSetsCsp('response.headers.set("Content-Security-Policy-Report-Only", policy)'), true);
  assert.equal(h.middlewareSetsCsp('response.headers.set("X-Robots-Tag", "noindex")'), false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attacker-pass-"));
  try {
    assert.equal(h.rateLimitModule(dir), null);
    fs.mkdirSync(path.join(dir, "lib")); fs.writeFileSync(path.join(dir, "lib/rate-limit.ts"), "");
    assert.equal(h.rateLimitModule(dir), "lib/rate-limit.ts");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AttackerSummary records pass, skip and fail rows and writes JSON", async () => {
  const summary = new h.AttackerSummary();
  await summary.run("ok", notes => { notes.push("checked"); });
  await summary.run("optional", () => "skip");
  await assert.rejects(summary.run("broken", async notes => { notes.push("probe 1"); throw Error("leak found"); }), /leak found/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attacker-pass-")), file = path.join(dir, "nested/out.json");
  try {
    summary.write(file);
    const written = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(written.cases.map(row => [row.case, row.result]), [["ok", "pass"], ["optional", "skip"], ["broken", "fail"]]);
    assert.deepEqual(written.cases[2].notes, ["probe 1", "leak found"]);
    assert.deepEqual(written.counts, { pass: 1, skip: 1, fail: 1 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

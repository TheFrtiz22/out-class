// Timed smoke run of the mobile API against a local web server on staging data.
// Run: node scripts/staging/api-smoke.cjs [baseUrl]. Prints statuses, timings and sizes only.
"use strict";
const { signIn } = require("./accounts.cjs");
const base = process.argv[2] || "http://localhost:3000";

async function call(token, name, input, method = "GET") {
  const url = new URL(`/api/mobile/v1/${name}`, base);
  if (method === "GET" && input !== undefined) url.searchParams.set("input", JSON.stringify(input));
  const started = performance.now();
  const response = await fetch(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(method === "POST" ? { "Content-Type": "application/json" } : {}) }, body: method === "POST" ? JSON.stringify(input ?? null) : undefined });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = null; }
  return { status: response.status, ms: Math.round(performance.now() - started), bytes: text.length, body };
}

(async () => {
  const student = await signIn("student");
  const rows = [];
  const record = (label, result, note = "") => rows.push({ label, status: result.status, ms: result.ms, kB: +(result.bytes / 1024).toFixed(1), note: note || result.body?.error?.code || "" });
  record("me (no token)", await call(null, "me"));
  record("me (garbage token)", await call("a.b.c", "me"));
  const me = await call(student.token, "me"); record("me", me, me.body?.data?.email === student.email ? "own account" : "MISMATCH");
  for (const pass of ["cold", "warm"]) {
    const directory = await call(student.token, "explore.directory"); record(`explore.directory (${pass})`, directory, `${directory.body?.data?.clubs?.length ?? "?"} clubs`);
  }
  const directory = await call(student.token, "explore.directory");
  const first = directory.body?.data?.clubs?.[0];
  if (first) record("club", await call(student.token, "club", { club: first.slug || first.id }), first.slug || "");
  record("explore.search", await call(student.token, "explore.search", { query: "consult" }));
  record("home.dashboard", await call(student.token, "home.dashboard"));
  record("applications", await call(student.token, "applications"));
  record("inbox", await call(student.token, "inbox"));
  record("profile", await call(student.token, "profile"));
  record("clubs.saved", await call(student.token, "clubs.saved"));
  record("events.board", await call(student.token, "events.board", {}));
  record("meetings", await call(student.token, "meetings"));
  record("unknown operation", await call(student.token, "nope"));
  record("wrong method", await call(student.token, "clubs.save"));
  console.table(rows);
})().catch(error => { console.error(error.message); process.exit(1); });

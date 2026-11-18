"use strict";
// Temporary probe: prints only the FORM of media values, never the values.
const { signIn } = require("./accounts.cjs");
const form = v => v == null ? String(v) : v === "" ? "empty" : /^https?:/.test(v) ? "http-url" : v.startsWith("/api/") ? v.split("?")[0] + "?" + [...new URLSearchParams(v.split("?")[1] || "").keys()].join(",") : /^[0-9a-f-]{36}\/[^/]+\.(\w+)$/.test(v) ? "storage-path." + v.split(".").pop() : /^club-assets\//.test(v) ? "club-asset-ref" : "other(" + v.slice(0, 12) + ")";
(async () => {
  const s = await signIn("student");
  const get = async (token, op, input) => { const u = new URL(`/api/mobile/v1/${op}`, "http://localhost:3000"); if (input) u.searchParams.set("input", JSON.stringify(input)); const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const p = await get(s.token, "profile");
  const prof = p.body?.data?.profile;
  console.log("profile", p.status, "headshot:", form(prof?.headshotUrl), "resume:", form(prof?.resumeUrl));
  for (const [kind, v] of [["profile-photos", prof?.headshotUrl], ["resumes", prof?.resumeUrl]]) {
    if (!v || /^https?:/.test(v)) continue;
    const u = new URL(`/api/mobile/v1/media/${kind}`, "http://localhost:3000"); u.searchParams.set("path", v);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${s.token}` }, redirect: "manual" });
    console.log("media", kind, r.status, r.headers.get("content-type"), r.headers.get("location") ? "has-location" : "no-location");
  }
  const d = await get(s.token, "explore.directory", {});
  const clubs = d.body?.data?.clubs ?? d.body?.data ?? [];
  const list = Array.isArray(clubs) ? clubs : [];
  const counts = {}; for (const c of list) for (const k of ["logoUrl", "bannerUrl"]) { const f = k + ":" + form(c[k]); counts[f] = (counts[f] || 0) + 1; }
  console.log("directory", d.status, list.length, counts, Array.isArray(clubs) ? "" : Object.keys(d.body?.data ?? {}));
})().catch(e => { console.error(e.message); process.exit(1); });

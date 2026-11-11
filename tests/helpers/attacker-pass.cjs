// Pure helpers for the attacker pass (tests/attacker-pass-e2e.test.cjs). No network, no
// credentials: unit-tested in tests/attacker-pass-helpers.test.cjs so the e2e checks rest on
// verified scanning and classification.
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Throws unless `value` is an http(s) URL on a loopback host. Run before any request. */
function assertLocalTarget(value, label = "target") {
  let url;
  try { url = new URL(value); } catch { throw Error(`Attacker pass refuses a non-URL ${label}`); }
  if (!["http:", "https:", "postgres:", "postgresql:"].includes(url.protocol) || !LOOPBACK.has(url.hostname))
    throw Error(`Attacker pass runs only against a disposable loopback ${label}; refusing ${url.hostname || "unknown host"}`);
  return url;
}

/**
 * Seeded private values to look for in response bodies. Each marker is { label, value }.
 * Values shorter than 8 characters are dropped: they would match unrelated text.
 */
function markerList(entries) {
  const seen = new Set(), out = [];
  for (const [label, raw] of entries) {
    const value = raw == null ? "" : String(raw).trim();
    if (value.length < 8 || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase()); out.push({ label, value });
  }
  return out;
}

/**
 * Seeded markers present in `body`. Case-insensitive; also matches the URL-encoded and
 * JSON-escaped forms. A marker that the attacker itself sent (it appears in any `sent`
 * string, e.g. the request URL or request body) is not a leak: route params echo into
 * HTML/RSC payloads and prove nothing.
 */
function findLeaks(body, markers, sent = []) {
  const text = typeof body === "string" ? body : Buffer.isBuffer(body) ? body.toString("latin1") : JSON.stringify(body ?? "");
  const haystack = text.toLowerCase();
  const echoed = sent.map(value => { const s = String(value ?? ""); try { return (s + " " + decodeURIComponent(s)).toLowerCase(); } catch { return s.toLowerCase(); } }).join("\n");
  const leaks = [];
  for (const { label, value } of markers) {
    const lower = value.toLowerCase();
    if (echoed.includes(lower)) continue;
    const forms = new Set([lower, encodeURIComponent(value).toLowerCase(), JSON.stringify(value).slice(1, -1).toLowerCase()]);
    if ([...forms].some(form => haystack.includes(form))) leaks.push(label);
  }
  return leaks;
}

/** A streamed Next redirect target (200 + <meta id="__next-page-redirect" http-equiv="refresh">), or null. */
function metaRedirect(html) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(([, key, value]) => [key.toLowerCase(), value]));
    if (attributes["http-equiv"]?.toLowerCase() !== "refresh") continue;
    const match = /^\s*\d+\s*;\s*url=(.+)$/i.exec(attributes.content || "");
    if (match) return match[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/gi, "/");
  }
  return null;
}

/** True when `location` (absolute or relative) leaves the app: anything but the app's own loopback origin. */
function isOffOrigin(location, appUrl) {
  if (location == null || location === "") return false;
  const app = new URL(appUrl);
  let target;
  try { target = new URL(String(location), app); } catch { return true; }
  if (!["http:", "https:"].includes(target.protocol)) return true;
  // Next rewrites a loopback IP to localhost in middleware redirects; the port must still match.
  return !(LOOPBACK.has(target.hostname) && LOOPBACK.has(app.hostname) && target.port === app.port);
}

/**
 * Classify one HTTP answer to an unauthorized request.
 *  denied  — 401/403/404/405/410, or a redirect (HTTP or streamed) that stays on the app origin
 *  invalid — 400/422: the probe was malformed, so it did not test authorization
 *  allowed — any other 2xx, or a redirect off the app origin (e.g. a signed Storage URL)
 *  error   — 5xx
 */
function classify(status, { location = null, body = "", appUrl } = {}) {
  if ([401, 403, 404, 405, 410].includes(status)) return "denied";
  if (status === 400 || status === 422) return "invalid";
  if (status >= 300 && status < 400) return appUrl && isOffOrigin(location, appUrl) ? "allowed" : "denied";
  if (status >= 500) return "error";
  if (status >= 200 && status < 300) {
    const target = metaRedirect(body);
    if (target && appUrl && !isOffOrigin(target, appUrl)) return "denied";
    return "allowed";
  }
  return "error";
}

/** Recursive key/type shape of a JSON value, for comparing responses without their values. */
function shape(value) {
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : [];
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]));
  return value === null ? "null" : typeof value;
}

/** Database table names for every Prisma model (its @@map name when present). */
function prismaTables(schemaSource) {
  const tables = [];
  for (const match of String(schemaSource).matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const mapped = /^\s*@@map\(\s*"([^"]+)"\s*\)/m.exec(match[2]);
    tables.push(mapped ? mapped[1] : match[1]);
  }
  return tables;
}

/** Whether the codebase sets a CSP beyond frame-ancestors in middleware (the header check is skipped otherwise). */
function middlewareSetsCsp(middlewareSource) {
  return /Content-Security-Policy(?:-Report-Only)?/i.test(String(middlewareSource || ""));
}

/** First existing rate-limit module, or null. */
function rateLimitModule(repo) {
  for (const candidate of ["lib/rate-limit.ts", "lib/rate-limit.js", "lib/rate-limit/index.ts", "lib/rate-limit/index.js"])
    if (fs.existsSync(path.join(repo, candidate))) return candidate;
  return null;
}

/** Collects { case, result, notes } rows and writes them as JSON, also when a case fails. */
class AttackerSummary {
  constructor() { this.cases = []; }
  record(name, result, notes) {
    const existing = this.cases.find(row => row.case === name);
    const row = { case: name, result, notes: Array.isArray(notes) ? notes : notes ? [String(notes)] : [] };
    if (existing) Object.assign(existing, row); else this.cases.push(row);
    return row;
  }
  /** Runs `fn(notes)`; records pass, or fail with the error message, then rethrows. `fn` may return "skip" or "partial". */
  async run(name, fn) {
    const notes = [];
    try {
      const outcome = await fn(notes);
      return this.record(name, ["skip", "partial", "informational"].includes(outcome) ? outcome : "pass", notes);
    } catch (error) {
      this.record(name, "fail", [...notes, String(error?.message || error).slice(0, 2000)]);
      throw error;
    }
  }
  toJSON() {
    const counts = {};
    for (const row of this.cases) counts[row.result] = (counts[row.result] || 0) + 1;
    return { suite: "attacker-pass", generatedAt: new Date().toISOString(), counts, cases: this.cases };
  }
  write(filename) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(this.toJSON(), null, 2) + "\n");
  }
}

module.exports = { assertLocalTarget, markerList, findLeaks, metaRedirect, isOffOrigin, classify, shape, prismaTables, middlewareSetsCsp, rateLimitModule, AttackerSummary };

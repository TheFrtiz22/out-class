const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { pathToFileURL } = require("node:url")

const load = async () => (await import(pathToFileURL(path.join(__dirname, "../next.config.mjs")).href)).default

test("every path may be framed only by this origin", async () => {
  const rules = await (await load()).headers()
  const global = rules.find(rule => rule.source === "/:path*" && !rule.has)
  assert.ok(global, "a header rule covers every path")
  const value = key => global.headers.find(header => header.key.toLowerCase() === key.toLowerCase())?.value
  assert.equal(value("X-Frame-Options"), "SAMEORIGIN")
  // frame-ancestors comes from middleware (lib/csp.ts): a config-level Content-Security-Policy
  // also reaches the rendered request on Vercel and hides the nonce from Next.js (docs/csp.md).
  assert.equal(value("Content-Security-Policy"), undefined)
  const csp = require("node:fs").readFileSync(path.join(__dirname, "../lib/csp.ts"), "utf8")
  assert.match(csp, /FRAME_ANCESTORS_POLICY = "frame-ancestors 'self'"/)
  assert.match(require("node:fs").readFileSync(path.join(__dirname, "../middleware.ts"), "utf8"), /response\.headers\.set\("Content-Security-Policy", FRAME_ANCESTORS_POLICY\)/)
  // 'self', not 'none'/DENY: the leader workspace frames the same-origin résumé PDF route.
  assert.ok(require("node:fs").readFileSync(path.join(__dirname, "../components/applicant-review/applicant-review-flow.tsx"), "utf8").includes("<iframe"))
})

test("no narrower rule sets a framing header or a Content-Security-Policy", async () => {
  const rules = await (await load()).headers()
  for (const rule of rules.filter(rule => rule.source !== "/:path*")) {
    for (const header of rule.headers) {
      assert.notEqual(header.key.toLowerCase(), "x-frame-options", rule.source)
      assert.notEqual(header.key.toLowerCase(), "content-security-policy", rule.source)
    }
  }
})

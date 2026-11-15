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
  assert.equal(value("Content-Security-Policy"), "frame-ancestors 'self'")
  assert.equal(value("X-Frame-Options"), "SAMEORIGIN")
  // 'self', not 'none'/DENY: the leader workspace frames the same-origin résumé PDF route.
  assert.ok(require("node:fs").readFileSync(path.join(__dirname, "../components/applicant-review/applicant-review-flow.tsx"), "utf8").includes("<iframe"))
})

test("no narrower rule sets a second, conflicting framing policy", async () => {
  const rules = await (await load()).headers()
  for (const rule of rules.filter(rule => rule.source !== "/:path*")) {
    for (const header of rule.headers) {
      assert.notEqual(header.key.toLowerCase(), "x-frame-options", rule.source)
      if (header.key.toLowerCase() === "content-security-policy") assert.match(header.value, /frame-ancestors 'self'/, rule.source)
    }
  }
})

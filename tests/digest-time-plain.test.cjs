const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")
const files = ["components/communications-preferences.tsx", "mobile/src/components/inbox/preferences.tsx"]

test("email preferences say when daily summaries arrive in plain words, on web and in the app", () => {
  for (const file of files) {
    assert.doesNotMatch(read(file), /midnight UTC/, file)
    assert.match(read(file), /Daily summaries go out once a day, in the evening, US Eastern time\./, file)
  }
})

test("the digest is still sent at the next midnight UTC, which is 7 or 8 PM in New York", () => {
  assert.match(read("lib/communications-policy.ts"), /Date\.UTC\(createdAt\.getUTCFullYear\(\), createdAt\.getUTCMonth\(\), createdAt\.getUTCDate\(\) \+ 1\)/)
  for (const midnight of [Date.UTC(2026, 0, 16), Date.UTC(2026, 6, 16)]) {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(midnight)))
    assert.ok(hour === 19 || hour === 20, String(hour))
  }
})

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const hook = fs.readFileSync("hooks/use-staged-decisions.ts", "utf8")
const panel = fs.readFileSync("components/applicant-review/staged-decisions-panel.tsx", "utf8")
const MAX_SEND = Number(/const MAX_SEND = (\d+);/.exec(fs.readFileSync("actions/review-decisions.ts", "utf8"))[1])

test("a large send goes out in batches that each fit one decision transaction", () => {
  const batch = Number(/export const SEND_BATCH = (\d+)/.exec(hook)[1])
  assert.ok(batch <= 50 && batch <= MAX_SEND, "each batch stays small enough to finish inside the club write timeout")
  const send = hook.slice(hook.indexOf("const send = useCallback"), hook.indexOf("return useMemo"))
  assert.match(send, /for \(let start = 0; start < applicationIds\.length; start \+= SEND_BATCH\)/)
  assert.match(send, /applicationIds: applicationIds\.slice\(start, start \+ SEND_BATCH\)/)
  assert.match(send, /throw total\.sent \? new PartialSendError\(total, error\) : error/, "a later failure reports what already went out")
  assert.match(send, /finally \{[\s\S]*await reload\(\)/, "the list reloads even when a batch fails")
})

test("Send all sends every chosen decision and says how many went out when it stops part way", () => {
  assert.doesNotMatch(panel, /chosen\.slice\(0, 200\)/, "decisions past the 200th are no longer silently left behind")
  assert.match(panel, /await staged\.send\(chosen\)/)
  assert.match(panel, /error instanceof PartialSendError/)
  assert.match(panel, /sent, then sending stopped/)
})

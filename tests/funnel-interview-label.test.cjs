const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const card = fs.readFileSync(path.join(__dirname, "../components/recruiting-insights-card.tsx"), "utf8");
const action = fs.readFileSync(path.join(__dirname, "../actions/recruiting-insights.ts"), "utf8");

test("the conversion card names the interview tile for what it counts: anyone booked or assigned to an interview", () => {
  // The count includes applicants assigned to an interview round who have not booked or held one yet.
  assert.match(action, /interviewed: a\.bookings\.length > 0 \|\| a\.interviewAssignments\.length > 0/);
  assert.doesNotMatch(card, /label: `Interviewed ·/);
  assert.match(card, /label: `Reached interviews · \$\{rate\(f\.interviewed\)\}`/);
});

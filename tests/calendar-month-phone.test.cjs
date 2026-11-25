const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../components/views/calendar-view.tsx"), "utf8");
const month = source.slice(source.indexOf('view === "month"'), source.indexOf('<div className="divide-y">'));

test("the month grid fits a phone: no fixed 650px width below the sm breakpoint", () => {
  assert.doesNotMatch(month, /className="min-w-\[650px\]"/);
  assert.match(month, /className="sm:min-w-\[650px\]"/);
});

test("on a phone each day shows one tappable dot per event that opens the day, and the full chips return from sm up", () => {
  assert.match(month, /aria-label=\{`\$\{dayEvents\.length\} event\$\{dayEvents\.length === 1 \? "" : "s"\} on \$\{key\}`\}/);
  assert.match(month, /size-1\.5 rounded-full/);
  assert.match(month, /"hidden w-full rounded p-1\.5 text-left text-control leading-snug sm:block/);
  assert.match(month, /className="[^"]*sm:hidden"/);
});

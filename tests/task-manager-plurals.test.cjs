const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// A count shown next to a noun must agree with it: "Review 1 submission", not "Review 1 submissions".
const source = fs.readFileSync(path.join(__dirname, "../components/tasks/task-manager-workspace.tsx"), "utf8");
const nouns = "submissions|tasks|assignments|revisions";
// `${count} nouns` in a template, or {count} nouns in JSX text, with an optional adjective between.
const fixedPlural = new RegExp(`(\\$\\{[^{}]*(?:\\([^()]*\\))?[^{}]*\\}|\\{[\\w.!]+\\})\\s+(?:selected |reviewed )?(?:${nouns})\\b`, "g");

test("task manager never pairs a count with an always-plural noun", () => {
  const found = [...source.matchAll(fixedPlural)].map((match) => match[0]);
  assert.deepEqual(found, []);
});

test("task manager imports the plural helpers it uses", () => {
  assert.match(source, /import \{ plural, pluralize \} from "@\/lib\/copy\/terms"/);
  assert.match(source, /Review \$\{pluralize\(counts\.needsReview,"submission"\)\}/);
});

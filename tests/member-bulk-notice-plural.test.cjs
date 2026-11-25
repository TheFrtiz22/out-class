const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// After a bulk change of one member the notice read "1 memberships updated." It must agree with the count.
const source = fs.readFileSync(path.join(__dirname, "../components/organization-member-management.tsx"), "utf8");

test("the bulk member notice agrees with its count", () => {
  assert.doesNotMatch(source, /`\$\{count\} memberships updated\.`/);
  assert.match(source, /`\$\{pluralize\(count, "membership"\)\} updated\.`/);
});

test("pluralize reads 1 membership and 2 memberships", () => {
  const ts = require("typescript");
  const file = path.join(__dirname, "../lib/copy/terms.ts");
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", js)((name) => (name.startsWith("@/") ? {} : require(name)), mod, mod.exports);
  assert.equal(`${mod.exports.pluralize(1, "membership")} updated.`, "1 membership updated.");
  assert.equal(`${mod.exports.pluralize(2, "membership")} updated.`, "2 memberships updated.");
});

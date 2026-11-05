// The real student path registry (lib/navigation.ts) for tests that mock module maps.
const fs = require("node:fs")
const ts = require("typescript")
function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => mocks[name] || require(name), mod, mod.exports)
  return mod.exports
}
const studentNavigation = load("lib/student-navigation.ts", {})
module.exports = load("lib/navigation.ts", { "@/lib/student-navigation": studentNavigation })

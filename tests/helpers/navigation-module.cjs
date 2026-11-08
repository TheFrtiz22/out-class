// The real navigation registry (lib/navigation.ts, with lib/student-routes.ts) for tests that mock module maps.
const fs = require("node:fs")
const ts = require("typescript")
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = { exports: {} }
  cache.set(file, mod)
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => name.startsWith("@/") ? load(resolve(name.slice(2))) : require(name), mod, mod.exports)
  return mod.exports
}
function resolve(name) {
  const file = [`${name}.ts`, `${name}.tsx`].find(candidate => fs.existsSync(candidate))
  if (!file) throw Error(`Cannot resolve @/${name}`)
  return file
}
module.exports = load("lib/navigation.ts")

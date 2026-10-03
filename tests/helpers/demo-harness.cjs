const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
function harness() {
  const cache = {}
  let calls = 0
  global.localStorage = {
    data: new Map(),
    getItem(k) {
      return this.data.get(k) || null
    },
    setItem(k, v) {
      this.data.set(k, v)
    },
    removeItem(k) {
      this.data.delete(k)
    },
  }
  function load(file) {
    file = path.resolve(file)
    if (cache[file]) return cache[file].exports
    const mod = { exports: {} }
    cache[file] = mod
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    new Function("require", "module", "exports", code)(
      (name) => {
        if (name.startsWith("@/actions/"))
          return new Proxy(
            {},
            {
              get: () => async () => {
                calls++
                throw new Error("real server invoked")
              },
            },
          )
        if (name.startsWith("@/")) return load(name.slice(2) + ".ts")
        if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name) + ".ts")
        return require(name)
      },
      mod,
      mod.exports,
    )
    return mod.exports
  }
  return { load, calls: () => calls }
}
module.exports = { harness }

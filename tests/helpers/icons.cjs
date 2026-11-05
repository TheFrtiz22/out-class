// Share the real icon exports with the standalone TypeScript component harnesses.
// components/icons.tsx re-exports one module per icon from components/icons/.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
// The upstream CommonJS export points at a .cjs.js file inside a module
// package. Resolve the real ESM SSR entry instead, matching Next's imports.
const packageRoot = path.dirname(require.resolve('@phosphor-icons/react/package.json'))
const cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports
  const mod = { exports: {} }
  cache.set(filename, mod)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const iconRequire = name => name.startsWith('@phosphor-icons/react/dist/ssr/')
    ? require(path.join(packageRoot, `dist/ssr/${name.split('/').at(-1)}.es.js`))
    : name.startsWith('@/components/icons') ? load(path.resolve(__dirname, '../..', name.slice(2)) + '.tsx')
    : require(name)
  new Function('require', 'module', 'exports', code)(iconRequire, mod, mod.exports)
  return mod.exports
}
module.exports = load(path.resolve(__dirname, '../../components/icons.tsx'))

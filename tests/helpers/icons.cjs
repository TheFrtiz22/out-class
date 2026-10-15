// Share the real icon exports with the standalone TypeScript component harnesses.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const filename = path.resolve(__dirname, '../../components/icons.tsx')
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
// The upstream CommonJS export points at a .cjs.js file inside a module
// package. Resolve the real ESM SSR entry instead, matching Next's imports.
const packageRoot = path.dirname(require.resolve('@phosphor-icons/react/package.json'))
const iconRequire = name => name.startsWith('@phosphor-icons/react/dist/ssr/')
  ? require(path.join(packageRoot, `dist/ssr/${name.split('/').at(-1)}.es.js`))
  : require(name)
new Function('require', 'module', 'exports', code)(iconRequire, module, module.exports)

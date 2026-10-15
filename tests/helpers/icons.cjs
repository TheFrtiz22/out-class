// Share the real icon exports with the standalone TypeScript component harnesses.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const filename = path.resolve(__dirname, '../../components/icons.tsx')
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
new Function('require', 'module', 'exports', code)(require, module, module.exports)

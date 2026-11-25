// Test stand-ins for school scoping. utils/school-scope.ts (request-bound) is replaced: every viewer resolves to the
// launch school unless a test passes another. lib/school-host.ts is pure and loaded for real.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const UVA = { id: 'school-uva', key: 'uva' }
const schoolScope = (school = UVA, host = school) => ({ resolveViewerSchool: async () => school, resolveAccountSchool: async () => school, resolveHostSchool: async () => host })
function compile(file, req) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  return mod.exports
}
const schoolHost = () => compile('lib/school-host.ts', name => name === '@/lib/seo' ? compile('lib/seo.ts', require) : require(name))
module.exports = { UVA, schoolScope, schoolHost }

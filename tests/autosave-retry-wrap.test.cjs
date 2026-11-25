// At phone width a long save refusal ("Couldn't save. Retry Add an organization for each experience.") squeezed the
// Retry link until it broke mid-word, because the status row could not wrap. The row now wraps between its parts,
// Retry keeps its word whole, and the reason reads before the action.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')

function load() {
  const file = path.resolve('components/ui/autosave-status.tsx'), mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(n => n === '@/lib/autosave-store' ? { recoveryText: String } : n === '@/components/ui/loading-indicator' ? { LoadingIndicator: () => null } : require(n), mod, mod.exports)
  return mod.exports.AutosaveStatus
}
const render = save => renderToStaticMarkup(React.createElement(load(), { save: { flush: async () => {}, ...save } }))

for (const state of ['error', 'offline', 'unreachable']) test(`the ${state} line wraps and keeps Retry whole`, () => {
  const html = render({ state, error: 'Add an organization for each experience.' })
  const row = html.match(/^<div role="status" aria-live="polite" class="([^"]*)"/)[1].split(/\s+/)
  assert.ok(row.includes('flex-wrap'), 'the row wraps on a narrow screen')
  const retry = html.match(/<button type="button" class="([^"]*)">Retry<\/button>/)
  assert.ok(retry, 'Retry is rendered')
  for (const c of ['shrink-0', 'whitespace-nowrap']) assert.ok(retry[1].split(/\s+/).includes(c), `Retry has ${c}`)
})

test('the refusal reads before Retry', () => {
  const html = render({ state: 'error', error: 'Add an organization for each experience.' })
  assert.ok(html.indexOf('Add an organization') < html.indexOf('>Retry<'), 'the reason comes first')
  assert.match(html, /Couldn’t save\./)
})

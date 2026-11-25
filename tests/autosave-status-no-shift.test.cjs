// The autosave line ("Saving…", then "Saved") appeared above editors only after the first keystroke saved, pushing
// every control below it down by its height and margin. In Tasks › Review, a leader's click on "Approve & next" landed
// on empty space because the button moved as the feedback they had just typed saved. The line now holds its place.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')

function load() {
  const file = path.resolve('components/ui/autosave-status.tsx'), mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(n => n === '@/lib/autosave-store' ? { recoveryText: String } : n === '@/components/ui/loading-indicator' ? { LoadingIndicator: () => null } : require(n), mod, mod.exports)
  return mod.exports.AutosaveStatus
}

test('the autosave line keeps the same box before, during and after a save', () => {
  const AutosaveStatus = load()
  const html = state => renderToStaticMarkup(React.createElement(AutosaveStatus, { save: { state, error: '', flush: async () => {} } }))
  const box = markup => { const m = markup.match(/^<div role="status" aria-live="polite" class="([^"]*)"/); assert.ok(m, `a status box is rendered: ${markup}`); return m[1].split(/\s+/) }
  const idle = box(html('idle'))
  assert.ok(idle.includes('min-h-4'), 'the idle line reserves one line of height')
  for (const state of ['saving', 'saved', 'error']) assert.ok(box(html(state)).includes('min-h-4'), `${state} uses the same height`)
  assert.doesNotMatch(html('idle'), /Sav/)
})

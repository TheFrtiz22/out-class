// Settings -> Interests has an explicit Save. A choice left unsaved used to vanish without a word when the
// student tapped Profile or Explore; the shell only asks before leaving a form marked data-unsaved.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
const flush = () => new Promise(resolve => setImmediate(resolve))
function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', 'window', code)(name => name in mocks ? mocks[name] : name === '@/lib/interest-survey' ? load('lib/interest-survey.ts', {}) : name.startsWith('@/') ? new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }) : require(name), mod, mod.exports, mocks.__window)
  return mod.exports
}
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)]
function harness(props) {
  const slots = [], effects = [], listeners = new Set(); let index = 0
  const react = {
    useState(v) { const i = index++; if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useEffect(fn, deps) { const i = index++; const prev = slots[i]; if (!prev || deps.some((v, j) => v !== prev.deps[j])) { prev?.cleanup?.(); slots[i] = { deps }; effects.push([i, fn]) } },
  }
  const window = { addEventListener(type, fn) { if (type === 'beforeunload') listeners.add(fn) }, removeEventListener(type, fn) { if (type === 'beforeunload') listeners.delete(fn) } }
  const saves = []
  const { InterestSurveyForm } = load('components/interests/interest-survey-form.tsx', {
    react, __window: window,
    '@/lib/workspace-api': { saveMyInterestSurvey: async input => { saves.push(input); return { ...input, revision: input.revision + 1 } } },
    '@/lib/user-message': { userMessage: (_e, fallback) => fallback },
    '@/contexts/auth-context': { useAuth: () => ({ user: { profile: {} } }) },
    '@/lib/graduation': { isAlumniProfile: () => false, ALUMNI_REFUSALS: { survey: '' } },
  })
  globalThis.window = window
  const render = () => { index = 0; const tree = InterestSurveyForm({ onSaved() {}, ...props }); while (effects.length) { const [i, fn] = effects.shift(); slots[i].cleanup = fn() } return tree }
  return { render, listeners, saves }
}
const initial = { interests: ['consulting'], goals: ['career'], weeklyHours: '3-5', selectivity: 'yes', revision: 4 }
const form = tree => nodes(tree).find(n => n.type === 'form')
const chips = (tree, label) => nodes(tree).find(n => n.props?.label === label)

test('Settings marks an unsaved choice, warns on reload, and clears both once saved', async () => {
  const h = harness({ initial, guardUnsaved: true })
  let tree = h.render()
  assert.equal(form(tree).props['data-unsaved'], false, 'nothing changed yet')
  assert.equal(h.listeners.size, 0)
  chips(tree, 'What are you into?').props.onChange(['consulting', 'tech'])
  tree = h.render()
  assert.equal(form(tree).props['data-unsaved'], true, 'the shell now asks before leaving')
  assert.equal(h.listeners.size, 1, 'a reload or a closed tab asks too')
  await form(tree).props.onSubmit({ preventDefault() {} }); await flush()
  tree = h.render()
  assert.equal(h.saves.length, 1)
  assert.equal(form(tree).props['data-unsaved'], false, 'saved choices are not unsaved')
  assert.equal(h.listeners.size, 0)
})

test('picking the same choices again in another order is not a change', () => {
  const h = harness({ initial: { ...initial, goals: ['career', 'service'] }, guardUnsaved: true })
  let tree = h.render()
  chips(tree, 'What do you want from a club?').props.onChange(['service', 'career'])
  tree = h.render()
  assert.equal(form(tree).props['data-unsaved'], false)
})

test('onboarding and the Home prompt, which leave on purpose after Continue or Skip, are not guarded', () => {
  const h = harness({ initial: null })
  let tree = h.render()
  chips(tree, 'What are you into?').props.onChange(['tech'])
  tree = h.render()
  assert.equal(form(tree).props['data-unsaved'], false)
  assert.equal(h.listeners.size, 0)
  assert.match(fs.readFileSync(path.join(root, 'components/interests/interest-settings.tsx'), 'utf8'), /guardUnsaved/)
})

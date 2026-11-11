// FE-19: one shared QR presenter dialog for projector display.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Real Radix dialog, but the portal renders inline so the open dialog appears in
// server markup (Radix portals mount only after a client layout effect).
const RadixDialog = require('@radix-ui/react-dialog')
const inlineRadix = { ...RadixDialog, Portal: ({ children }) => React.createElement(React.Fragment, null, children) }

const qrCalls = []
function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name === '@/components/icons') return require('./helpers/icons.cjs')
    if (name.endsWith('.css')) return {}
    if (name.startsWith('@/')) {
      const base = path.resolve(name.slice(2))
      const resolved = ['.ts', '.tsx'].map(ext => base + ext).find(f => fs.existsSync(f))
      return load(resolved, mocks)
    }
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}

const realQr = () => load('components/qr/outclass-qr-code.tsx', {})
function loadDialog() {
  const { OutClassQRCode } = realQr()
  const Spy = props => { qrCalls.push(props); return React.createElement(OutClassQRCode, props) }
  return load('components/qr/qr-presenter-dialog.tsx', {
    '@radix-ui/react-dialog': inlineRadix,
    '@/components/qr/outclass-qr-code': { OutClassQRCode: Spy },
  })
}

test('presenter dialog renders the readable short link, the branded QR and an accessible name', () => {
  const { QrPresenterDialog, readableQrLink } = loadDialog()
  qrCalls.length = 0
  const value = 'https://out-class.net/q/a7K2mP'
  const html = renderToStaticMarkup(React.createElement(QrPresenterDialog, { value, title: 'Fall info session', open: true, onOpenChange() {} }))

  assert.equal(readableQrLink(value), 'out-class.net/q/a7K2mP')
  assert.ok(html.includes('>out-class.net/q/a7K2mP</p>'), 'link written out as text')
  assert.ok(html.includes('Copy link'))
  assert.ok(html.includes('Download PNG') && html.includes('Download SVG'))

  // Built on OutClassQRCode with the exact value, branded monogram and compact graphic.
  assert.equal(qrCalls.length, 1)
  assert.equal(qrCalls[0].value, value)
  assert.equal(qrCalls[0].showLogo, true)
  assert.equal(qrCalls[0].variant, 'compact')
  assert.ok(qrCalls[0].size >= 240, 'projector-sized QR')
  assert.match(html, /<svg[^>]*role="img"/)

  // Labelled modal dialog: aria-labelledby points at the title element.
  const dialog = html.match(/<div[^>]*role="dialog"[^>]*>/)
  assert.ok(dialog, 'renders a dialog')
  const labelledBy = dialog[0].match(/aria-labelledby="([^"]+)"/)[1]
  const titleTag = html.match(new RegExp(`<h2[^>]*id="${labelledBy.replace(/[:]/g, '\\:')}"[^>]*>([^<]*)</h2>`))
  assert.ok(titleTag, 'title element exists')
  assert.equal(titleTag[1], 'Fall info session')
  assert.match(dialog[0], /aria-describedby="[^"]+"/)
  // Close control from the shared dialog primitive.
  assert.ok(html.includes('<span class="sr-only">Close</span>'))
  // No caller description: the default scan line is visible, not screen-reader only.
  assert.match(html, /<p[^>]*class="[^"]*mt-2 text-base text-muted-foreground"[^>]*>Scan with your phone camera\.<\/p>/)
  // Reduced motion hooks for this dialog's surface and overlay only.
  assert.match(html, /class="[^"]*oc-qr-presenter-overlay/)
  assert.match(html, /role="dialog"[^>]*class="[^"]*\boc-qr-presenter\s/)
  const css = fs.readFileSync('styles/interface-primitives.css', 'utf8')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.oc-qr-presenter, \.oc-qr-presenter-overlay \{ animation: none !important;/)
})

test('refreshing state replaces the QR with a calm status, the error and a retry', () => {
  const { QrPresenterDialog } = loadDialog()
  qrCalls.length = 0
  let retried = 0
  const html = renderToStaticMarkup(React.createElement(QrPresenterDialog, { value: '', title: 'Meeting', open: true, trigger: false, refreshing: true, error: 'Network down', onRetry() { retried++ } }))
  assert.equal(qrCalls.length, 0, 'no QR while the code is not current')
  assert.ok(html.includes('>Refreshing code…</p>'))
  assert.match(html, /role="alert"[^>]*>Network down<\/p>/)
  assert.ok(html.includes('Try again'))
  assert.doesNotMatch(html, /Download PNG|aria-haspopup/, 'no exports and no trigger when trigger is false')
  assert.doesNotMatch(html, /aria-pressed/)
})

test('closed presenter renders only its Present trigger', () => {
  const { QrPresenterDialog } = loadDialog()
  const html = renderToStaticMarkup(React.createElement(QrPresenterDialog, { value: 'https://out-class.net/q/x', title: 'Meeting' }))
  assert.ok(html.includes('Present'))
  assert.ok(html.includes('aria-haspopup="dialog"'))
  assert.doesNotMatch(html, /role="dialog"/)
})

test('presenter uses shared primitives and export helpers, and no generic QR library', () => {
  const src = fs.readFileSync('components/qr/qr-presenter-dialog.tsx', 'utf8')
  assert.match(src, /from "@\/components\/ui\/dialog"/)
  assert.match(src, /from "@\/components\/qr\/outclass-qr-code"/)
  assert.match(src, /downloadQrPng, downloadQrSvg \} from "@\/lib\/qr\/export"/)
  assert.match(src, /requestFullscreen/)
  assert.match(src, /document\.fullscreenEnabled/)
  assert.doesNotMatch(src, /qrcode\.react|react-qr|from "qrcode"|lucide/)
})

test('QR card and meeting check-in present through QrPresenterDialog, not an inline overlay', () => {
  const card = fs.readFileSync('components/qr/qr-code-card.tsx', 'utf8')
  const meeting = fs.readFileSync('components/meeting-workspace.tsx', 'utf8')
  const qr = fs.readFileSync('components/qr/outclass-qr-code.tsx', 'utf8')
  for (const src of [card, meeting]) {
    assert.match(src, /import \{ (QrPresentButton, )?QrPresenterDialog \} from "(\.\/|@\/components\/qr\/)qr-presenter-dialog"/)
    assert.match(src, /<QrPresenterDialog\s/)
    assert.doesNotMatch(src, /presenterMode/)
  }
  // The meeting presenter encodes the same rotating link as the card beside it.
  assert.match(meeting, /<OutClassQRCode\s+value=\{checkInUrl\}/)
  assert.match(meeting, /<QrPresenterDialog\s+value=\{checkInUrl\}/)
  assert.match(meeting, /code\.shortUrl \? `\$\{window\.location\.origin\}\$\{code\.shortUrl\}`/)
  assert.match(card, /<QrPresenterDialog\s+value=\{activeUrl\}/)
  // The old hand-rolled overlay is gone from the base component.
  assert.doesNotMatch(qr, /presenterMode|role="dialog"|isPresenterOpen/)
})

// Fake-timer harness for the meeting check-in call site (hooks mocked like
// tests/meeting-attendance-poll.test.cjs). Components render as their names.
function meetingHarness(issue) {
  const slots = [], effects = [], cleanups = new Map(), timers = new Map()
  let index = 0, nextTimer = 0, clock = Date.parse('2026-11-10T18:00:00Z')
  const react = {
    useState(v) { const i = index++; if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(v) { const i = index++; return slots[i] ??= { current: v } },
    useMemo(fn, deps) { const i = index++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { deps, value: fn() }; return slots[i].value },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps) },
    useEffect(fn, deps) { const i = index++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) { slots[i] = deps; effects.push([i, fn]) } },
  }
  class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [clock])) } static now() { return clock } }
  const api = { meetingAttendance: async () => [], issueMeetingCheckIn: (...a) => issue(...a), closeMeetingCheckIn: async () => {} }
  const mocks = { react, '@/lib/workspace-api': api, '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false }) } }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('components/meeting-workspace.tsx', 'utf8') + '\nexports.MeetingAttendance = MeetingAttendance;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', 'window', 'Date', 'setInterval', 'clearInterval', code)(
    name => mocks[name] || (name === 'react/jsx-runtime' ? require(name) : new Proxy({}, { get: (_, key) => String(key) })),
    mod, mod.exports, { location: { origin: 'https://out-class.net' } }, FakeDate,
    (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms, due: clock + ms }); return id }, id => timers.delete(id))
  const meeting = { id: 'meeting', clubId: 'club', title: 'Fall info session' }
  return {
    render() { index = 0; const tree = mod.exports.MeetingAttendance({ meeting }); while (effects.length) { const [slot, setup] = effects.shift(); cleanups.get(slot)?.(); cleanups.set(slot, setup()) } return tree },
    advance(ms) {
      const end = clock + ms
      for (;;) {
        const next = [...timers.values()].filter(t => t.due <= end).sort((a, b) => a.due - b.due)[0]
        if (!next) break
        clock = next.due; next.due += next.ms; next.fn()
      }
      clock = end
    },
    now: () => clock,
  }
}
const all = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(all) : [n, ...all(n.props?.children), ...all(n.props?.actions)]
const textOf = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(textOf).join('') : n?.props ? textOf(n.props.children) : ''
const flushAll = () => new Promise(resolve => setImmediate(resolve))

test('meeting presenter stays open through a failed refresh past expiry, then shows refreshing, the error and a retry', async () => {
  let calls = 0, fail = false, h
  h = meetingHarness(async () => { calls++; if (fail) throw new Error('Network down'); return { token: 't'.repeat(64), expiresAt: new Date(h.now() + 90_000).toISOString(), shortUrl: `/q/c${calls}` } })
  let tree = h.render()
  all(tree).find(n => n.type === 'Button' && textOf(n) === 'Open attendance QR').props.onClick()
  h.render(); await flushAll(); tree = h.render()
  assert.equal(calls, 1)

  // Open the presenter from the card's Present button.
  all(tree).find(n => n.type === 'QrPresentButton').props.onClick(); tree = h.render()
  let dialog = all(tree).find(n => n.type === 'QrPresenterDialog')
  assert.equal(dialog.props.open, true)
  assert.equal(dialog.props.refreshing, false)
  assert.equal(dialog.props.value, 'https://out-class.net/q/c1', 'same rotating short link as the card')
  assert.equal(dialog.props.description, 'Scan with your phone camera to check in.')

  // Every refresh fails from now on; advance past the 90 s expiry.
  fail = true
  h.advance(91_000); await flushAll(); tree = h.render()
  assert.equal(calls, 2, 'the 60 s refresh ran and failed')
  dialog = all(tree).find(n => n.type === 'QrPresenterDialog')
  assert.ok(dialog, 'dialog is still mounted after the code expired')
  assert.equal(dialog.props.open, true, 'projector dialog stays open')
  assert.equal(dialog.props.refreshing, true)
  assert.equal(dialog.props.error, 'Network down')
  assert.equal(dialog.props.value, '')
  assert.equal(all(tree).some(n => n.type === 'OutClassQRCode'), false, 'expired code is no longer shown on the card')

  // Retry issues a new code and the dialog recovers in place.
  fail = false
  dialog.props.onRetry(); h.render(); await flushAll(); tree = h.render()
  assert.equal(calls, 3)
  dialog = all(tree).find(n => n.type === 'QrPresenterDialog')
  assert.equal(dialog.props.open, true)
  assert.equal(dialog.props.refreshing, false)
  assert.equal(dialog.props.error, '')
  assert.equal(dialog.props.value, 'https://out-class.net/q/c3')
})

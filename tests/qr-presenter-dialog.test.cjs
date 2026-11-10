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
    assert.match(src, /import \{ QrPresenterDialog \} from "(\.\/|@\/components\/qr\/)qr-presenter-dialog"/)
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

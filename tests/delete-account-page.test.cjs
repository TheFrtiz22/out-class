// /delete-account: the public account-deletion page Google Play asks for. Anyone can open it, and every
// fact on it is the product's own, so each one is pinned to the app or web code that makes it true.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const read = file => fs.readFileSync(file, 'utf8')
const seo = load('lib/seo.ts')
const legal = load('lib/legal-content.ts', { '@/lib/seo': seo })
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

function renderPage() {
  const page = load('app/delete-account/page.tsx', {
    '@/lib/seo': seo,
    '@/lib/legal-content': legal,
    '@/components/landing/public-information-page': { PublicInformationPage: ({ eyebrow, title, introduction, children }) => React.createElement('main', null, React.createElement('p', null, eyebrow), React.createElement('h1', null, title), React.createElement('p', null, introduction), children) },
    '@/components/motion/scroll-motion': { SectionReveal: ({ children, ...props }) => React.createElement('section', props, children) },
    'next/link': { __esModule: true, default: ({ prefetch, ...props }) => React.createElement('a', props) },
  })
  return { page, html: renderToStaticMarkup(page.default()) }
}

test('the page renders the app and web steps, the 14-day window, what is kept, and the support address', () => {
  const { page, html } = renderPage()
  const body = text(html)
  assert.equal((html.match(/<h1/g) || []).length, 1)
  assert.match(body, /Delete your OutClass account\./)
  assert.match(body, /Go to Settings , then Account & Security/)
  assert.match(body, /type your university email or the word DELETE/)
  assert.match(body, /scheduled for deletion 14 days after/)
  assert.ok(html.includes(`href="mailto:${legal.CONTACT_EMAIL}"`), 'support email link')
  assert.equal(legal.CONTACT_EMAIL, 'hello@out-class.net')
  assert.equal(page.metadata.alternates.canonical, `${seo.SITE_URL}/delete-account`)
  assert.equal(page.metadata.title.absolute, 'Delete your account · OutClass')
})

test('every fact matches what the app and the web show beside Delete account', () => {
  const { html } = renderPage()
  const body = text(html)
  const app = read('mobile/src/app/settings/account.tsx')
  const web = read('components/settings/account-deletion.tsx')
  // The four "what happens" bullets, word for word, from both clients.
  const bullets = [...read('app/delete-account/page.tsx').matchAll(/^  "(.+)",$/gm)].map(match => match[1])
  assert.equal(bullets.length, 4)
  for (const line of bullets) {
    assert.ok(app.includes(`"${line}"`), `app shows: ${line}`)
    assert.ok(web.includes(`<li>${line}</li>`), `web shows: ${line}`)
    assert.ok(body.includes(line), `page shows: ${line}`)
  }
  // The 14-day window and the confirmation rule.
  assert.match(app, /You can cancel within 14 days\./)
  assert.match(web, /Your account will be deleted in 14 days\./)
  assert.match(app, /Type your university email or DELETE/)
  assert.match(web, /Type your university email or DELETE/)
  // The path the page names: Settings → Account & Security → Delete account, on both.
  assert.match(read('mobile/src/app/settings/index.tsx'), /label: "Account & Security"/)
  assert.match(app, /<Text variant="section" accessibilityRole="header">Delete account<\/Text>/)
  assert.match(read('lib/settings-navigation.ts'), /label: "Account & Security", href: "\/settings\/account"/)
})

test('the page is public: no sign-in, not behind the legal-pages flag, and listed as a route', () => {
  const source = read('app/delete-account/page.tsx')
  assert.doesNotMatch(source, /requireAuth|getCurrentUser|LEGAL_PAGES_PUBLIC|notFound\(/)
  const middleware = read('middleware.ts')
  const gate = middleware.slice(middleware.indexOf('if (!LEGAL_PAGES_PUBLIC'), middleware.indexOf('__not-public'))
  assert.doesNotMatch(gate, /delete-account/)
  assert.doesNotMatch(middleware, /delete-account/, 'middleware treats it like /about, with no special case')
  assert.match(read('lib/route-template.ts'), /"\/delete-account"/)
})

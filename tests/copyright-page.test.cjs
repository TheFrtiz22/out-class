// /copyright: OutClass's DMCA designated agent and the notice and counter-notice steps. 17 U.S.C. § 512(c)(2)
// requires the agent's name, address, phone and email on the site where the public can reach them, so the
// page is public and indexable, and every place that mentions copyright links to it.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') || name.startsWith('./') ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const read = file => fs.readFileSync(file, 'utf8')
const seo = load('lib/seo.ts')
const legal = load('lib/legal-content.ts', { '@/lib/seo': seo })
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

function renderPage() {
  const page = load('app/copyright/page.tsx', {
    '@/lib/seo': seo,
    '@/lib/legal-content': legal,
    '@/components/landing/public-information-page': { PublicInformationPage: ({ eyebrow, title, introduction, children }) => React.createElement('main', null, React.createElement('p', null, eyebrow), React.createElement('h1', null, title), React.createElement('p', null, introduction), children) },
    '@/components/motion/scroll-motion': { SectionReveal: ({ children, ...props }) => React.createElement('section', props, children) },
  })
  return { page, html: renderToStaticMarkup(page.default()) }
}

test('the page names the designated agent with every detail § 512(c)(2) requires', () => {
  const { html } = renderPage()
  const body = text(html)
  assert.equal((html.match(/<h1/g) || []).length, 1)
  assert.match(body, /Copyright and DMCA notices\./)
  for (const value of [legal.DMCA_AGENT.name, 'OutClassPlatforms LLC', ...legal.DMCA_AGENT.addressLines, legal.DMCA_AGENT.phone, legal.DMCA_AGENT.email]) assert.ok(body.includes(value), value)
  assert.match(html, /<address/)
  assert.ok(html.includes(`href="mailto:${legal.DMCA_AGENT.email}"`), 'agent email link')
  if (legal.DMCA_AGENT_PHONE_HREF) assert.ok(html.includes(`href="${legal.DMCA_AGENT_PHONE_HREF}"`), 'agent phone link')
})

test('the page lists the notice elements of § 512(c)(3), the counter-notice of § 512(g)(3), repeat infringers and § 512(f)', () => {
  const body = text(renderPage().html)
  for (const phrase of [
    'physical or electronic signature', 'Identification of the copyrighted work', 'information reasonably sufficient for us to find it',
    'mailing address, telephone number and email address', 'good-faith belief that the use of the material is not authorized', 'under penalty of perjury',
    'mistake or misidentification', 'consent to the jurisdiction of the federal district court', 'accept service of process', '10 to 14 business days',
    'repeat infringers', '512(f)',
  ]) assert.ok(body.includes(phrase), phrase)
})

test('the page is public, indexable and listed in the sitemap, llms.txt and the route list', async () => {
  const { page } = renderPage()
  assert.equal(page.metadata.alternates.canonical, `${seo.SITE_URL}/copyright`)
  assert.equal(page.metadata.title.absolute, 'Copyright and DMCA notices · OutClass')
  assert.notDeepEqual(page.metadata.robots, seo.privateRobots)
  const source = read('app/copyright/page.tsx')
  assert.doesNotMatch(source, /requireAuth|getCurrentUser|LEGAL_PAGES_PUBLIC|notFound\(/)
  assert.doesNotMatch(read('middleware.ts'), /\/copyright/, 'middleware treats it like /about, with no special case')
  assert.match(read('lib/route-template.ts'), /"\/copyright"/)
  assert.match(read('app/sitemap.ts'), /\$\{SITE_URL\}\/copyright/)
  assert.match(read('app/llms.txt/route.ts'), /\$\{SITE_URL\}\/copyright/)
  assert.doesNotMatch(read('app/robots.ts'), /copyright/)
})

test('the footer, Terms and Privacy placeholders, Support, Terms §8, /legal, content reports and the app all point to /copyright', () => {
  const { PublicFooter } = load('components/landing/public-footer.tsx', { '@/lib/legal-content': legal, '@/lib/photo-credits': load('lib/photo-credits.ts') })
  assert.match(renderToStaticMarkup(React.createElement(PublicFooter)), /href="\/copyright"/)
  const { LegalPlaceholderPage } = load('components/landing/legal-placeholder-page.tsx', { '@/lib/legal-content': legal, './public-page-frame': { PublicPageFrame: ({ children }) => React.createElement('main', null, children) } })
  assert.match(renderToStaticMarkup(React.createElement(LegalPlaceholderPage, legal.legalPlaceholders.terms)), /href="\/copyright"/)
  assert.match(read('app/support/page.tsx'), /href="\/copyright"/)
  const section8 = legal.termsOfService.sections.find(section => /Copyright and DMCA/.test(section.heading))
  assert.ok(JSON.stringify(section8).includes(legal.DMCA_AGENT.email) && JSON.stringify(section8).includes('/copyright'))
  assert.ok(JSON.stringify(legal.legalDetails('')).includes('/copyright'))
  assert.equal(load('lib/content-reports.ts').TERMS_DMCA_HREF, '/copyright')
  const settings = read('mobile/src/app/settings/index.tsx')
  assert.match(settings, /id: "copyright"[^\n]*openLegalPage\("\/copyright"\)/)
})

test('the agent details are complete and are the only place they are written', () => {
  // Every value must be filled in from the Copyright Office filing before this ships (no [placeholder] left).
  assert.equal(legal.DMCA_AGENT_COMPLETE, true, `DMCA agent details still have a placeholder: ${JSON.stringify(legal.DMCA_AGENT)}`)
  assert.ok(legal.DMCA_AGENT_PHONE_HREF, 'agent phone is a 10-digit number')
  // One source: the page, Terms and /legal read DMCA_AGENT; no file repeats the email or phone literally.
  for (const file of ['app/copyright/page.tsx', 'app/support/page.tsx', 'components/landing/public-footer.tsx', 'components/landing/legal-placeholder-page.tsx']) {
    assert.ok(!read(file).includes(legal.DMCA_AGENT.email), `${file} repeats the agent email`)
  }
})

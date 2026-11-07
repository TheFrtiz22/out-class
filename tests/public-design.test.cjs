// Phase 5 design rules for public pages that can be checked without a browser.
// The browser checks (axe, sizes, overflow, keyboard) are scripts/public-site-audit.cjs and
// scripts/public-site-keyboard.cjs; their latest results are in docs/public-site/.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadComponent } = require('./helpers/component-module.cjs')
const read = file => fs.readFileSync(file, 'utf8')

test('sign-in and sign-up: one serif h1 in the form card; the illustrative panel is labelled Sample', () => {
  const panel = read('components/auth/login-auth-panel.tsx')
  assert.match(panel, /<h1 id="login-auth-title" className="oc-auth-title">/)
  assert.doesNotMatch(panel, /<h2|Back to home|<main/)
  const signup = read('components/auth/signup-page-view.tsx')
  assert.equal((signup.match(/<h1/g) || []).length, 1); assert.match(signup, /Create your profile/)
  assert.match(read('components/views/student-onboarding-wizard.tsx'), /embedded \? "Your account" : "Create your account"/)
  const { LoginBrandPanel } = loadComponent('components/auth/login-brand-panel.tsx')
  const html = renderToStaticMarkup(React.createElement(LoginBrandPanel))
  assert.doesNotMatch(html, /<h1|<h2|<h3/); assert.match(html, /oc-auth-sample-chip">Sample</); assert.match(html, />SAMPLE</)
  for (const file of ['components/views/auth-view.tsx', 'components/auth/signup-page-view.tsx', 'components/password-recovery.tsx']) assert.match(read(file), /<PublicPageFrame/, file)
  assert.match(read('components/password-recovery.tsx'), /<h1 id="recovery-title" className="oc-auth-title">/)
  const css = read('components/auth/login.css')
  assert.match(css, /\.oc-auth-page button:disabled \{ opacity: \.62; cursor: not-allowed; \}/)
  assert.match(css, /\.oc-auth-page \.oc-login-submit:disabled \{ background: var\(--oc-glass-pill-navy\)/)
})

test('homepage: audience toggle in the hero, per-audience final call to action, no repeated "one profile"', () => {
  const hero = read('components/landing/landing-hero.tsx')
  assert.match(hero, /<SegmentedControl className="oc-hero-audience-toggle"[\s\S]*<h1/)
  assert.match(hero, /cta: "Create your profile"/); assert.match(hero, /cta: "Set up your club"/)
  const student = hero.slice(hero.indexOf('student: {'), hero.indexOf('leader: {'))
  assert.equal((student.match(/one profile/gi) || []).length, 1)
  assert.match(read('components/views/landing-page-view.tsx'), /perspective === "student" \? "Create your profile" : "Set up your club"/)
  assert.match(read('components/landing/feature-orbit.tsx'), /className="oc-story-sample">Sample</)
})

test('about has one primary action; UVA has Create your profile + Browse clubs and a separate Not at UVA section', () => {
  const about = read('app/about/page.tsx')
  assert.equal((about.match(/<Button asChild/g) || []).length, 1)
  const uva = read('app/uva/page.tsx')
  assert.match(uva, /href="\/signup">Create your profile/); assert.match(uva, /variant="outline"><Link prefetch=\{false\} href="\/explore">Browse clubs/)
  assert.match(uva, /<section className="oc-public-section oc-faq-next" aria-labelledby="not-uva-title">/)
})

test('public stylesheets have no text below 12px', () => {
  const files = [...fs.readdirSync('components/landing').filter(f => f.endsWith('.css')).map(f => `components/landing/${f}`), 'components/views/landing.css', 'components/auth/login.css', 'components/clubs/profile-presentation.css']
  for (const file of files) assert.doesNotMatch(read(file), /font-size: ?(?:[0-9]|1[01])(?:\.\d+)?px/, file)
  assert.match(read('components/landing/public-foundations.css'), /\.oc-landing \{ --oc-size-8: 12px; --oc-size-9: 12px; --oc-size-10: 12px; --oc-size-11: 12px; \}/)
})

const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { loader } = require('./helpers/communications-loader.cjs')
const root = path.resolve(__dirname, '..')
const load = loader({})
const { PAGE_ROUTE_TEMPLATES, routeTemplate } = load(path.join(root, 'lib/route-template.ts'))
const vitals = load(path.join(root, 'lib/web-vitals.ts'))
const s = load(path.join(root, 'lib/sentry-scrub.ts'))

function appTemplates(dir = path.join(root, 'app'), prefix = '') {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'api' && !prefix) continue
      const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`
      found.push(...appTemplates(path.join(dir, entry.name), prefix + segment))
    } else if (/^page\.(tsx|ts|mdx)$/.test(entry.name)) found.push(prefix || '/')
  }
  return found
}

test('the route template list covers exactly the pages in app/', () => {
  assert.deepEqual([...PAGE_ROUTE_TEMPLATES].sort(), [...new Set(appTemplates())].sort())
})

test('pathnames reduce to templates, never IDs, slugs, share codes or query strings', () => {
  assert.equal(routeTemplate('/club/consulting-club'), '/club/[clubId]')
  assert.equal(routeTemplate('/club/4f9c2e1a-0b2c-4d1e-8f00-123456789abc/workspace?section=pipeline'), '/club/[clubId]/workspace')
  assert.equal(routeTemplate('/q/sharecode'), '/q/[code]')
  assert.equal(routeTemplate('/voting/rooms/new'), '/voting/rooms/new', 'static segments win')
  assert.equal(routeTemplate('/voting/rooms/abc'), '/voting/rooms/[sessionId]')
  assert.equal(routeTemplate('/platform/claims'), '/platform/claims')
  assert.equal(routeTemplate('/platform/student@virginia.edu'), '/platform/[section]')
  assert.equal(routeTemplate('/'), '/'); assert.equal(routeTemplate('/home/'), '/home')
  assert.equal(routeTemplate('/student@virginia.edu/x/y'), 'other')
})

test('vitals become route-tagged distributions; other metrics and bad values are dropped', () => {
  assert.deepEqual(vitals.webVitalMetric({ name: 'LCP', value: 1234.5, rating: 'good' }, '/club/consulting-club'),
    { name: 'web_vital.lcp', value: 1234.5, unit: 'millisecond', attributes: { route: '/club/[clubId]', rating: 'good' } })
  assert.deepEqual(vitals.webVitalMetric({ name: 'CLS', value: 0.12, rating: 'needs-improvement' }, '/home'),
    { name: 'web_vital.cls', value: 0.12, attributes: { route: '/home', rating: 'needs-improvement' } })
  for (const name of ['INP', 'FCP', 'TTFB']) assert.equal(vitals.webVitalMetric({ name, value: 10 }, '/explore').name, `web_vital.${name.toLowerCase()}`)
  assert.equal(vitals.webVitalMetric({ name: 'Next.js-hydration', value: 10 }, '/home'), null)
  assert.equal(vitals.webVitalMetric({ name: 'LCP', value: NaN }, '/home'), null)
  assert.equal(vitals.webVitalMetric({ name: 'LCP', value: 5, rating: 'tag-secret' }, '/home').attributes.rating, undefined)
})

test('vitals are sampled per page load in production only', () => {
  assert.ok(vitals.WEB_VITALS_SAMPLE_RATE > 0 && vitals.WEB_VITALS_SAMPLE_RATE <= 0.5)
  assert.equal(vitals.sampleWebVitals('production', 0), true)
  assert.equal(vitals.sampleWebVitals('production', 0.99), false)
  for (const env of ['preview', 'development', undefined]) assert.equal(vitals.sampleWebVitals(env, 0), false)
})

test('the metric scrubber keeps only web vitals with a route template and drops user attributes', () => {
  assert.equal(s.sentryOptions('dsn', 'production').beforeSendMetric, s.scrubMetric)
  const kept = s.scrubMetric({ name: 'web_vital.inp', type: 'distribution', value: 80, unit: 'millisecond', attributes: {
    route: '/club/[clubId]', rating: 'good', 'user.id': 'u1', 'user.email': 'student@virginia.edu', 'user.name': 'Student', 'sentry.release': 'r1', 'sentry.environment': 'production', url: '/club/consulting-club?x=1' } })
  assert.deepEqual(kept, { name: 'web_vital.inp', value: 80, type: 'distribution', unit: 'millisecond', attributes: { route: '/club/[clubId]', rating: 'good', 'sentry.release': 'r1', 'sentry.environment': 'production' } })
  assert.equal(s.scrubMetric({ name: 'custom.thing', type: 'distribution', value: 1, attributes: { route: '/home' } }), null)
  assert.equal(s.scrubMetric({ name: 'web_vital.lcp', type: 'counter', value: 1, attributes: { route: '/home' } }), null)
  for (const route of ['/club/consulting-club-4f9c2e1a', '/club/4f9c2e1a-0b2c-4d1e-8f00-123456789abc', '/q/AbC123', '/home?x=1', 'student@virginia.edu', undefined])
    assert.equal(s.scrubMetric({ name: 'web_vital.lcp', type: 'distribution', value: 1, attributes: { route } }), null, String(route))
  for (const route of ['/', 'other', '/club/[clubId]/workspace']) assert.ok(s.scrubMetric({ name: 'web_vital.lcp', type: 'distribution', value: 1, attributes: { route } }), route)
})

test('the reporter is mounted only with a DSN, sends only through Sentry, and adds no script tag or dependency', () => {
  const layout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8')
  assert.match(layout, /process\.env\.NEXT_PUBLIC_SENTRY_DSN && <WebVitalsReporter \/>/)
  const reporter = fs.readFileSync(path.join(root, 'components/web-vitals-reporter.tsx'), 'utf8')
  assert.match(reporter, /from "next\/web-vitals"/); assert.match(reporter, /import\("@sentry\/nextjs"\)/)
  assert.doesNotMatch(reporter, /fetch\(|sendBeacon|<script/)
  assert.match(reporter, /webVitalMetric\(metric, landing\)/, 'the template comes from routeTemplate, never the raw URL')
})

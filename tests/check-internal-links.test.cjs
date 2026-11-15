const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const links = require('../scripts/check-internal-links.cjs')

const origin = 'http://127.0.0.1:3107'
const site = ['https://www.out-class.net', 'https://out-class.net']

test('loopback guard accepts only local hosts', () => {
  for (const ok of ['http://127.0.0.1:3107', 'http://localhost:3000/x', 'http://[::1]:8080', 'http://127.4.5.6'])
    assert.equal(links.assertLoopbackBase(ok), new URL(ok).origin)
  for (const bad of ['https://www.out-class.net', 'http://10.0.0.1', 'http://127.0.0.1.evil.test', 'http://localhost.evil.test', 'ftp://127.0.0.1', 'http://u:p@127.0.0.1', 'not a url'])
    assert.throws(() => links.assertLoopbackBase(bad), undefined, bad)
})

test('normalizes links: same-origin, site-origin rebasing, external and ignored', () => {
  const page = `${origin}/about`
  assert.deepEqual(links.normalizeLink('/uva#faq', page, origin, site), { kind: 'internal', url: `${origin}/uva` })
  assert.deepEqual(links.normalizeLink('explore?x=1&amp;y=2', `${origin}/club/a`, origin, site), { kind: 'internal', url: `${origin}/club/explore?x=1&y=2` })
  assert.deepEqual(links.normalizeLink('https://www.out-class.net/club/1?a=b#h', page, origin, site), { kind: 'internal', url: `${origin}/club/1?a=b`, rebased: true })
  assert.equal(links.normalizeLink('https://example.com/', page, origin, site).kind, 'external')
  assert.equal(links.normalizeLink('http://127.0.0.1:9999/', page, origin, site).kind, 'external')
  for (const ignored of ['', '#top', 'mailto:hello@out-class.net', 'tel:+1', 'javascript:void(0)'])
    assert.equal(links.normalizeLink(ignored, page, origin, site).kind, 'ignore', ignored)
})

test('reads the real legal-page and site-origin constants', () => {
  assert.equal(links.readLegalPagesPublic('export const LEGAL_PAGES_PUBLIC = false'), false)
  assert.equal(links.readLegalPagesPublic('export const LEGAL_PAGES_PUBLIC = true\n'), true)
  assert.throws(() => links.readLegalPagesPublic('nothing'))
  assert.equal(typeof links.readLegalPagesPublic(), 'boolean')
  assert.ok(links.readSiteOrigins().includes('https://www.out-class.net'))
  assert.equal(links.isHiddenLegalPath('/privacy', false), true)
  assert.equal(links.isHiddenLegalPath('/terms/', false), true)
  assert.equal(links.isHiddenLegalPath('/legal/x', false), true)
  assert.equal(links.isHiddenLegalPath('/privacy-settings', false), false)
  assert.equal(links.isHiddenLegalPath('/privacy', true), false)
})

test('extracts anchors, canonical and og:url; samples id-like routes', () => {
  const html = `<link rel="canonical" href="https://www.out-class.net/about"/><meta property="og:url" content='/about'/><a class="x" href="/uva">U</a><a name="n">no href</a><link rel="icon" href="/icon"/>`
  assert.deepEqual(links.extractLinks(html), [
    { type: 'canonical', href: 'https://www.out-class.net/about' }, { type: 'og:url', href: '/about' }, { type: 'a', href: '/uva' },
  ])
  assert.deepEqual(links.extractSitemapLocs('<url><loc>https://www.out-class.net/</loc></url><url><loc> https://www.out-class.net/club/a&amp;b </loc></url>'), ['https://www.out-class.net/', 'https://www.out-class.net/club/a&b'])
  assert.equal(links.routeShape('/club/3f2c1a9e-1111-4222-8333-444455556666'), '/club/:id')
  assert.equal(links.routeShape('/about'), '/about')
  assert.equal(links.isSkipped('/api/auth/logout'), true)
})

test('crawls a loopback fixture and reports broken and hidden-legal links', async () => {
  const pages = {
    '/': '<a href="/about">a</a><a href="/missing">m</a><a href="/old">o</a><a href="mailto:x@y.z">x</a><a href="/api/auth/logout">l</a>',
    '/about': '<link rel="canonical" href="https://www.out-class.net/about"><a href="/privacy">p</a>',
    '/explore': '<a href="/">home</a>', '/login': 'ok', '/uva': 'ok', '/request-school': 'ok',
  }
  let apiRequested = false
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname.startsWith('/api/')) apiRequested = true
    if (url.pathname === '/old') { res.writeHead(308, { location: '/about' }); return res.end() }
    if (url.pathname === '/sitemap.xml') { res.writeHead(200, { 'content-type': 'application/xml' }); return res.end('<urlset><url><loc>https://www.out-class.net/uva</loc></url></urlset>') }
    if (pages[url.pathname] !== undefined) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(pages[url.pathname]) }
    res.writeHead(404, { 'content-type': 'text/html' }); res.end('nf')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const summary = await links.crawl({ base: `http://127.0.0.1:${server.address().port}`, log: () => {} })
    assert.equal(apiRequested, false)
    assert.ok(summary.failures.some(f => f.startsWith('/missing -> 404 (linked from /')), summary.failures.join('\n'))
    if (!summary.legalPublic) assert.ok(summary.failures.some(f => f === '/about links to hidden legal page /privacy (a)'), summary.failures.join('\n'))
    assert.equal(summary.failures.some(f => f.startsWith('/old') || f.startsWith('/privacy ->')), false, 'redirects resolve and the hidden page 404 is expected')
    assert.equal(summary.truncated, false)
  } finally { server.close() }
})

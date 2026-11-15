#!/usr/bin/env node
// Internal broken-link crawler for a locally started OutClass app (signed out, loopback only).
//
//   node scripts/check-internal-links.cjs --base http://127.0.0.1:3107 [--max-pages 200] [--deadline-ms 50000]
//
// Starts from /, /about, /explore, /login, /uva, /request-school and every /sitemap.xml entry, fetches
// each same-origin page without credentials, and fails when a same-origin <a href>, <link
// rel=canonical> or <meta property=og:url> target ends (after same-origin redirects) at a status >= 400.
// While LEGAL_PAGES_PUBLIC (lib/legal-content.ts) is false the hidden legal pages are expected to 404,
// and any page that links to them fails the check. Absolute URLs on the production site origin
// (lib/seo.ts SITE_URL, as canonical/og:url/sitemap entries use) are checked by path against the
// local app: production is never requested. Requests never leave loopback.
const fs = require('node:fs')
const path = require('node:path')

const repo = path.resolve(__dirname, '..')
const SEEDS = ['/', '/about', '/explore', '/login', '/uva', '/request-school']
const HIDDEN_LEGAL = ['/privacy', '/terms', '/cookies', '/legal']
// Never requested: GET handlers with side effects (logout, demo mode, OAuth start) or private APIs.
const SKIP_PREFIXES = ['/api/', '/auth/', '/_next/']
// Dynamic pages (e.g. hundreds of /club/<id> from the sitemap) are sampled per route shape.
const PER_SHAPE_LIMIT = 5

function readLegalPagesPublic(source = fs.readFileSync(path.join(repo, 'lib/legal-content.ts'), 'utf8')) {
  const match = source.match(/export const LEGAL_PAGES_PUBLIC\s*=\s*(true|false)\b/)
  if (!match) throw Error('LEGAL_PAGES_PUBLIC not found in lib/legal-content.ts')
  return match[1] === 'true'
}

function readSiteOrigins(source = fs.readFileSync(path.join(repo, 'lib/seo.ts'), 'utf8')) {
  const match = source.match(/export const SITE_URL\s*=\s*"([^"]+)"/)
  if (!match) throw Error('SITE_URL not found in lib/seo.ts')
  const site = new URL(match[1])
  const apex = site.hostname.replace(/^www\./, '')
  return [...new Set([site.origin, `${site.protocol}//${apex}`, `${site.protocol}//www.${apex}`])]
}

function isLoopbackHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)
}

function assertLoopbackBase(base) {
  let url
  try { url = new URL(base) } catch { throw Error(`Invalid base URL: ${base}`) }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw Error(`Base URL must be http(s): ${base}`)
  if (!isLoopbackHost(url.hostname)) throw Error(`Refusing to crawl a non-loopback base URL: ${url.origin}`)
  if (url.username || url.password) throw Error('Base URL must not carry credentials')
  return url.origin
}

function decodeEntities(value) {
  return value.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&#47;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

// Classify a raw href found on `pageUrl`. Returns {kind:'internal', url} with the hash removed and the
// URL rebased onto `origin` (for production-site absolute links), {kind:'external'} or {kind:'ignore'}.
function normalizeLink(raw, pageUrl, origin, siteOrigins = []) {
  const href = decodeEntities(String(raw ?? '').trim())
  if (!href || href.startsWith('#')) return { kind: 'ignore' }
  if (/^(?:mailto|tel|sms|javascript|data|blob):/i.test(href)) return { kind: 'ignore' }
  let url
  try { url = new URL(href, pageUrl) } catch { return { kind: 'invalid', href } }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { kind: 'ignore' }
  url.hash = ''
  if (url.origin === origin) return { kind: 'internal', url: url.toString() }
  if (siteOrigins.includes(url.origin)) return { kind: 'internal', url: new URL(url.pathname + url.search, origin).toString(), rebased: true }
  return { kind: 'external' }
}

function isHiddenLegalPath(pathname, legalPublic) {
  if (legalPublic) return false
  const clean = pathname.replace(/\/+$/, '') || '/'
  return HIDDEN_LEGAL.some(p => clean === p || clean.startsWith(p + '/'))
}

function isSkipped(pathname) { return SKIP_PREFIXES.some(prefix => pathname.startsWith(prefix)) }

// Route shape for sampling: id-like segments (uuid, cuid, long tokens, digits) collapse to ':id'.
function routeShape(pathname) {
  return pathname.split('/').map(s => /^(?:[0-9a-f-]{16,}|c[a-z0-9]{20,}|\d+|[A-Za-z0-9_-]{20,})$/i.test(s) ? ':id' : s).join('/')
}

function extractLinks(html) {
  const links = []
  for (const tag of html.match(/<(?:a|link|meta)\b[^>]*>/gi) || []) {
    const attr = name => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(v => v !== undefined)
    const name = tag.slice(1).split(/[\s>/]/)[0].toLowerCase()
    if (name === 'a') { const href = attr('href'); if (href !== undefined) links.push({ type: 'a', href }) }
    else if (name === 'link' && /(?:^|\s)canonical(?:\s|$)/i.test(attr('rel') || '')) { const href = attr('href'); if (href !== undefined) links.push({ type: 'canonical', href }) }
    else if (name === 'meta' && (attr('property') || attr('name') || '').toLowerCase() === 'og:url') { const href = attr('content'); if (href !== undefined) links.push({ type: 'og:url', href }) }
  }
  return links
}

function extractSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => decodeEntities(m[1]))
}

// GET with manual redirects; follows same-origin redirects only (max 5), never leaves loopback.
async function fetchFollow(url, origin, { timeoutMs = 15000 } = {}) {
  let current = url
  for (let hop = 0; hop <= 5; hop++) {
    const target = new URL(current)
    if (target.origin !== origin || !isLoopbackHost(target.hostname)) return { status: 0, finalUrl: current, offsite: true }
    const response = await fetch(current, { redirect: 'manual', headers: { accept: 'text/html,application/xml;q=0.9,*/*;q=0.8', 'user-agent': 'outclass-internal-link-check' }, signal: AbortSignal.timeout(timeoutMs) })
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      await response.body?.cancel()
      current = new URL(response.headers.get('location'), current).toString()
      continue
    }
    const type = response.headers.get('content-type') || ''
    const body = /html|xml/.test(type) && response.status < 400 ? await response.text() : (await response.body?.cancel(), '')
    return { status: response.status, finalUrl: current, type, body }
  }
  return { status: 0, finalUrl: current, loop: true }
}

async function crawl({ base, maxPages = 200, deadlineMs = 50000, concurrency = 4, log = console.log } = {}) {
  const origin = assertLoopbackBase(base)
  const legalPublic = readLegalPagesPublic(), siteOrigins = readSiteOrigins()
  const started = Date.now()
  const results = new Map() // url -> {status, finalUrl}
  const sources = new Map() // url -> Set(source descriptions)
  const failures = [], notes = []
  const shapes = new Map()
  const queue = []
  const enqueue = (url, source) => {
    if (!sources.has(url)) sources.set(url, new Set())
    sources.get(url).add(source)
    if (results.has(url) || queue.includes(url)) return
    const { pathname } = new URL(url)
    if (isSkipped(pathname)) return
    const shape = routeShape(pathname)
    const seen = shapes.get(shape) || 0
    if (shape.includes(':id') && seen >= PER_SHAPE_LIMIT) return
    shapes.set(shape, seen + 1)
    queue.push(url)
  }

  for (const seed of SEEDS) enqueue(new URL(seed, origin).toString(), 'seed')
  try {
    const sitemap = await fetchFollow(new URL('/sitemap.xml', origin).toString(), origin)
    if (sitemap.status >= 400 || sitemap.status === 0) failures.push(`/sitemap.xml returned ${sitemap.status}`)
    for (const loc of extractSitemapLocs(sitemap.body || '')) {
      const link = normalizeLink(loc, origin + '/', origin, siteOrigins)
      if (link.kind === 'internal') enqueue(link.url, 'sitemap.xml')
      else failures.push(`sitemap.xml lists a non-site URL: ${loc}`)
      if (link.kind === 'internal' && isHiddenLegalPath(new URL(link.url).pathname, legalPublic)) failures.push(`sitemap.xml lists hidden legal page ${new URL(link.url).pathname}`)
    }
  } catch (error) { failures.push(`/sitemap.xml could not be fetched: ${error.message}`) }

  let truncated = false, inFlight = 0
  async function worker() {
    while (queue.length || inFlight) {
      if (results.size + inFlight >= maxPages || Date.now() - started > deadlineMs) { truncated = true; return }
      if (!queue.length) { await new Promise(resolve => setTimeout(resolve, 20)); continue }
      const url = queue.shift()
      inFlight++
      try { await visit(url) } finally { inFlight-- }
    }
  }
  async function visit(url) {
    let result
    try { result = await fetchFollow(url, origin) } catch (error) { result = { status: 0, error: error.message, finalUrl: url } }
    results.set(url, result)
    const { pathname } = new URL(url)
    if (isHiddenLegalPath(pathname, legalPublic)) {
      if (result.status !== 404) failures.push(`${pathname} is hidden (LEGAL_PAGES_PUBLIC=false) but returned ${result.status}`)
      return
    }
    if (result.offsite) { notes.push(`${pathname} redirects off-site (not followed)`); return }
    if (result.status === 0 || result.status >= 400) return // reported below with its sources
    const finalPath = new URL(result.finalUrl).pathname
    if (!/html/.test(result.type || '') || isSkipped(finalPath)) return
    for (const link of extractLinks(result.body)) {
      const normalized = normalizeLink(link.href, result.finalUrl, origin, siteOrigins)
      if (normalized.kind === 'invalid') { failures.push(`${finalPath}: invalid ${link.type} ${link.href}`); continue }
      if (normalized.kind !== 'internal') continue
      const target = new URL(normalized.url).pathname
      if (isHiddenLegalPath(target, legalPublic)) failures.push(`${finalPath} links to hidden legal page ${target} (${link.type})`)
      enqueue(normalized.url, `${finalPath} (${link.type})`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  if (queue.length) truncated = true

  for (const [url, result] of results) {
    const { pathname, search } = new URL(url)
    if (isHiddenLegalPath(pathname, legalPublic) || result.offsite) continue
    if (result.status === 0 || result.status >= 400) {
      failures.push(`${pathname}${search} -> ${result.loop ? 'redirect loop' : result.error || result.status} (linked from ${[...(sources.get(url) || [])].slice(0, 5).join(', ')})`)
    }
  }
  const summary = { origin, legalPublic, checked: results.size, unvisited: queue.length, truncated, seconds: Math.round((Date.now() - started) / 100) / 10, failures: [...new Set(failures)], notes }
  log(`Checked ${summary.checked} same-origin URLs on ${origin} in ${summary.seconds}s (LEGAL_PAGES_PUBLIC=${legalPublic}).`)
  if (truncated) log(`Stopped at the page/time cap with ${summary.unvisited} URLs unvisited.`)
  for (const note of notes) log(`note: ${note}`)
  return summary
}

function parseArgs(argv) {
  const value = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
  return {
    base: value('--base') || process.env.OUTCLASS_LINK_CHECK_BASE_URL,
    maxPages: Number(value('--max-pages') || 200),
    deadlineMs: Number(value('--deadline-ms') || 50000),
  }
}

module.exports = { readLegalPagesPublic, readSiteOrigins, isLoopbackHost, assertLoopbackBase, normalizeLink, isHiddenLegalPath, isSkipped, routeShape, extractLinks, extractSitemapLocs, crawl, parseArgs, HIDDEN_LEGAL }

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2))
  if (!options.base) { console.error('Usage: node scripts/check-internal-links.cjs --base http://127.0.0.1:<port>'); process.exit(2) }
  crawl(options).then(summary => {
    if (summary.failures.length) {
      console.error(`${summary.failures.length} internal link problem(s):`)
      for (const failure of summary.failures) console.error(`  - ${failure}`)
      process.exitCode = 1
    } else console.log('No broken internal links.')
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}

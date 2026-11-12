// Static internal-link check: every literal href="/..." / href={`/...`} and router.push|replace("/...")
// in app/ and components/ must resolve to an App Router route, a metadata route, a public/ file or a
// next.config.mjs redirect source. Template `${...}` parts match dynamic segments. Runs in `pnpm test`;
// scripts/check-internal-links.cjs crawls the built app in CI for the runtime half.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repo = path.resolve(__dirname, '..')
const HOLE = '\u0000' // stands for a `${...}` template expression

// Legitimate targets that are neither App Router routes, public/ files nor redirect sources, as
// [pathname, reason]. Empty today: every literal target resolves. (/privacy and /terms are real
// routes that 404 while LEGAL_PAGES_PUBLIC is false; their only links sit inside the footer's
// `LEGAL_PAGES_PUBLIC &&` column, and the CI crawler fails if a rendered page links to them.)
const ALLOWLIST = new Map([
  // ['/example', 'why this target is valid without a route'],
])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

// Route patterns as segment arrays; segments: {static} | {dynamic} | {catchAll, optional}.
function appRoutes() {
  const routes = []
  const metadata = { 'sitemap': 'sitemap.xml', 'robots': 'robots.txt', 'manifest': 'manifest.webmanifest', 'icon': 'icon', 'apple-icon': 'apple-icon', 'opengraph-image': 'opengraph-image', 'twitter-image': 'twitter-image' }
  for (const file of walk(path.join(repo, 'app'))) {
    const rel = path.relative(path.join(repo, 'app'), file).split(path.sep)
    const base = rel.pop().replace(/\.(tsx|ts|jsx|js|mdx)$/, '')
    let leaf
    if (base === 'page' || base === 'route') leaf = null
    else if (metadata[base] && /\.(tsx|ts|jsx|js)$/.test(file)) leaf = metadata[base]
    else continue
    const segments = rel.filter(s => !/^\(.*\)$/.test(s) && !s.startsWith('@')).map(s => {
      if (/^\[\[\.\.\..+\]\]$/.test(s)) return { catchAll: true, optional: true }
      if (/^\[\.\.\..+\]$/.test(s)) return { catchAll: true }
      if (/^\[.+\]$/.test(s)) return { dynamic: true }
      return { static: s }
    })
    if (leaf) segments.push({ static: leaf })
    routes.push(segments)
  }
  return routes
}

function staticPaths() {
  const paths = new Set()
  for (const file of walk(path.join(repo, 'public'))) paths.add('/' + path.relative(path.join(repo, 'public'), file).split(path.sep).join('/'))
  const config = fs.readFileSync(path.join(repo, 'next.config.mjs'), 'utf8')
  const redirects = config.slice(config.indexOf('async redirects()'), config.indexOf('async headers()'))
  for (const [, source] of redirects.matchAll(/source:\s*"([^"]+)"/g)) if (!source.includes(':')) paths.add(source)
  return paths
}

function segmentMatches(target, route) {
  if (route.dynamic) return target.length > 0
  if (target === HOLE) return true
  if (!target.includes(HOLE)) return target === route.static
  const pattern = new RegExp('^' + target.split(HOLE).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
  return pattern.test(route.static)
}

function matchRoute(targetSegments, routeSegments) {
  const go = (t, r) => {
    if (r === routeSegments.length) return t === targetSegments.length
    const route = routeSegments[r]
    if (route.catchAll) {
      for (let end = targetSegments.length; end >= t + (route.optional ? 0 : 1); end--) if (go(end, r + 1)) return true
      return false
    }
    if (t === targetSegments.length) return false
    // A hole may stand for several segments (`${a}/${b}` or a computed sub-path).
    if (targetSegments[t] === HOLE && go(t + 1, r + 1)) return true
    if (targetSegments[t] === HOLE && t + 1 < targetSegments.length && go(t + 1, r)) return true
    return segmentMatches(targetSegments[t], route) && go(t + 1, r + 1)
  }
  return go(0, 0)
}

// Reads a JS string/template literal starting at `source[i]` (a quote char). Template expressions
// become HOLE. Returns {value, end} or null.
function readLiteral(source, i) {
  const quote = source[i]
  if (!`"'\``.includes(quote)) return null
  let value = '', j = i + 1
  while (j < source.length) {
    const c = source[j]
    if (c === '\\') { value += source[j + 1]; j += 2; continue }
    if (c === quote) return { value, end: j + 1 }
    if (quote === '`' && c === '$' && source[j + 1] === '{') {
      let depth = 1; j += 2
      while (j < source.length && depth) {
        const d = source[j]
        if (d === '"' || d === "'" || d === '`') { const inner = readLiteral(source, j); if (!inner) return null; j = inner.end; continue }
        if (d === '{') depth++
        else if (d === '}') depth--
        j++
      }
      value += HOLE
      continue
    }
    if (quote !== '`' && c === '\n') return null
    value += c; j++
  }
  return null
}

function collectTargets(source) {
  const found = []
  const re = /\bhref=\{?\s*|\brouter\.(?:push|replace)\(\s*/g
  let match
  while ((match = re.exec(source))) {
    const literal = readLiteral(source, match.index + match[0].length)
    if (!literal || !literal.value.startsWith('/') || literal.value.startsWith('//')) continue
    // Only a whole-literal target: skip `"/a" + x` concatenations and ternaries we cannot resolve.
    const after = source.slice(literal.end).match(/^\s*(\S)/)?.[1]
    if (match[0].startsWith('href={') && after && !'})'.includes(after)) continue
    found.push({ target: literal.value, line: source.slice(0, match.index).split('\n').length })
  }
  return found
}

function pathSegments(target) {
  const pathname = target.split(/[?#]/)[0]
  return pathname.split('/').slice(1).filter((s, i, all) => s !== '' || i < all.length - 1)
}

function resolves(target, routes, files) {
  const pathname = target.split(/[?#]/)[0] || '/'
  if (ALLOWLIST.has(pathname) || files.has(pathname)) return true
  const segments = pathname === '/' ? [] : pathSegments(pathname)
  return routes.some(route => matchRoute(segments, route))
}

test('literal internal hrefs and router targets resolve to an app route', () => {
  const routes = appRoutes(), files = staticPaths()
  assert.ok(routes.length > 40, 'route discovery found the App Router tree')
  const broken = []
  let checked = 0
  for (const dir of ['app', 'components']) {
    for (const file of walk(path.join(repo, dir))) {
      if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue
      for (const { target, line } of collectTargets(fs.readFileSync(file, 'utf8'))) {
        checked++
        if (!resolves(target, routes, files)) broken.push(`${path.relative(repo, file)}:${line} ${target.replaceAll(HOLE, '${…}')}`)
      }
    }
  }
  assert.ok(checked > 50, `expected to check many internal links, found ${checked}`)
  assert.deepEqual(broken, [], `internal links without a matching route:\n${broken.join('\n')}`)
})

test('route matcher handles groups, dynamic segments, catch-alls and holes', () => {
  const routes = appRoutes(), files = staticPaths()
  for (const ok of ['/', '/about', '/explore', '/club/abc', `/club/${HOLE}/workspace?section=${HOLE}`, '/platform/permissions?clubId=1', '/sitemap.xml', '/icon.png', '/licenses/phosphor-icons-MIT.txt', `/club/${HOLE}/opengraph-image`])
    assert.equal(resolves(ok, routes, files), true, ok)
  for (const bad of ['/nope', '/club', '/club/a/b/c/d', '/settings/missing', '/about/extra'])
    assert.equal(resolves(bad, routes, files), false, bad)
  assert.deepEqual(collectTargets('<a href="/x">x</a> <Link href={`/club/${encodeURIComponent(id)}/workspace?s=${a ? `b` : "c"}`}/> router.push("/home") <a href={"/y" + z}/>').map(t => t.target), ['/x', `/club/${HOLE}/workspace?s=${HOLE}`, '/home'])
})

const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), zlib = require('node:zlib'), ts = require('typescript');
const { EventEmitter } = require('node:events'), { PassThrough } = require('node:stream');
function load(file, mocks = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.slice(2) + '.ts', mocks) : require(n), m, m.exports); return m.exports; }

const safe = load('lib/club-website-import/safe-fetch.ts');
const extract = load('lib/club-website-import/extract.ts');
const { mergeImportedProfile } = load('lib/club-website-import/merge.ts');
const { profileDraft, clubProfileSchema } = load('lib/club-marketing.ts');

/** A transport double: `routes` maps a URL to { status, headers, body }. Records each request URL. */
function transport(routes) {
  const seen = [];
  const request = (url, _options, callback) => {
    const key = String(url); seen.push(key);
    const route = typeof routes === 'function' ? routes(key) : routes[key];
    const req = new EventEmitter();
    req.destroy = error => { if (error) req.emit('error', error); };
    req.end = () => setImmediate(() => {
      if (!route) return req.emit('error', Object.assign(new Error('not found'), { code: 'ENOTFOUND' }));
      const res = new PassThrough(); res.statusCode = route.status ?? 200; res.headers = route.headers ?? {};
      res.complete = true; callback(res); res.end(route.body ?? '');
    });
    return req;
  };
  return { request, seen };
}
const html = body => ({ headers: { 'content-type': 'text/html; charset=utf-8' }, body });

test('only public http(s) addresses on default ports pass the URL check', () => {
  for (const bad of ['http://localhost/', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://[fd00::1]/', 'http://metadata.google.internal/', 'http://printer.local/', 'http://intranet/', 'http://0.0.0.0/', 'http://100.64.0.1/'])
    assert.throws(() => safe.assertPublicHttpUrl(bad), err => err.code === 'BLOCKED_ADDRESS', bad);
  for (const bad of ['ftp://example.org/', 'javascript:alert(1)', 'file:///etc/passwd', 'https://user:pw@example.org/', 'https://example.org:8443/', 'not a url'])
    assert.throws(() => safe.assertPublicHttpUrl(bad), err => err.code === 'INVALID_URL', bad);
  assert.equal(safe.assertPublicHttpUrl('https://example.org/club#about').toString(), 'https://example.org/club');
  assert.equal(safe.assertPublicHttpUrl('http://93.184.216.34:80/').hostname, '93.184.216.34');
  for (const ok of ['8.8.8.8', '2606:4700::1111']) assert.equal(safe.isBlockedAddress(ok), false, ok);
  for (const blocked of ['192.168.1.1', '172.20.0.1', 'fe80::1', '::ffff:10.0.0.1', '64:ff9b::a00:1', 'not-an-ip']) assert.equal(safe.isBlockedAddress(blocked), true, blocked);
});

test('the socket lookup refuses a host when any resolved address is private (DNS rebinding)', async () => {
  const resolver = answers => (_host, _options, callback) => callback(null, answers);
  const run = (answers, options) => new Promise(resolve => safe.publicOnlyLookup(resolver(answers))('club.example', options, (error, address, family) => resolve({ error, address, family })));
  assert.equal((await run([{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }], {})).error.code, 'EBLOCKED');
  assert.equal((await run([{ address: '::1', family: 6 }], { all: true })).error.code, 'EBLOCKED');
  assert.deepEqual(await run([{ address: '93.184.216.34', family: 4 }], {}), { error: null, address: '93.184.216.34', family: 4 });
  assert.deepEqual((await run([{ address: '93.184.216.34', family: 4 }], { all: true })).address, [{ address: '93.184.216.34', family: 4 }]);
});

test('redirects are re-checked, and size, type and redirect limits hold', async () => {
  const opts = (request, extra = {}) => ({ accept: ['text/html'], maxBytes: 1000, request, ...extra });
  let t = transport({ 'https://club.example/': { status: 302, headers: { location: 'http://127.0.0.1/admin' } } });
  await assert.rejects(safe.safeFetch('https://club.example/', opts(t.request)), err => err.code === 'BLOCKED_ADDRESS');
  assert.deepEqual(t.seen, ['https://club.example/']);
  t = transport({ 'https://club.example/': { status: 301, headers: { location: '/about' } }, 'https://club.example/about': html('<p>hi</p>') });
  const ok = await safe.safeFetch('https://club.example/', opts(t.request));
  assert.equal(ok.url.toString(), 'https://club.example/about'); assert.equal(ok.body.toString(), '<p>hi</p>'); assert.equal(ok.charset, 'utf-8');
  t = transport(url => ({ status: 302, headers: { location: url + 'x' } }));
  await assert.rejects(safe.safeFetch('https://club.example/', opts(t.request, { maxRedirects: 2 })), err => err.code === 'TOO_MANY_REDIRECTS');
  t = transport({ 'https://club.example/': html('x'.repeat(5000)) });
  await assert.rejects(safe.safeFetch('https://club.example/', opts(t.request)), err => err.code === 'TOO_LARGE');
  t = transport({ 'https://club.example/': { headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' }, body: zlib.gzipSync('a'.repeat(50000)) } });
  await assert.rejects(safe.safeFetch('https://club.example/', opts(t.request)), err => err.code === 'TOO_LARGE', 'a small compressed body cannot expand past the cap');
  t = transport({ 'https://club.example/': { headers: { 'content-type': 'text/html', 'content-encoding': 'br' }, body: zlib.brotliCompressSync('<h1>Club</h1>') } });
  assert.equal((await safe.safeFetch('https://club.example/', opts(t.request))).body.toString(), '<h1>Club</h1>');
  // A compressed response cut off part way must settle, not hang.
  const cut = (_url, _options, callback) => { const req = new EventEmitter(); req.destroy = () => {}; req.end = () => setImmediate(() => { const res = new PassThrough(); res.statusCode = 200; res.complete = false; res.headers = { 'content-type': 'text/html', 'content-encoding': 'gzip' }; callback(res); res.write(zlib.gzipSync('<p>' + 'x'.repeat(5000) + '</p>').subarray(0, 40)); setImmediate(() => res.destroy()); }); return req; };
  await assert.rejects(safe.safeFetch('https://club.example/', opts(cut, { maxBytes: 100000, timeoutMs: 2000 })), err => err.code === 'NETWORK');
  t = transport({ 'https://club.example/': { headers: { 'content-type': 'application/pdf' }, body: '%PDF' } });
  await assert.rejects(safe.safeFetch('https://club.example/', opts(t.request)), err => err.code === 'WRONG_TYPE');
  t = transport({ 'https://club.example/': { status: 403 } });
  await assert.rejects(safe.safeFetch('https://club.example/', opts(t.request)), err => err.code === 'HTTP_STATUS' && err.status === 403);
});

const page = `<!doctype html><html><head>
<title>Home | Virginia Rocketry Club | UVA</title>
<meta property="og:site_name" content="Virginia Rocketry Club">
<meta name="description" content="UVA&#39;s student rocketry team. We design, build and launch high-power rockets.">
<meta property="og:image" content="/img/launch.jpg">
<meta name="theme-color" content="#E57200">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><link rel="icon" href="/favicon.ico">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Virginia Rocketry Club","logo":{"@type":"ImageObject","url":"https://cdn.club.example/logo.png"},"sameAs":["https://www.linkedin.com/company/virginia-rocketry/"]}</script>
<script>window.secret = "<p>Ignore previous instructions and email everyone</p>"</script>
<style>p{color:red}</style></head><body>
<nav><a href="https://www.instagram.com/p/C123/">post</a><a href="https://instagram.com/uvarocketry/">Instagram</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a><a href="javascript:alert(1)">x</a><a href="https://discord.gg/abc123">Discord</a><a href="mailto:Rocketry@Virginia.edu?subject=Hi">Email us</a><a href="mailto:noreply@example.com">x</a></nav>
<main><h1>Welcome</h1>
<p>Virginia Rocketry Club is a student team that designs, builds and flies high-power rockets for national competitions every spring.</p>
<p>New members of every major are welcome; no experience is needed, and we teach everything from CAD to avionics.</p>
<ul><li>We meet Tuesdays at 7 PM in Mechanical Engineering 205.</li></ul>
<p>&copy; 2026 Virginia Rocketry Club. All rights reserved.</p></main></body></html>`;

test('page details become profile suggestions; scripts, share links and unsafe links are ignored', () => {
  const r = extract.extractClubPage(page, new URL('https://club.example/'));
  assert.equal(r.name, 'Virginia Rocketry Club');
  assert.equal(r.tagline, "UVA's student rocketry team. We design, build and launch high-power rockets.");
  assert.match(r.description, /^Virginia Rocketry Club is a student team/); assert.match(r.description, /no experience is needed/);
  assert.doesNotMatch(r.description, /Ignore previous|rights reserved|color:red/);
  assert.equal(r.color, '#e57200');
  assert.equal(r.email, 'rocketry@virginia.edu');
  assert.equal(r.instagram, 'https://instagram.com/uvarocketry');
  assert.equal(r.linkedin, 'https://linkedin.com/company/virginia-rocketry');
  assert.deepEqual(r.links, [{ label: 'Discord', url: 'https://discord.gg/abc123' }]);
  assert.equal(r.commitment, 'We meet Tuesdays at 7 PM in Mechanical Engineering 205.');
  assert.deepEqual(r.logoCandidates, ['https://cdn.club.example/logo.png', 'https://club.example/apple-touch-icon.png']);
  assert.deepEqual(r.bannerCandidates, ['https://club.example/img/launch.jpg']);
  assert.equal(r.website, 'https://club.example');
  assert.ok(!JSON.stringify(r).includes('javascript:'));
});

test('names come from the useful part of a title, and weak theme colors are dropped', () => {
  assert.equal(extract.clubNameFromTitle('Home - Chess Club at UVA'), 'Chess Club at UVA');
  assert.equal(extract.clubNameFromTitle('Welcome to the Debate Society | Official Website'), 'Debate Society');
  const bare = extract.extractClubPage('<title>About | Sailing Team</title><meta name="theme-color" content="#ffffff"><p>short</p>', new URL('http://sail.example/about?utm=1'));
  assert.equal(bare.name, 'Sailing Team'); assert.equal(bare.color, null); assert.equal(bare.description, '');
  assert.equal(extract.socialLink('https://twitter.com/intent/tweet?text=x'), null);
  assert.deepEqual(extract.socialLink('https://m.facebook.com/uvasailing/?ref=page'), { label: 'Facebook', url: 'https://facebook.com/uvasailing' });
  assert.equal(extract.absoluteHttps(' JaVaScRiPt:alert(1)', new URL('https://a.example/')), null);
  assert.equal(extract.clip('One sentence here. Another that runs much longer than the limit allows.', 30), 'One sentence here.');
  assert.equal(extract.decodeHtml(Buffer.from('<meta charset="windows-1252"><p>caf\xe9</p>', 'latin1'), null).includes('café'), true);
});

test('an About block wins over event cards; a page that renders in the browser still yields its metadata', () => {
  const events = Array.from({ length: 5 }, (_, i) => `<div class="card"><p>Workshop ${i}: an evening session on something unrelated to what the club is about overall.</p></div>`).join('');
  const r = extract.extractClubPage(`<h1>About Us...</h1>${events}<section id="about-us"><h3>Who we are</h3><p>The Trail Club takes UVA students hiking and climbing across the Blue Ridge every weekend.</p></section><section><p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod.</p></section>`, new URL('https://trail.example/'));
  assert.equal(r.name, '', 'a generic heading is not a club name');
  assert.equal(r.description, 'The Trail Club takes UVA students hiking and climbing across the Blue Ridge every weekend.');
  const spa = extract.extractClubPage('<head><meta property="og:title" content="Debate Society"><meta property="og:description" content="UVA debate since 1825."></head><body><div id="root"></div></body>', new URL('https://debate.example/'));
  assert.equal(spa.name, 'Debate Society'); assert.equal(spa.tagline, 'UVA debate since 1825.');
});

const imported = over => ({ source: 'https://club.example', name: 'Virginia Rocketry Club', tagline: 'We build rockets.', description: 'Long description.', color: '#e57200', website: 'https://club.example', email: 'rocketry@virginia.edu', instagram: 'https://instagram.com/uvarocketry', linkedin: '', links: [{ label: 'Discord', url: 'https://discord.gg/abc123' }], commitment: 'We meet Tuesdays at 7 PM.', logo: null, banner: null, ...over });

test('import fills empty fields only, keeps existing words unless Replace is on, and stays valid', () => {
  const blank = profileDraft({ name: '', category: 'Other' });
  const filled = mergeImportedProfile(blank, imported());
  assert.equal(filled.profile.name, 'Virginia Rocketry Club'); assert.equal(filled.profile.color, '#e57200');
  assert.deepEqual(filled.profile.marketing.links, [{ label: 'Discord', url: 'https://discord.gg/abc123' }]);
  assert.deepEqual(filled.kept, []);
  assert.ok(clubProfileSchema.safeParse(filled.profile).success);
  const existing = profileDraft({ name: 'VRC', description: 'Our own words.', color: '#123456', category: 'Engineering', marketing: { email: 'lead@virginia.edu', links: [{ label: 'Discord', url: 'https://discord.gg/abc123/' }] } });
  const kept = mergeImportedProfile(existing, imported());
  assert.equal(kept.profile.name, 'VRC'); assert.equal(kept.profile.description, 'Our own words.'); assert.equal(kept.profile.color, '#123456'); assert.equal(kept.profile.marketing.email, 'lead@virginia.edu');
  assert.deepEqual(kept.kept, ['club name', 'description', 'accent color', 'email']);
  assert.equal(kept.profile.marketing.links.length, 1, 'an existing link is not added twice');
  assert.equal(existing.description, 'Our own words.', 'the draft passed in is not mutated');
  const replaced = mergeImportedProfile(existing, imported(), { replace: true });
  assert.equal(replaced.profile.description, 'Long description.'); assert.equal(replaced.profile.marketing.email, 'rocketry@virginia.edu');
  const unsafe = mergeImportedProfile(blank, imported({ website: 'javascript:alert(1)', instagram: 'http://instagram.com/x', email: 'not-an-email', links: Array.from({ length: 20 }, (_, i) => ({ label: 'L' + i, url: 'https://l' + i + '.example' })) }));
  assert.equal(unsafe.profile.marketing.website, ''); assert.equal(unsafe.profile.marketing.instagram, ''); assert.equal(unsafe.profile.marketing.email, '');
  assert.equal(unsafe.profile.marketing.links.length, 12);
  assert.ok(clubProfileSchema.safeParse(unsafe.profile).success);
});

test('import reads the page and keeps only real, large-enough raster images', async () => {
  const sharp = require('sharp');
  const png = size => sharp({ create: { width: size, height: size, channels: 3, background: '#e57200' } }).png().toBuffer();
  const wide = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#232d4b' } }).jpeg().toBuffer();
  const routes = {
    'https://club.example/': html(page),
    'https://cdn.club.example/logo.png': { headers: { 'content-type': 'image/png' }, body: '<svg onload=alert(1)>' },
    'https://club.example/apple-touch-icon.png': { headers: { 'content-type': 'image/png' }, body: await png(180) },
    'https://club.example/img/launch.jpg': { headers: { 'content-type': 'image/jpeg' }, body: wide },
  };
  const { importClubWebsite } = load('lib/club-website-import/import.ts');
  const result = await importClubWebsite('club.example', { request: transport(routes).request });
  assert.equal(result.name, 'Virginia Rocketry Club');
  assert.equal(result.logo.source, 'https://club.example/apple-touch-icon.png', 'a fake PNG is skipped for the next candidate');
  assert.equal((await sharp(Buffer.from(result.logo.base64, 'base64')).metadata()).format, 'webp');
  assert.equal(result.banner.source, 'https://club.example/img/launch.jpg');
  const tiny = { ...routes, 'https://club.example/apple-touch-icon.png': { headers: { 'content-type': 'image/png' }, body: await png(32) } };
  assert.equal((await importClubWebsite('https://club.example/', { request: transport(tiny).request })).logo, null, 'a favicon-sized image is not a logo');
  await assert.rejects(importClubWebsite('https://club.example/', { request: transport({ 'https://club.example/': { status: 403 } }).request }), err => err.code === 'WEBSITE_BLOCKED');
  await assert.rejects(importClubWebsite('https://club.example/', { request: transport({ 'https://club.example/': html('<div id="root"></div>') }).request }), err => err.code === 'WEBSITE_EMPTY');
  await assert.rejects(importClubWebsite('http://localhost:3000/'), err => err.code === 'WEBSITE_INVALID_URL');
  await assert.rejects(importClubWebsite('http://169.254.169.254/'), err => err.code === 'WEBSITE_BLOCKED_ADDRESS');
});

test('the import action checks club or platform access and the rate limit before fetching', async () => {
  const calls = []; let limited = false;
  const action = load('actions/club-website-import.ts', {
    '@/utils/auth': { requireClubPermission: async (clubId, permissions) => { calls.push(['club', clubId, permissions]); return { user: { id: 'leader' } } } },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => { calls.push(['admin']); return { id: 'admin' } } },
    '@/lib/rate-limit-action': { limitAction: async (policy, { userId }) => { calls.push(['limit', policy.name, userId]); return { ok: !limited } } },
    '@/lib/club-website-import/import': { importClubWebsite: async url => { calls.push(['import', url]); return { source: url } } },
  });
  const clubId = '00000000-0000-4000-8000-000000000001';
  assert.equal((await action.importClubFromWebsite({ url: 'https://club.example', clubId })).ok, true);
  assert.deepEqual(calls.splice(0), [['club', clubId, ['club.settings']], ['limit', 'club-website-import', 'leader'], ['import', 'https://club.example']]);
  await action.importClubFromWebsite({ url: 'https://club.example' });
  assert.deepEqual(calls.splice(0).map(c => c[0]), ['admin', 'limit', 'import']);
  limited = true;
  const refused = await action.importClubFromWebsite({ url: 'https://club.example' });
  assert.equal(refused.ok, false); assert.equal(refused.code, 'RATE_LIMITED'); assert.ok(!calls.some(c => c[0] === 'import'));
  await assert.rejects(action.importClubFromWebsite({ url: 'https://club.example', clubId: 'nope' }));
});

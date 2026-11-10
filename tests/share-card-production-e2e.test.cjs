// Share-card images from a production build: every asset the renderers read from disk is in each image
// route's function trace (what Vercel bundles), and the routes answer with real PNGs. Runs against the
// disposable onboarding stack, whose app is `next start` on the production build.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { readConfig, randomUUID } = require('./helpers/onboarding-e2e.cjs');

const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
const repo = path.resolve(__dirname, '..');

// Files read with join(process.cwd(), "…") by the shared renderer; the club card falls back to the site card.
function requiredAssets() {
  const source = fs.readFileSync(path.join(repo, 'lib/share-card.tsx'), 'utf8');
  const assets = [...source.matchAll(/join\(process\.cwd\(\),\s*"([^"]+)"\)/g)].map(m => m[1]);
  assert.ok(assets.includes('public/images/campus/sunset-rotunda-1600.webp') && assets.length >= 4, `renderer assets found: ${assets.join(', ')}`);
  return assets;
}

function traced(buildDir, routeDir) {
  const dir = path.join(buildDir, 'server/app', routeDir);
  const nft = path.join(dir, 'route.js.nft.json');
  assert.ok(fs.existsSync(nft), `${routeDir}: function trace exists`);
  return new Set(JSON.parse(fs.readFileSync(nft, 'utf8')).files.map(file => path.relative(repo, path.resolve(dir, file)).split(path.sep).join('/')));
}

async function png(url, label) {
  const response = await fetch(url, { redirect: 'manual' });
  assert.equal(response.status, 200, `${label}: HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /^image\/png/, `${label}: content type`);
  const body = Buffer.from(await response.arrayBuffer());
  assert.deepEqual([...body.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${label}: PNG signature`);
  assert.ok(body.length > 20_000, `${label}: a rendered card, not a placeholder (${body.length} bytes)`);
}

test('share-card images: assets are in each function trace and a production build serves real PNGs', { skip: !configFile, timeout: 120000 }, async t => {
  const config = readConfig(configFile), db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  t.after(() => db.$disconnect());
  const assets = requiredAssets();
  const clubRoutes = fs.readdirSync(path.join(config.buildDir, 'server/app/(workspace)/club/[clubId]')).filter(name => /^(opengraph|twitter)-image/.test(name));
  assert.equal(clubRoutes.length, 2, `club image routes: ${clubRoutes.join(', ')}`);
  for (const route of [...clubRoutes.map(name => `(workspace)/club/[clubId]/${name}`), 'og/outclass.png']) {
    const files = traced(config.buildDir, route);
    for (const asset of assets) assert.ok(files.has(asset), `${route} bundles ${asset}`);
  }

  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const club = await db.club.create({ data: { slug: `share-card-${suffix}`, name: `Share Card ${suffix}`, category: 'Academic', color: '#142D45', tagline: 'Local share-card verification', description: 'Disposable share-card fixture.', claimedAt: new Date() } });
  const page = await fetch(`${config.appUrl}/club/${club.id}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  const meta = name => html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]+)"`))?.[1];
  for (const name of ['og:image', 'twitter:image']) {
    const url = meta(name);
    assert.ok(url, `${name} is declared`);
    const local = new URL(new URL(url).pathname + new URL(url).search, config.appUrl);
    await png(local, `${name} for a real club`);
  }
  const missing = `${config.appUrl}/club/${randomUUID()}/${new URL(meta('og:image')).pathname.split('/').pop()}`;
  await png(missing, 'unknown club falls back to the site card (reads the Rotunda photo)');
  await png(`${config.appUrl}/og/outclass.png`, 'site card');
});

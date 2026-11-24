// Universal links / app links for the native app: only /q and the emailed reset link are claimed, and nothing is published
// until real identifiers are configured.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
const mod = { exports: {} }
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'lib/app-links.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, mod, mod.exports)
const links = mod.exports
const FINGERPRINT = Array.from({ length: 32 }, (_, i) => (i + 16).toString(16).toUpperCase().padStart(2, '0')).join(':')

test('nothing is served until identifiers are configured, and malformed ones are refused', async () => {
  assert.equal(links.appleAppSiteAssociation({}), null)
  assert.equal(links.appleAppSiteAssociation({ OUTCLASS_IOS_APP_ID: 'TEAMID.net.outclass.app' }), null, 'a Team ID is 10 characters')
  assert.equal(links.androidAssetLinks({}), null)
  assert.equal(links.androidAssetLinks({ OUTCLASS_ANDROID_CERT_SHA256: 'REPLACE_ME' }), null)
  assert.equal(links.appLinkResponse(null).status, 404)
})

test('only first-party /q short links and the emailed reset link open the app', async () => {
  const apple = links.appleAppSiteAssociation({ OUTCLASS_IOS_APP_ID: 'ABCDE12345.net.outclass.app' })
  assert.deepEqual(apple.applinks.details[0].appIDs, ['ABCDE12345.net.outclass.app'])
  assert.deepEqual(apple.applinks.details[0].components.map(c => c['/']), ['/q/*', '/reset-password'])
  const android = links.androidAssetLinks({ OUTCLASS_ANDROID_CERT_SHA256: FINGERPRINT.toLowerCase() })
  assert.equal(android[0].target.package_name, 'net.outclass.app')
  assert.deepEqual(android[0].target.sha256_cert_fingerprints, [FINGERPRINT])
  const response = links.appLinkResponse(apple)
  assert.equal(response.headers.get('content-type'), 'application/json')
  assert.deepEqual(await response.json(), apple)
  const config = fs.readFileSync(path.join(root, 'mobile/app.config.ts'), 'utf8')
  assert.match(config, /pathPrefix: "\/q\/"/, 'the Android intent filter claims the same paths')
  assert.match(config, /path: "\/reset-password"/)
  // The reset email links to www (the apex answers with a redirect), so both hosts are claimed.
  assert.match(config, /host: "www\.out-class\.net"/)
  assert.match(config, /applinks:out-class\.net"/)
  assert.match(config, /applinks:www\.out-class\.net"/)
  assert.doesNotMatch(config, /pathPrefix: "\/"[^q]/, 'no catch-all path is claimed')
})

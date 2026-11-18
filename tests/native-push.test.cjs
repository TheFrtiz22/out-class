// Native push (the iOS/Android app) as a channel of the existing push path: device validation,
// one push per event per device, and the migration's constraints. No network.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

const root = path.join(__dirname, '..')
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(require, mod, mod.exports)
  return mod.exports
}
const push = load('lib/web-push.ts')
const TOKEN = 'ExponentPushToken[abcDEF123456_-xyz]'

test('native push is off unless NATIVE_PUSH_ENABLED=1; the access token is optional', () => {
  assert.equal(push.nativePushConfig({}), null)
  assert.equal(push.nativePushConfig({ NATIVE_PUSH_ENABLED: 'true' }), null)
  assert.deepEqual(push.nativePushConfig({ NATIVE_PUSH_ENABLED: '1' }), { accessToken: null, url: 'https://exp.host/--/api/v2/push/send' })
  assert.equal(push.nativePushConfig({ NATIVE_PUSH_ENABLED: '1', EXPO_ACCESS_TOKEN: ' t ' }).accessToken, 't')
})

test('a native device is an Expo push token and a phone platform, nothing else', () => {
  assert.deepEqual(push.parseNativePushDevice({ token: TOKEN, platform: 'IOS' }), { endpoint: `expo:${TOKEN}`, platform: 'IOS' })
  assert.deepEqual(push.parseNativePushDevice({ token: 'ExpoPushToken[abcdefgh]', platform: 'ANDROID' }), { endpoint: 'expo:ExpoPushToken[abcdefgh]', platform: 'ANDROID' })
  for (const bad of [null, {}, { token: TOKEN }, { token: TOKEN, platform: 'OTHER' }, { token: 'https://fcm.googleapis.com/x', platform: 'IOS' }, { token: 'ExponentPushToken[a b]', platform: 'IOS' }, { token: `${TOKEN}\nx`, platform: 'IOS' }, { token: 'ExponentPushToken[short]', platform: 'IOS' }])
    assert.equal(push.parseNativePushDevice(bad), null, JSON.stringify(bad))
  assert.equal(push.nativePushToken(`expo:${TOKEN}`), TOKEN)
  assert.equal(push.nativePushToken('https://fcm.googleapis.com/fcm/send/1'), null)
  assert.equal(push.nativePushToken('expo:https://evil.example/'), null, 'the stored value is re-validated before any send')
})

test('a browser subscription is tagged by where it lives', () => {
  assert.equal(push.pushPlatformFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'), 'IOS')
  assert.equal(push.pushPlatformFromUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'), 'ANDROID')
  assert.equal(push.pushPlatformFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'), 'OTHER')
  assert.equal(push.pushPlatformFromUserAgent(null), 'OTHER')
})

test('one push per event per device: the app replaces the same phone’s web push, and only that', () => {
  const rows = [
    { id: 'legacy', kind: 'WEB', platform: null }, { id: 'mac', kind: 'WEB', platform: 'OTHER' },
    { id: 'iphone-web', kind: 'WEB', platform: 'IOS' }, { id: 'android-web', kind: 'WEB', platform: 'ANDROID' },
    { id: 'iphone-app', kind: 'EXPO', platform: 'IOS' },
  ]
  const ids = (enabled, list = rows) => push.pushRecipients(list, enabled).map(row => row.id).sort()
  assert.deepEqual(ids({ web: true, native: true }), ['android-web', 'iphone-app', 'legacy', 'mac'], 'the iPhone gets the app push only; other devices keep theirs')
  assert.deepEqual(ids({ web: true, native: false }), ['android-web', 'iphone-web', 'legacy', 'mac'], 'native off: the web push still reaches the iPhone')
  assert.deepEqual(ids({ web: false, native: true }), ['iphone-app'])
  assert.deepEqual(ids({ web: true, native: true }, [{ id: 'old' }]), ['old'], 'rows without the new columns are web rows, as before')
})

test('native push migration: web rows keep their rule; native rows need a token shape and a phone platform', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    const dir = path.join(root, 'prisma/migrations')
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    const before = names.filter(n => n < '20261118130000')
    for (const n of before) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu');
      INSERT INTO "WebPushSubscription"(id,"userId",endpoint,p256dh,auth) VALUES('old','alice','https://fcm.googleapis.com/fcm/send/old','p','a')`)
    for (const n of names.filter(n => n >= '20261118130000')) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    const old = (await db.query(`SELECT kind, platform FROM "WebPushSubscription" WHERE id='old'`)).rows[0]
    assert.deepEqual(old, { kind: 'WEB', platform: null }, 'existing rows become WEB with no platform')
    const insert = (id, endpoint, kind, platform, keys = "'-','-'") => db.exec(`INSERT INTO "WebPushSubscription"(id,"userId",endpoint,p256dh,auth,kind,platform) VALUES('${id}','alice','${endpoint}',${keys},'${kind}',${platform ? `'${platform}'` : 'NULL'})`)
    await insert('app', `expo:${TOKEN}`, 'EXPO', 'IOS')
    await assert.rejects(insert('app2', `expo:${TOKEN}`, 'EXPO', 'ANDROID'), /duplicate|unique/i, 'a device token is unique')
    await assert.rejects(insert('bad1', 'expo:https://evil.example/', 'EXPO', 'IOS'), /endpoint_shape/)
    await assert.rejects(insert('bad2', 'expo:ExponentPushToken[abcdefgh1]', 'EXPO', null), /endpoint_shape/, 'a native row names its platform')
    await assert.rejects(insert('bad3', 'expo:ExponentPushToken[abcdefgh2]', 'EXPO', 'OTHER'), /endpoint_shape/)
    await assert.rejects(insert('bad4', 'expo:ExponentPushToken[abcdefgh3]', 'EXPO', 'IOS', "'p','a'"), /keys_bounded/)
    await assert.rejects(insert('bad5', 'http://fcm.googleapis.com/x', 'WEB', null, "'p','a'"), /endpoint_shape/, 'web rows still need https')
    await assert.rejects(insert('bad6', `expo:${TOKEN}x`, 'WEB', null, "'p','a'"), /endpoint_shape/, 'a web row cannot hold a device token')
    await assert.rejects(insert('bad7', 'https://fcm.googleapis.com/fcm/send/2', 'SMS', null, "'p','a'"), /WebPushSubscription_(kind|endpoint_shape)/, 'only the two known kinds')
    await insert('web', 'https://web.push.apple.com/abc', 'WEB', 'IOS', "'p','a'")
    for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      assert.equal((await db.query(`SELECT has_table_privilege($1,'"WebPushSubscription"',$2) ok`, [role, p])).rows[0].ok, false, `${role} ${p}`)
  } finally { await db.close() }
})

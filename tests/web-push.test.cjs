// Web Push (S1-8): subscription authorization, payload privacy, push-service cleanup and
// idempotent delivery, against an in-memory Prisma double (no database, no network).
// The worker's push/click handlers are tested in tests/installable-app.test.cjs; the
// migration in tests/web-push-migration.test.cjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const { randomUUID } = require('node:crypto')

const root = path.join(__dirname, '..')
function loader(mocks) {
  const cache = new Map()
  function load(file) {
    file = path.resolve(root, file)
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), mod, mod.exports)
    return mod.exports
  }
  return load
}

const VAPID = { VAPID_PUBLIC_KEY: 'BPublicKeyForTestsOnly', VAPID_PRIVATE_KEY: 'private-test-only', VAPID_SUBJECT: 'mailto:test@out-class.net' }
function withEnv(t, env) {
  const saved = Object.fromEntries(Object.keys(VAPID).map(k => [k, process.env[k]]))
  for (const k of Object.keys(VAPID)) delete process.env[k]
  Object.assign(process.env, env)
  t.after(() => { for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v })
}

// Minimal in-memory double of the Prisma calls these modules make.
function fakeDb() {
  const subs = [], deliveries = [], notifications = new Map(), users = new Map(), clubs = new Map()
  const match = (row, where = {}) => Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('not' in cond) return row[key] !== cond.not
      if ('lt' in cond) return row[key] < cond.lt
      if ('in' in cond) return cond.in.includes(row[key])
    }
    return row[key] === cond
  })
  const apply = (row, data) => { for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v }
  const pick = (row, select) => select ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]])) : { ...row }
  const sortBy = (rows, orderBy) => { if (!orderBy) return rows; const [[k, dir]] = Object.entries(orderBy); return [...rows].sort((a, b) => (a[k] - b[k]) * (dir === 'desc' ? -1 : 1)) }
  const removeSubs = where => { let count = 0; for (let i = subs.length - 1; i >= 0; i--) if (match(subs[i], where)) { const [gone] = subs.splice(i, 1); count++; for (let j = deliveries.length - 1; j >= 0; j--) if (deliveries[j].subscriptionId === gone.id) deliveries.splice(j, 1) } return { count } }
  const db = {
    subs, deliveries, notifications, users, clubs,
    $queryRaw: async () => [],
    $transaction: async fn => fn(db),
    webPushSubscription: {
      findMany: async ({ where, orderBy, select } = {}) => sortBy(subs.filter(r => match(r, where)), orderBy).map(r => pick(r, select)),
      deleteMany: async ({ where }) => removeSubs(where),
      upsert: async ({ where, create, update }) => {
        const row = subs.find(r => r.endpoint === where.endpoint)
        if (row) { apply(row, update); return row }
        const created = { id: randomUUID(), createdAt: new Date(Date.now() + subs.length), lastSuccessAt: null, failureCount: 0, ...create }
        subs.push(created); return created
      },
      updateMany: async ({ where, data }) => { const rows = subs.filter(r => match(r, where)); rows.forEach(r => apply(r, data)); return { count: rows.length } },
    },
    webPushDelivery: {
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0
        for (const d of data) {
          if (deliveries.some(r => r.notificationId === d.notificationId && r.subscriptionId === d.subscriptionId)) { if (!skipDuplicates) throw new Error('Unique constraint'); continue }
          deliveries.push({ status: 'PENDING', createdAt: new Date(), attemptedAt: null, ...d }); count++
        }
        return { count }
      },
      findMany: async ({ where, orderBy, take, select } = {}) => sortBy(deliveries.filter(r => match(r, where)), orderBy).slice(0, take).map(r => pick(r, select)),
      updateMany: async ({ where, data }) => {
        await new Promise(resolve => setImmediate(resolve)) // let concurrent workers interleave
        const rows = deliveries.filter(r => match(r, where)); rows.forEach(r => apply(r, data)); return { count: rows.length }
      },
      findUnique: async ({ where: { notificationId_subscriptionId: key } }) => {
        const row = deliveries.find(r => r.notificationId === key.notificationId && r.subscriptionId === key.subscriptionId)
        if (!row) return null
        const n = notifications.get(row.notificationId)
        return { ...row, subscription: { ...subs.find(s => s.id === row.subscriptionId) }, notification: { ...n, club: n.clubId ? clubs.get(n.clubId) : null, user: users.get(n.userId) } }
      },
    },
  }
  return db
}

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123'
const subscriptionJson = (endpoint = ENDPOINT) => ({ endpoint, expirationTime: null, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } })

function actions(db, userId, extra = {}) {
  return loader({
    '@/utils/prisma': { prisma: db },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: userId }, impersonation: null, ...extra }) },
  })('actions/push-subscriptions.ts')
}

test('subscribe and unsubscribe act on the signed-in user only', async t => {
  withEnv(t, VAPID)
  const db = fakeDb()
  await actions(db, 'alice').savePushSubscription(subscriptionJson())
  assert.deepEqual(db.subs.map(s => [s.userId, s.endpoint]), [['alice', ENDPOINT]])

  // Bob cannot remove Alice's endpoint.
  await actions(db, 'bob').removePushSubscription({ endpoint: ENDPOINT })
  assert.equal(db.subs.length, 1, "another user's subscription is untouched")

  // Bob subscribing the same browser endpoint (shared device) takes it over: Alice's row and its queue go.
  db.deliveries.push({ notificationId: 'n-alice', subscriptionId: db.subs[0].id, status: 'PENDING', createdAt: new Date() })
  await actions(db, 'bob').savePushSubscription(subscriptionJson())
  assert.deepEqual(db.subs.map(s => s.userId), ['bob'])
  assert.equal(db.deliveries.length, 0, "Alice's queued pushes never reach Bob's device")

  await actions(db, 'alice').removePushSubscription({ endpoint: ENDPOINT })
  assert.equal(db.subs.length, 1)
  await actions(db, 'bob').removePushSubscription({ endpoint: ENDPOINT })
  assert.equal(db.subs.length, 0, 'the owner can unsubscribe')
})

test('subscriptions: support sessions, unknown push hosts and unconfigured push are refused', async t => {
  withEnv(t, VAPID)
  const db = fakeDb()
  await assert.rejects(actions(db, 'alice', { impersonation: { targetUserId: 'alice' } }).savePushSubscription(subscriptionJson()), /support session/)
  await assert.rejects(actions(db, 'alice', { impersonation: { targetUserId: 'alice' } }).getPushSettings(), /support session/)
  for (const endpoint of ['https://internal.example.com/hook', 'http://fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com:8443/x', 'https://evil.com@fcm.googleapis.com.evil.com/x']) {
    await assert.rejects(actions(db, 'alice').savePushSubscription(subscriptionJson(endpoint)), /not supported/, endpoint)
  }
  await assert.rejects(actions(db, 'alice').savePushSubscription({ endpoint: ENDPOINT, keys: { p256dh: '<script>', auth: 'x' } }), /not supported/)
  assert.equal(db.subs.length, 0)
  assert.deepEqual(await actions(db, 'alice').getPushSettings(), { enabled: true, publicKey: VAPID.VAPID_PUBLIC_KEY })

  withEnv(t, { VAPID_PUBLIC_KEY: 'x', VAPID_SUBJECT: 'mailto:a@b.c' })
  assert.deepEqual(await actions(db, 'alice').getPushSettings(), { enabled: false, publicKey: null }, 'off without the private key')
  await assert.rejects(actions(db, 'alice').savePushSubscription(subscriptionJson()), /not available/)
})

test('each user keeps at most 10 subscriptions; the oldest is dropped', async t => {
  withEnv(t, VAPID)
  const db = fakeDb()
  for (let i = 0; i < 12; i++) await actions(db, 'alice').savePushSubscription(subscriptionJson(`https://updates.push.services.mozilla.com/wpush/v2/${i}`))
  assert.equal(db.subs.length, 10)
  assert.ok(!db.subs.some(s => s.endpoint.endsWith('/0') || s.endpoint.endsWith('/1')))
})

test('payload carries only a category title, a short body and a same-origin path', () => {
  const lib = loader({})('lib/web-push.ts')
  const secret = { type: 'DECISION', title: 'Jane Doe was rejected by Consulting Club', body: 'GPA 3.1, interviewer notes: weak', href: '/applications/a1/decision?letter=l1', club: { name: 'Consulting Club' }, userId: 'u', eventKey: 'decision:a1' }
  const payload = lib.buildPushPayload(secret)
  assert.deepEqual(Object.keys(payload).sort(), ['body', 'title', 'url'])
  const json = JSON.stringify(payload)
  for (const leak of ['Jane', 'rejected', 'GPA', 'notes', 'Consulting', 'decision:a1']) assert.ok(!json.includes(leak), `payload must not contain ${leak}`)
  assert.equal(payload.url, '/applications/a1/decision?letter=l1')
  assert.deepEqual(lib.buildPushPayload({ type: 'ANNOUNCEMENT', title: 'Private', body: 'Private', href: '/inbox', club: { name: 'Chess Club' } }), { title: 'New club announcement', body: 'From Chess Club', url: '/inbox' })
  for (const href of ['https://evil.com/x', '//evil.com/x', 'javascript:alert(1)', '/\\evil.com', '', null]) assert.equal(lib.sameOriginPath(href), '/inbox', String(href))
  assert.equal(lib.buildPushPayload({ type: 'UNKNOWN' }).title, 'OutClass update')
})

function pushWorld(t) {
  withEnv(t, VAPID)
  const db = fakeDb()
  db.users.set('alice', { disabledAt: null })
  const notify = (extra = {}) => { const n = { id: randomUUID(), userId: 'alice', clubId: null, type: 'ANNOUNCEMENT', title: 'Secret title', body: 'Secret body', href: '/inbox', readAt: null, archivedAt: null, createdAt: new Date(), ...extra }; db.notifications.set(n.id, n); return n }
  const subscribe = (endpoint = ENDPOINT) => { const s = { id: randomUUID(), userId: 'alice', endpoint, p256dh: 'p', auth: 'a', createdAt: new Date(), lastSuccessAt: null, failureCount: 0 }; db.subs.push(s); return s }
  const sent = []
  const sender = (status = 201) => ({ sendNotification: async (subscription, body, options) => {
    sent.push({ endpoint: subscription.endpoint, body: JSON.parse(body), options })
    await new Promise(resolve => setImmediate(resolve))
    if (status >= 400) throw Object.assign(new Error('push service error'), { statusCode: status })
    return { statusCode: status }
  } })
  const worker = loader({ '@/utils/prisma': { prisma: db } })('utils/notification-push.ts')
  return { db, notify, subscribe, sent, sender, worker }
}

test('the same notification is pushed once per subscription, across re-queues and overlapping runs', async t => {
  const { db, notify, subscribe, sent, sender, worker } = pushWorld(t)
  const phone = subscribe(), laptop = subscribe('https://web.push.apple.com/QGuQyavXutnMcGu')
  const n = notify()
  assert.equal(await worker.enqueueNotificationPushes(db, 'alice', [n]), 2)
  assert.equal(await worker.enqueueNotificationPushes(db, 'alice', [n]), 0, 're-queueing is a no-op')
  const [a, b] = await Promise.all([worker.processNotificationPushes(50, sender()), worker.processNotificationPushes(50, sender())])
  assert.equal(a.sent + b.sent, 2, 'two overlapping cron runs send two pushes in total, not four')
  assert.deepEqual(sent.map(s => s.endpoint).sort(), [phone.endpoint, laptop.endpoint].sort())
  assert.equal((await worker.processNotificationPushes(50, sender())).sent, 0, 'a later run sends nothing')
  await worker.enqueueNotificationPushes(db, 'alice', [n])
  assert.equal((await worker.processNotificationPushes(50, sender())).sent, 0, 'already-sent rows are never re-queued')
  assert.ok(db.deliveries.every(d => d.status === 'SENT'))
  assert.ok(db.subs.every(s => s.lastSuccessAt instanceof Date && s.failureCount === 0))
  assert.equal(sent[0].options.vapidDetails.subject, VAPID.VAPID_SUBJECT)
  assert.ok(!JSON.stringify(sent).includes('Secret'), 'the stored title and body are never sent')
})

test('404/410 removes the subscription; other errors count up to 5 and then stop', async t => {
  const { db, notify, subscribe, sent, sender, worker } = pushWorld(t)
  const gone = subscribe()
  await worker.enqueueNotificationPushes(db, 'alice', [notify()])
  const result = await worker.processNotificationPushes(50, sender(410))
  assert.equal(result.removed, 1)
  assert.ok(!db.subs.some(s => s.id === gone.id), '410 deletes the subscription')
  assert.equal(db.deliveries.length, 0)

  const flaky = subscribe('https://updates.push.services.mozilla.com/wpush/v2/flaky')
  for (let i = 0; i < 5; i++) {
    await worker.enqueueNotificationPushes(db, 'alice', [notify()])
    assert.equal((await worker.processNotificationPushes(50, sender(500))).failed, 1)
  }
  assert.equal(flaky.failureCount, 5)
  sent.length = 0
  assert.equal(await worker.enqueueNotificationPushes(db, 'alice', [notify()]), 0, 'no new pushes after 5 failures')
  assert.equal((await worker.processNotificationPushes(50, sender())).sent, 0)
  assert.equal(sent.length, 0)
})

test('nothing is queued or sent without VAPID keys; stale, read and foreign rows are skipped', async t => {
  const { db, notify, subscribe, sender, worker } = pushWorld(t)
  const sub = subscribe()
  await worker.enqueueNotificationPushes(db, 'alice', [notify({ createdAt: new Date(Date.now() - 25 * 3600000) })])
  assert.equal(db.deliveries.length, 0, 'a notification older than 24 hours is not queued')
  const read = notify(), foreign = notify({ userId: 'bob' })
  await worker.enqueueNotificationPushes(db, 'alice', [read])
  read.readAt = new Date()
  db.users.set('bob', { disabledAt: null })
  db.deliveries.push({ notificationId: foreign.id, subscriptionId: sub.id, status: 'PENDING', createdAt: new Date() })
  const result = await worker.processNotificationPushes(50, sender())
  assert.deepEqual([result.sent, result.skipped], [0, 2])

  withEnv(t, {})
  assert.equal(await worker.enqueueNotificationPushes(db, 'alice', [notify()]), 0)
  assert.equal((await worker.processNotificationPushes(50, sender())).enabled, false)
})

test('the email worker queues pushes only for instant deliveries, and the cron isolates push failures', () => {
  const delivery = fs.readFileSync(path.join(root, 'utils/notification-delivery.ts'), 'utf8')
  assert.match(delivery, /status: "ASSIGNED", deliveryId: delivery\.id \} \}\);\n.*\n\s+if \(!digest\) await enqueueNotificationPushes\(tx, userId, group\.map\(row => row\.notification\)\);/)
  assert.equal((delivery.match(/enqueueNotificationPushes/g) || []).length, 2, 'one import, one call')
  const route = fs.readFileSync(path.join(root, 'app/api/internal/notification-delivery/route.ts'), 'utf8')
  assert.match(route, /catch \{ push = \{ enabled: true, error: "PUSH_UNAVAILABLE" \}; \}/)
  assert.match(route, /\.\.\.result, push/)
})

test('settings sheet: permission is requested only from the switch, never on load', () => {
  const toggle = fs.readFileSync(path.join(root, 'components/inbox/push-notifications-toggle.tsx'), 'utf8')
  assert.equal((toggle.match(/requestPermission\(/g) || []).length, 1)
  const effect = toggle.slice(toggle.indexOf('useEffect('), toggle.indexOf('async function turnOn'))
  assert.doesNotMatch(effect, /requestPermission|subscribe\(/, 'the mount effect only reads state')
  assert.match(toggle, /iOS 16\.4/)
  assert.match(fs.readFileSync(path.join(root, 'components/inbox/inbox-notification-settings.tsx'), 'utf8'), /\{open && <PushNotificationsToggle \/>\}/)
  assert.match(fs.readFileSync(path.join(root, '.env.example'), 'utf8'), /^VAPID_PUBLIC_KEY=""\nVAPID_PRIVATE_KEY=""\nVAPID_SUBJECT=""$/m)
})

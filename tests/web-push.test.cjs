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
    if (key === 'OR') return cond.some(sub => match(row, sub))
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
      findMany: async ({ where, orderBy, select } = {}) => { if (db.failSubscriptions) throw Object.assign(new Error('relation "WebPushSubscription" does not exist'), { code: 'P2021' }); return sortBy(subs.filter(r => match(r, where)), orderBy).map(r => pick(r, select)) },
      findUnique: async ({ where, select }) => { const row = subs.find(r => r.endpoint === where.endpoint); return row ? pick(row, select) : null },
      deleteMany: async ({ where }) => removeSubs(where),
      upsert: async ({ where, create, update }) => {
        if (db.raceOnUpsert) { db.raceOnUpsert(); db.raceOnUpsert = null; throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }) }
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
          if (!subs.some(r => r.id === d.subscriptionId)) throw Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' })
          if (deliveries.some(r => r.notificationId === d.notificationId && r.subscriptionId === d.subscriptionId)) { if (!skipDuplicates) throw new Error('Unique constraint'); continue }
          deliveries.push({ status: 'PENDING', createdAt: new Date(), attemptedAt: null, ...d }); count++
        }
        return { count }
      },
      findMany: async ({ where, orderBy, take, select } = {}) => sortBy(deliveries.filter(r => match(r, where)), orderBy).slice(0, take).map(r => pick(r, select)),
      deleteMany: async ({ where }) => { let count = 0; for (let i = deliveries.length - 1; i >= 0; i--) if (match(deliveries[i], where)) { deliveries.splice(i, 1); count++ } return { count } },
      updateMany: async ({ where, data }) => {
        await new Promise(resolve => setImmediate(resolve)) // let concurrent workers interleave
        const rows = deliveries.filter(r => match(r, where)); rows.forEach(r => apply(r, data)); return { count: rows.length }
      },
      findUnique: async ({ where: { notificationId_subscriptionId: key } }) => {
        const row = deliveries.find(r => r.notificationId === key.notificationId && r.subscriptionId === key.subscriptionId)
        if (!row) return null
        const n = notifications.get(row.notificationId)
        const emailOutbox = n.emailStatus === null ? null : { status: 'ASSIGNED', delivery: { status: n.emailStatus ?? 'SENT' } }
        return { ...row, subscription: { ...subs.find(s => s.id === row.subscriptionId) }, notification: { ...n, emailOutbox, club: n.clubId ? clubs.get(n.clubId) : null, user: { notificationPreferences: null, ...users.get(n.userId) } } }
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
  assert.deepEqual(await actions(db, 'alice').getPushSettings(), { enabled: true, publicKey: VAPID.VAPID_PUBLIC_KEY, subscribed: false })

  withEnv(t, { VAPID_PUBLIC_KEY: 'x', VAPID_SUBJECT: 'mailto:a@b.c' })
  assert.deepEqual(await actions(db, 'alice').getPushSettings(), { enabled: false, publicKey: null, subscribed: false }, 'off without the private key')
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
  const notify = (extra = {}) => { const n = { id: randomUUID(), userId: 'alice', clubId: null, type: 'ANNOUNCEMENT', eventKey: `announcement:${randomUUID()}`, title: 'Secret title', body: 'Secret body', href: '/inbox', readAt: null, archivedAt: null, createdAt: new Date(), ...extra }; db.notifications.set(n.id, n); return n }
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
  assert.equal(await worker.enqueueNotificationPushes('alice', [n]), 2)
  assert.equal(await worker.enqueueNotificationPushes('alice', [n]), 0, 're-queueing is a no-op')
  const [a, b] = await Promise.all([worker.processNotificationPushes(50, { sender: sender() }), worker.processNotificationPushes(50, { sender: sender() })])
  assert.equal(a.sent + b.sent, 2, 'two overlapping cron runs send two pushes in total, not four')
  assert.deepEqual(sent.map(s => s.endpoint).sort(), [phone.endpoint, laptop.endpoint].sort())
  assert.equal((await worker.processNotificationPushes(50, { sender: sender() })).sent, 0, 'a later run sends nothing')
  await worker.enqueueNotificationPushes('alice', [n])
  assert.equal((await worker.processNotificationPushes(50, { sender: sender() })).sent, 0, 'already-sent rows are never re-queued')
  assert.ok(db.deliveries.every(d => d.status === 'SENT'))
  assert.ok(db.subs.every(s => s.lastSuccessAt instanceof Date && s.failureCount === 0))
  assert.equal(sent[0].options.vapidDetails.subject, VAPID.VAPID_SUBJECT)
  assert.ok(!JSON.stringify(sent).includes('Secret'), 'the stored title and body are never sent')
})

test('404/410 removes the subscription; only permanent 4xx errors count up to 5 and then stop', async t => {
  const { db, notify, subscribe, sent, sender, worker } = pushWorld(t)
  const gone = subscribe()
  await worker.enqueueNotificationPushes('alice', [notify()])
  const result = await worker.processNotificationPushes(50, { sender: sender(410) })
  assert.equal(result.removed, 1)
  assert.ok(!db.subs.some(s => s.id === gone.id), '410 deletes the subscription')
  assert.equal(db.deliveries.length, 0)

  const flaky = subscribe('https://updates.push.services.mozilla.com/wpush/v2/flaky')
  for (let i = 0; i < 5; i++) {
    await worker.enqueueNotificationPushes('alice', [notify()])
    assert.equal((await worker.processNotificationPushes(50, { sender: sender(503) })).failed, 1)
  }
  assert.equal(flaky.failureCount, 0, 'five 503s (transient) do not count toward the cap')
  for (const status of [429, 500]) {
    await worker.enqueueNotificationPushes('alice', [notify()])
    await worker.processNotificationPushes(50, { sender: sender(status) })
  }
  await worker.enqueueNotificationPushes('alice', [notify()])
  await worker.processNotificationPushes(50, { sender: { sendNotification: async () => { throw new Error('socket timeout') } } })
  assert.equal(flaky.failureCount, 0, '429, 500 and a timeout do not count either')
  for (let i = 0; i < 5; i++) {
    await worker.enqueueNotificationPushes('alice', [notify()])
    assert.equal((await worker.processNotificationPushes(50, { sender: sender(400) })).failed, 1)
  }
  assert.equal(flaky.failureCount, 5)
  sent.length = 0
  assert.equal(await worker.enqueueNotificationPushes('alice', [notify()]), 0, 'no new pushes after 5 failures')
  assert.equal((await worker.processNotificationPushes(50, { sender: sender() })).sent, 0)
  assert.equal(sent.length, 0)
})

test('nothing is queued or sent without VAPID keys; stale, read and foreign rows are skipped', async t => {
  const { db, notify, subscribe, sender, worker } = pushWorld(t)
  const sub = subscribe()
  await worker.enqueueNotificationPushes('alice', [notify({ createdAt: new Date(Date.now() - 25 * 3600000) })])
  assert.equal(db.deliveries.length, 0, 'a notification older than 24 hours is not queued')
  const read = notify(), foreign = notify({ userId: 'bob' })
  await worker.enqueueNotificationPushes('alice', [read])
  read.readAt = new Date()
  db.users.set('bob', { disabledAt: null })
  db.deliveries.push({ notificationId: foreign.id, subscriptionId: sub.id, status: 'PENDING', createdAt: new Date() })
  const result = await worker.processNotificationPushes(50, { sender: sender() })
  assert.deepEqual([result.sent, result.skipped], [0, 2])

  withEnv(t, {})
  assert.equal(await worker.enqueueNotificationPushes('alice', [notify()]), 0)
  assert.equal((await worker.processNotificationPushes(50, { sender: sender() })).enabled, false)
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

function emailWorld(t, { pushThrows }) {
  withEnv(t, VAPID)
  const env = { COMMUNICATIONS_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test-only', RESEND_FROM_EMAIL: 'updates@out-class.net', OUTCLASS_SITE_URL: 'https://out-class.net' }
  const saved = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]))
  Object.assign(process.env, env)
  t.after(() => { for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v })
  const db = fakeDb(), events = []
  const sub = { id: 'sub-1', userId: 'u1', endpoint: ENDPOINT, p256dh: 'p', auth: 'a', createdAt: new Date(), lastSuccessAt: null, failureCount: 0 }
  db.subs.push(sub)
  db.failSubscriptions = pushThrows
  const notification = { id: randomUUID(), userId: 'u1', clubId: 'c1', eventKey: 'announcement:1', type: 'ANNOUNCEMENT', title: 'Update', body: 'Body', href: '/inbox', archivedAt: null, readAt: null, createdAt: new Date(), club: { name: 'Chess Club', suspendedAt: null } }
  const outbox = { notificationId: notification.id, status: 'PENDING', deliveryId: null, createdAt: new Date(), notification }
  let inTransaction = false
  Object.assign(db, {
    $queryRaw: async strings => strings.join('?').includes('GROUP BY') ? [{ userId: 'u1' }] : [],
    $transaction: async fn => { inTransaction = true; try { const r = await fn(db); events.push('commit'); return r } finally { inTransaction = false } },
    user: { findUnique: async () => ({ id: 'u1', email: 'u1@virginia.edu', disabledAt: null, notificationPreferences: null }) },
    notificationEmailOutbox: {
      findMany: async () => outbox.status === 'PENDING' ? [outbox] : [],
      update: async ({ data }) => Object.assign(outbox, data),
      updateMany: async ({ data }) => { Object.assign(outbox, data); events.push(`outbox:${data.status}`); return { count: 1 } },
    },
    notificationEmailDelivery: { create: async ({ data }) => { events.push('delivery'); return { id: 'd1', ...data } }, findMany: async () => { events.push('send-phase'); db.onSendPhase?.(); return [] } },
  })
  const createMany = db.webPushDelivery.createMany
  db.webPushDelivery.createMany = async args => { events.push(inTransaction ? 'push:inside' : 'push:after'); return createMany(args) }
  const worker = loader({ '@/utils/prisma': { prisma: db } })('utils/notification-delivery.ts')
  return { db, events, outbox, worker }
}

test('a push-table failure never stops instant email: the delivery is still created and ASSIGNED', async t => {
  const { db, events, outbox, worker } = emailWorld(t, { pushThrows: true })
  const errors = []; const realError = console.error; console.error = (...args) => errors.push(args); t.after(() => { console.error = realError })
  const result = await worker.processNotificationEmails(10)
  assert.equal(result.failed, 0, 'the email worker returns normally')
  assert.equal(outbox.status, 'ASSIGNED'); assert.equal(outbox.deliveryId, 'd1')
  assert.deepEqual(events, ['delivery', 'outbox:ASSIGNED', 'commit', 'send-phase'])
  assert.equal(db.deliveries.length, 0)
  assert.ok(errors.some(([message]) => message === 'notification-push enqueue failed'), 'the push failure is logged')
})

test('pushes are queued only after the email transaction commits and after the email send phase', async t => {
  const { db, events, worker } = emailWorld(t, { pushThrows: false })
  await worker.processNotificationEmails(10)
  assert.deepEqual(events, ['delivery', 'outbox:ASSIGNED', 'commit', 'send-phase', 'push:after'])
  assert.equal(db.deliveries.length, 1)
})

test('push enqueueing never runs into the email deadline: a late run skips it and logs', async t => {
  const { db, events, outbox, worker } = emailWorld(t, { pushThrows: false })
  const errors = []; const realError = console.error; console.error = (...args) => errors.push(args); t.after(() => { console.error = realError })
  const realNow = Date.now; let offset = 0; Date.now = () => realNow() + offset; t.after(() => { Date.now = realNow })
  db.onSendPhase = () => { offset = 45000 } // the email sends used the whole budget
  const result = await worker.processNotificationEmails(10)
  assert.equal(result.failed, 0); assert.equal(outbox.status, 'ASSIGNED')
  assert.deepEqual(events, ['delivery', 'outbox:ASSIGNED', 'commit', 'send-phase'], 'no push-table work after the deadline')
  assert.equal(db.deliveries.length, 0)
  assert.deepEqual(errors.find(([message]) => message === 'notification-push enqueue skipped at deadline')?.[1], { count: 1 })
})

test('a slow push table cannot delay the email send phase', async t => {
  const { db, events, worker } = emailWorld(t, { pushThrows: false })
  const realFind = db.webPushSubscription.findMany
  db.webPushSubscription.findMany = async args => { events.push('push:lookup'); await new Promise(resolve => setTimeout(resolve, 50)); return realFind(args) }
  await worker.processNotificationEmails(10)
  assert.ok(events.indexOf('send-phase') < events.indexOf('push:lookup'), 'emails are claimed and sent before any push-table query')
})

test('a removed subscription (FK 23503 between read and insert) is skipped and logged', async t => {
  const { db, notify, subscribe, worker } = pushWorld(t)
  subscribe()
  const realFind = db.webPushSubscription.findMany
  db.webPushSubscription.findMany = async args => [{ id: 'deleted-meanwhile' }, ...await realFind(args)]
  const errors = []; const realError = console.error; console.error = (...args) => errors.push(args); t.after(() => { console.error = realError })
  assert.equal(await worker.enqueueNotificationPushes('alice', [notify()]), 1)
  assert.ok(errors.some(([message]) => /removed subscription/.test(message)))
})

test('push respects the cron deadline: at 50 s nothing is claimed', async t => {
  const { db, notify, subscribe, sent, sender, worker } = pushWorld(t)
  subscribe()
  await worker.enqueueNotificationPushes('alice', [notify()])
  const result = await worker.processNotificationPushes(50, { startedAt: 1000, now: () => 51000, sender: sender() })
  assert.equal(result.sent, 0); assert.equal(sent.length, 0)
  assert.ok(db.deliveries.every(d => d.status === 'PENDING'), 'zero claims')
  const late = await worker.processNotificationPushes(50, { startedAt: 1000, now: () => 1000 + 41000, sender: sender() })
  assert.equal(late.sent, 0, 'past the 40 s budget too')
  const timeouts = []
  await worker.processNotificationPushes(50, { startedAt: Date.now() - 39000, sender: { sendNotification: async (s, b, options) => { timeouts.push(options.timeout); return {} } } })
  assert.equal(timeouts.length, 1); assert.ok(timeouts[0] <= 9000 && timeouts[0] >= 8000, 'the send timeout is capped to stay under maxDuration')
})

test('no push once the email was suppressed, the category is off, or the stored endpoint is no longer valid', async t => {
  const { db, notify, subscribe, sent, sender, worker } = pushWorld(t)
  subscribe()
  await worker.enqueueNotificationPushes('alice', [notify({ emailStatus: 'SUPPRESSED' }), notify({ emailStatus: null }), notify({ emailStatus: 'QUEUED' })])
  const first = await worker.processNotificationPushes(50, { sender: sender() })
  assert.deepEqual([first.sent, first.skipped], [1, 2], 'only the live (QUEUED) email gets a push')
  db.users.set('alice', { disabledAt: null, notificationPreferences: { emailFrequency: 'INSTANT', emailAnnouncements: false } })
  await worker.enqueueNotificationPushes('alice', [notify()])
  assert.equal((await worker.processNotificationPushes(50, { sender: sender() })).skipped, 1, 'announcements turned off since queueing')
  for (const emailFrequency of ['DAILY', 'OFF']) {
    db.users.set('alice', { disabledAt: null, notificationPreferences: { emailFrequency, emailAnnouncements: true } })
    await worker.enqueueNotificationPushes('alice', [notify({ emailStatus: 'QUEUED' })])
    sent.length = 0
    const switched = await worker.processNotificationPushes(50, { sender: sender() })
    assert.deepEqual([switched.sent, switched.skipped, sent.length], [0, 1, 0], `switched Instant -> ${emailFrequency} after queueing: no push`)
    assert.equal(db.deliveries.at(-1).status, 'SKIPPED')
  }
  db.users.set('alice', { disabledAt: null })
  db.subs[0].endpoint = 'https://attacker.example/hook'
  await worker.enqueueNotificationPushes('alice', [notify()])
  sent.length = 0
  assert.equal((await worker.processNotificationPushes(50, { sender: sender() })).removed, 1)
  assert.equal(sent.length, 0, 'an endpoint that fails validation is never contacted')
  assert.equal(db.subs.length, 0)
})

test('delivery rows older than 7 days are pruned in bounded batches', async t => {
  const { db, notify, subscribe, sender, worker } = pushWorld(t)
  const sub = subscribe()
  for (let i = 0; i < 3; i++) db.deliveries.push({ notificationId: `old-${i}`, subscriptionId: sub.id, status: 'SENT', createdAt: new Date(Date.now() - 8 * 24 * 3600000) })
  await worker.enqueueNotificationPushes('alice', [notify()])
  const result = await worker.processNotificationPushes(50, { sender: sender() })
  assert.equal(result.pruned, 3)
  assert.deepEqual(db.deliveries.map(d => d.status), ['SENT'])
  assert.match(fs.readFileSync(path.join(root, 'utils/notification-push.ts'), 'utf8'), /take: RETENTION_BATCH/)
})

test('status comes from the server row: after Bob takes the endpoint over, Alice shows off', async t => {
  withEnv(t, VAPID)
  const db = fakeDb()
  await actions(db, 'alice').savePushSubscription(subscriptionJson())
  assert.equal((await actions(db, 'alice').getPushSettings(ENDPOINT)).subscribed, true)
  await actions(db, 'bob').savePushSubscription(subscriptionJson())
  assert.equal((await actions(db, 'alice').getPushSettings(ENDPOINT)).subscribed, false)
  assert.equal((await actions(db, 'bob').getPushSettings(ENDPOINT)).subscribed, true)
  db.subs[0].failureCount = 5
  assert.equal((await actions(db, 'bob').getPushSettings(ENDPOINT)).subscribed, false, 'a disabled subscription reads as off')
})

test('a P2002 save race is success only when the endpoint now belongs to the current user', async t => {
  withEnv(t, VAPID)
  const db = fakeDb()
  db.raceOnUpsert = () => db.subs.push({ id: 'raced', userId: 'alice', endpoint: ENDPOINT, p256dh: 'p', auth: 'a', createdAt: new Date(), failureCount: 0 })
  assert.deepEqual(await actions(db, 'alice').savePushSubscription(subscriptionJson()), { subscribed: true })
  const other = fakeDb()
  other.raceOnUpsert = () => other.subs.push({ id: 'raced', userId: 'bob', endpoint: ENDPOINT, p256dh: 'p', auth: 'a', createdAt: new Date(), failureCount: 0 })
  await assert.rejects(actions(other, 'alice').savePushSubscription(subscriptionJson()), /Unique constraint/)
})

test('cron: a push failure keeps the email result and 200, reports push.error and logs it', async t => {
  const saved = process.env.CRON_SECRET; process.env.CRON_SECRET = 'cron-test'
  t.after(() => { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved })
  const errors = []; const realError = console.error; console.error = (...args) => errors.push(args); t.after(() => { console.error = realError })
  let startedAt
  const route = loader({
    '@/utils/notification-delivery': { processNotificationEmails: async () => ({ enabled: true, sent: 1, failed: 0, suppressed: 0, invalid: 0 }) },
    '@/utils/notification-push': { processNotificationPushes: async (limit, options) => { startedAt = options.startedAt; throw Object.assign(new Error('lock timeout'), { code: 'P2034' }) } },
  })('app/api/internal/notification-delivery/route.ts')
  const response = await route.POST(new Request('http://localhost/api/internal/notification-delivery', { headers: { authorization: 'Bearer cron-test' } }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.sent, 1)
  assert.equal(body.push.error, 'PUSH_UNAVAILABLE')
  assert.ok(Math.abs(startedAt - Date.now()) < 5000, 'the cron start time is shared with push')
  assert.deepEqual(errors.find(([message]) => message === 'notification-push unavailable')?.[1], { code: 'P2034' })
  assert.match(fs.readFileSync(path.join(root, 'app/api/internal/notification-delivery/route.ts'), 'utf8'), /Sentry\.captureException\(error/)
})

test('sign-out unsubscribes this device first, best effort and bounded', async t => {
  const shell = fs.readFileSync(path.join(root, 'components/shell/product-shell.tsx'), 'utf8')
  assert.ok(shell.indexOf('unsubscribeOnSignOut') > 0 && shell.indexOf('unsubscribeOnSignOut') < shell.indexOf('fetch("/api/auth/logout"'))
  const device = loader({})('lib/push-device.ts')
  const removed = [], unsubscribed = []
  const subscription = { endpoint: ENDPOINT, unsubscribe: async () => { unsubscribed.push(true); return true } }
  const savedWindow = globalThis.window, nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  globalThis.window = { PushManager: {}, Notification: {} }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { getRegistration: async () => ({ active: {}, pushManager: { getSubscription: async () => subscription } }) } } })
  t.after(() => { if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow; if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator })
  await device.unsubscribeOnSignOut(async input => { removed.push(input.endpoint) })
  assert.deepEqual([removed, unsubscribed.length], [[ENDPOINT], 1])
  const started = Date.now()
  await device.unsubscribeOnSignOut(() => new Promise(() => {}), 50)
  assert.ok(Date.now() - started < 1000, 'a hung server call does not hold up sign-out')
  await device.unsubscribeOnSignOut(async () => { throw new Error('offline') })
  subscription.unsubscribe = async () => false
  await assert.rejects(device.unsubscribeThisDevice(async () => {}), /kept the push subscription/, 'turn-off surfaces a failed browser unsubscribe')
})

test('a browser subscription made with a rotated-out VAPID key is detected and replaced', () => {
  const device = loader({})('lib/push-device.ts')
  const key = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'
  const rotated = 'BOtherKeyAfterRotationOtherKeyAfterRotationOtherKeyAfterRotationOtherKeyAfterRotation1'
  const sub = k => ({ options: { applicationServerKey: device.vapidKeyBytes(k).buffer } })
  assert.equal(device.subscriptionMatchesKey(sub(key), key), true)
  assert.equal(device.subscriptionMatchesKey(sub(rotated), key), false)
  assert.equal(device.subscriptionMatchesKey({ options: { applicationServerKey: new Uint8Array(65).buffer } }, key), false, 'same length, different bytes')
  assert.equal(device.subscriptionMatchesKey({ options: { applicationServerKey: null } }, key), true, 'a browser that does not report its key is not churned')
  assert.equal(device.subscriptionMatchesKey({}, key), true)
  const toggle = fs.readFileSync(path.join(root, 'components/inbox/push-notifications-toggle.tsx'), 'utf8')
  const turnOn = toggle.slice(toggle.indexOf('async function turnOn'), toggle.indexOf('async function toggle'))
  assert.ok(turnOn.indexOf('subscriptionMatchesKey(existing, publicKey)') < turnOn.indexOf('existing.unsubscribe()'))
  assert.ok(turnOn.indexOf('existing.unsubscribe()') < turnOn.indexOf('pushManager.subscribe('), 'the stale subscription is dropped before subscribing anew')
  assert.match(turnOn, /removePushSubscription\(\{ endpoint: existing\.endpoint \}\)/, 'the stale server row is removed')
  assert.match(turnOn, /savePushSubscription\(subscription\.toJSON\(\)\)/)
})

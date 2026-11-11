const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file) {
  const mod = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', source)(name => name.startsWith('@/lib/') ? load(name.slice(2) + '.ts') : require(name), mod, mod.exports)
  return mod.exports
}
const c = load('lib/task-file-content.ts')
const bytes = (...values) => new Uint8Array(values.flat())
const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

test('signatures match the task allowlist and reuse the profile magic-byte checks', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7\n')
  const png = bytes(137, 80, 78, 71, 13, 10, 26, 10, 0)
  const jpeg = bytes(255, 216, 255, 224)
  const zip = bytes(0x50, 0x4b, 0x03, 0x04, 20, 0)
  assert.equal(c.taskFileContentMatches(pdf, 'application/pdf'), true)
  assert.equal(c.taskFileContentMatches(png, 'image/png'), true)
  assert.equal(c.taskFileContentMatches(jpeg, 'image/jpeg'), true)
  assert.equal(c.taskFileContentMatches(zip, docx), true)
  assert.equal(c.taskFileContentMatches(new TextEncoder().encode('Notes — café ✓'), 'text/plain'), true)
  // Mismatches between declared type and bytes.
  assert.equal(c.taskFileContentMatches(png, 'application/pdf'), false)
  assert.equal(c.taskFileContentMatches(pdf, 'image/png'), false)
  assert.equal(c.taskFileContentMatches(png, 'image/jpeg'), false)
  assert.equal(c.taskFileContentMatches(pdf, docx), false)
  assert.equal(c.taskFileContentMatches(bytes(0x4d, 0x5a, 0x90, 0), 'text/plain'), false)
  assert.equal(c.taskFileContentMatches(bytes(0xff, 0xfe, 0x41), 'text/plain'), false)
  assert.equal(c.taskFileContentMatches(pdf, 'text/html'), false)
  assert.equal(c.taskFileContentMatches(new Uint8Array(), 'application/pdf'), false)
  // A multi-byte character split at the end of the sample is still valid UTF-8 text.
  const split = new TextEncoder().encode('ab✓').slice(0, 4)
  assert.equal(c.taskFileContentMatches(split, 'text/plain'), true)
  assert.match(fs.readFileSync('lib/task-file-content.ts', 'utf8'), /import \{ validateProfileFile \} from "@\/lib\/student-profile"/)
})

function bucket(signed = { data: { signedUrl: 'https://storage.test/object' }, error: null }) {
  const calls = []
  return { calls, createSignedUrl: async (path, ttl) => { calls.push({ path, ttl }); return signed } }
}

test('the head is read with a range request and capped even when the range is ignored', async () => {
  const b = bucket(), seen = []
  const ranged = await c.readStoredHead(b, 'a/b', async (url, init) => { seen.push({ url, init }); return new Response(new Uint8Array(16).fill(65), { status: 206 }) }, 16)
  assert.equal(ranged.ok, true)
  assert.equal(ranged.head.length, 16)
  assert.deepEqual(b.calls, [{ path: 'a/b', ttl: 60 }])
  assert.equal(seen[0].url, 'https://storage.test/object')
  assert.equal(seen[0].init.headers.Range, 'bytes=0-15')
  assert.equal(seen[0].init.cache, 'no-store')

  let cancelled = false
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(10).fill(66)) },
    cancel() { cancelled = true },
  })
  const full = await c.readStoredHead(bucket(), 'a/b', async () => new Response(stream, { status: 200 }), 25)
  assert.equal(full.head.length, 25)
  assert.ok(cancelled)
})

test('unreadable objects report a reason instead of bytes', async () => {
  assert.deepEqual(await c.readStoredHead(bucket({ data: null, error: { message: 'missing' } }), 'a/b', async () => { throw Error('not called') }), { ok: false, reason: 'sign' })
  assert.deepEqual(await c.readStoredHead(bucket(), 'a/b', async () => new Response('missing', { status: 404 })), { ok: false, reason: 'status' })
  assert.deepEqual(await c.readStoredHead(bucket(), 'a/b', async () => { throw Object.assign(Error('timeout'), { name: 'TimeoutError' }) }), { ok: false, reason: 'fetch' })
  assert.deepEqual(await c.readStoredHead(bucket(), 'a/b', async () => new Response(new Uint8Array(), { status: 206 })), { ok: false, reason: 'empty' })
})

const file = { path: 'assignment/object', size: 9, mime: 'application/pdf' }
function storage({ head = '%PDF-1.7\n', listError = null, removeResult = { data: [], error: null }, removeThrows = false, listed = [{ name: 'object', metadata: { size: 9, mimetype: 'application/pdf' } }] } = {}) {
  const removed = []
  const fetchImpl = async () => new Response(new TextEncoder().encode(head), { status: 206 })
  return {
    removed, fetchImpl,
    bucket: {
      createSignedUrl: async () => ({ data: { signedUrl: 'https://storage.test/object' }, error: null }),
      list: async () => listError ? { data: null, error: listError } : { data: listed, error: null },
      remove: async (paths) => { removed.push(...paths); if (removeThrows) throw Error('network'); return removeResult },
    },
  }
}
async function logged(fn) {
  const original = console.error, lines = []
  console.error = (...args) => lines.push(args)
  try { return { result: await fn(), lines } } finally { console.error = original }
}

test('a matching stored file passes; a missing or resized object is incomplete', async () => {
  const ok = storage()
  assert.equal(await c.checkStoredTaskFile(ok.bucket, file, ok.fetchImpl), 'ok')
  const missing = storage({ listed: [] })
  assert.equal(await c.checkStoredTaskFile(missing.bucket, file, missing.fetchImpl), 'incomplete')
  const resized = storage({ listed: [{ name: 'object', metadata: { size: 10, mimetype: 'application/pdf' } }] })
  assert.equal(await c.checkStoredTaskFile(resized.bucket, file, resized.fetchImpl), 'incomplete')
})

test('a mismatch deletes the object; a remove error (returned or thrown) is logged with the path', async () => {
  const clean = storage({ head: '<html>' })
  const quiet = await logged(() => c.checkStoredTaskFile(clean.bucket, file, clean.fetchImpl))
  assert.equal(quiet.result, 'mismatch')
  assert.deepEqual(clean.removed, [file.path])
  assert.equal(quiet.lines.length, 0)

  const returned = storage({ head: '<html>', removeResult: { data: null, error: { name: 'StorageApiError', message: 'denied' } } })
  const a = await logged(() => c.checkStoredTaskFile(returned.bucket, file, returned.fetchImpl))
  assert.equal(a.result, 'mismatch')
  assert.equal(a.lines[0][0], 'task.file.mismatch.remove.failure')
  assert.deepEqual(a.lines[0][1], { path: file.path, code: 'StorageApiError' })

  const thrown = storage({ head: '<html>', removeThrows: true })
  const b = await logged(() => c.checkStoredTaskFile(thrown.bucket, file, thrown.fetchImpl))
  assert.equal(b.result, 'mismatch')
  assert.equal(b.lines[0][1].path, file.path)
})

test('a Storage outage or fetch timeout is logged and reported as a retryable check failure', async () => {
  const outage = storage({ listError: { name: 'StorageUnknownError', message: 'down' } })
  const a = await logged(() => c.checkStoredTaskFile(outage.bucket, file, outage.fetchImpl))
  assert.equal(a.result, 'unavailable')
  assert.deepEqual(a.lines[0], ['task.file.check.unavailable', { path: file.path, stage: 'list', code: 'StorageUnknownError' }])
  assert.deepEqual(outage.removed, [])

  const slow = storage()
  const b = await logged(() => c.checkStoredTaskFile(slow.bucket, file, async () => { throw Object.assign(Error('timed out'), { name: 'TimeoutError' }) }))
  assert.equal(b.result, 'unavailable')
  assert.deepEqual(b.lines[0], ['task.file.check.unavailable', { path: file.path, stage: 'fetch' }])
  assert.deepEqual(slow.removed, [])

  assert.equal(c.taskFileCheckMessage(['ok', 'unavailable']), "We couldn’t check your file right now. Try again in a minute.")
  assert.equal(c.taskFileCheckMessage(['unavailable', 'mismatch']), c.TASK_FILE_MISMATCH)
  assert.equal(c.taskFileCheckMessage(['unavailable', 'incomplete']), c.TASK_FILE_INCOMPLETE)
  assert.equal(c.taskFileCheckMessage(['ok', 'ok']), null)
})

test('submitTask checks every file in parallel before the submission transaction', () => {
  const source = fs.readFileSync('actions/tasks.ts', 'utf8')
  const submit = source.slice(source.indexOf('export async function submitTask'), source.indexOf('export async function reviewTask'))
  const check = submit.indexOf('Promise.all(files.map((file) => checkStoredTaskFile(bucket, file)))'), tx = submit.indexOf('prisma.$transaction')
  assert.ok(check > 0 && check < tx)
  assert.doesNotMatch(submit, /for \(const file of files\)/)
})

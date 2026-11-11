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
  assert.equal(ranged.length, 16)
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
  assert.equal(full.length, 25)
  assert.ok(cancelled)
})

test('unreadable objects return null so callers report an incomplete upload, not a mismatch', async () => {
  assert.equal(await c.readStoredHead(bucket({ data: null, error: { message: 'missing' } }), 'a/b', async () => { throw Error('not called') }), null)
  assert.equal(await c.readStoredHead(bucket(), 'a/b', async () => new Response('missing', { status: 404 })), null)
  assert.equal(await c.readStoredHead(bucket(), 'a/b', async () => { throw Error('network') }), null)
  assert.equal(await c.readStoredHead(bucket(), 'a/b', async () => new Response(new Uint8Array(), { status: 206 })), null)
})

test('submitTask checks stored bytes before the submission transaction and deletes mismatches', () => {
  const source = fs.readFileSync('actions/tasks.ts', 'utf8')
  const submit = source.slice(source.indexOf('export async function submitTask'), source.indexOf('export async function reviewTask'))
  const check = submit.indexOf('taskFileContentMatches('), tx = submit.indexOf('prisma.$transaction')
  assert.ok(check > 0 && check < tx)
  assert.match(submit, /readStoredHead\(bucket!, file\.path\)/)
  assert.match(submit, /remove\(\[file\.path\]\)[\s\S]{0,80}throw new Error\(TASK_FILE_MISMATCH\)/)
})

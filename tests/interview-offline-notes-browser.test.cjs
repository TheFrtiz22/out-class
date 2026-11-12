const { test, before, after } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright'), { bundle } = require('./helpers/browser-bundle.cjs')
// The real interview room (InterviewKitSession + useInterviewOfflineNotes + real IndexedDB and Web
// Crypto) in Chromium. Auth and the interview server actions are fixtures: the "server" lives in this
// test process, so it survives page reloads. Offline = Playwright context.setOffline plus every API
// request aborted as disconnected. The page shell itself is served by the route even while offline
// (production's service worker shows /offline.html for an offline full reload; see the doc).
const ORIGIN = 'http://localhost:47391'
const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2'
const scope = { clubId: '00000000-0000-4000-8000-000000000001', applicationId: '00000000-0000-4000-8000-000000000002', roundId: '00000000-0000-4000-8000-000000000003' }
const BANNER = "You're offline. Your notes are kept on this device and will save when you reconnect."
const mocks = {
  '@/contexts/auth-context': "const q=new URLSearchParams(location.search);exports.useAuth=()=>({user:{id:q.get('user')},isImpersonating:q.has('support')})",
  '@/contexts/demo-mode': "exports.useDemoMode=()=>({isDemoEnabled:new URLSearchParams(location.search).has('demo')})",
  '@/lib/workspace-api': "async function call(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error);return j}exports.openInterviewSession=s=>call('/api/open',s);exports.saveInterviewSession=s=>call('/api/save',s);exports.getInterviewKit=async()=>({questions:[],version:1});exports.getPreviousInterviewScores=async()=>[];",
  '@/hooks/use-interview-workspace': "exports.useInterviewWorkspace=()=>({clientId:'tab',view:null,error:'',refresh:async()=>{},dismiss:async()=>{},select:async id=>({revision:1,question:{id,prompt:'',guidance:''}})})",
  '@/components/interview-timer': 'exports.InterviewTimer=()=>null',
  '@/components/interview-review-references': 'exports.EarlierRounds=()=>null;exports.RoundScore=()=>null',
  '@/lib/demo/interview-collaboration': 'module.exports={}',
}
const entry = `import React,{useRef}from'react';import{createRoot}from'react-dom/client';import{InterviewKitSession}from'@/components/interview-kit-session';import{sealAutosaveDraftsForSignOut}from'@/lib/autosave-store';
const scope=${JSON.stringify(scope)};
function App(){const form=useRef(null);return <main><button type="button" onClick={async()=>{await sealAutosaveDraftsForSignOut();document.body.dataset.signedOut='true'}}>Fixture sign out</button><InterviewKitSession {...scope} formRef={form} onState={()=>{}} onComplete={()=>{document.body.dataset.submitted='true'}}/></main>}
createRoot(document.getElementById('root')).render(<App/>);`
let js, browser
const emptyDraft = () => ({ questionNotes: [], additionalQuestions: [], overallReview: '', additionalNotes: '', applicantQuestions: '', completedQuestionIds: [], score: null })
before(async () => { js = bundle(entry, mocks); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function room() {
  const server = { record: { id: 'session-1', revision: 0, questions: [{ id: '00000000-0000-4000-8000-000000000011', prompt: 'Fictional question one', guidance: '' }], draft: emptyDraft(), completedAt: null }, saves: [], down: false }
  const context = await browser.newContext(), errors = []
  await context.route(ORIGIN + '/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: js })
    if (url.pathname.startsWith('/api/')) {
      if (server.down) return route.abort('internetdisconnected')
      const input = JSON.parse(route.request().postData() || '{}'), reply = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
      if (url.pathname === '/api/open') return reply(200, server.record)
      server.saves.push(input)
      if (server.record.completedAt) return reply(400, { error: 'This interview is already completed.' })
      if (input.revision !== server.record.revision) return reply(409, { error: 'A newer draft exists. Reload before saving.' })
      server.record = { ...server.record, draft: input.draft, revision: server.record.revision + 1, completedAt: input.complete ? new Date().toISOString() : null }
      return reply(200, { session: server.record, evaluation: input.complete ? { id: 'evaluation' } : null })
    }
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' })
  })
  const offline = async value => { server.down = value; await context.setOffline(value) }
  const open = async (user = A, query = '') => { const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(`${ORIGIN}/?user=${user}${query}`); return page }
  return { server, context, errors, offline, open }
}
const notes = page => page.getByRole('textbox', { name: 'Miscellaneous notes', exact: true })
const savedStatus = page => page.getByText('All changes saved', { exact: true }).waitFor()
// Read IndexedDB as the page sees it, decrypting with the page's own non-extractable key.
const vault = page => page.evaluate(async () => {
  if (!(await indexedDB.databases()).some(d => d.name === 'outclass-offline')) return { exists: false, records: [] }
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('outclass-offline'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const get = (store, fn) => new Promise((resolve, reject) => { const r = fn(db.transaction(store).objectStore(store)); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const records = await get('interview-notes', s => s.getAll()), key = await get('device-keys', s => s.get('interview-notes-v1'))
  const out = []
  for (const record of records) {
    const plain = key ? await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv, additionalData: new TextEncoder().encode(record.key) }, key, record.data).then(b => JSON.parse(new TextDecoder().decode(b)), () => null) : null
    out.push({ key: record.key, owner: record.owner, ciphertextOnly: record.data instanceof ArrayBuffer && !('value' in record), plain })
  }
  db.close()
  return { exists: true, hasKey: !!key, keyExtractable: key?.extractable, records: out }
})
const until = async (fn, ms = 5000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw Error('Timed out waiting'); await new Promise(r => setTimeout(r, 50)) } }

test('typing offline, reloading while offline, then reconnecting saves the notes', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Saved before the drop.'); await savedStatus(page)
    await r.offline(true)
    await notes(page).fill('Saved before the drop. Typed while offline.')
    const banner = page.getByRole('status').filter({ hasText: BANNER })
    await banner.waitFor()
    assert.equal(await banner.getAttribute('aria-live'), 'polite')
    const stored = await until(async () => { const v = await vault(page); return v.records.length && v.records[0].plain?.value.additionalNotes.endsWith('offline.') && v })
    assert.equal(stored.records[0].key, `${A}:${scope.clubId}:${scope.applicationId}:${scope.roundId}`)
    assert.equal(stored.records[0].ciphertextOnly, true); assert.equal(stored.keyExtractable, false)
    assert.equal('score' in stored.records[0].plain.value, false)

    // Reload while still offline: the session cannot open, the banner and the local draft show at once.
    await page.reload()
    await page.getByRole('status').filter({ hasText: BANNER }).waitFor()
    assert.match(await page.getByRole('textbox', { name: 'Your unsaved notes on this device (read-only)' }).inputValue(), /Typed while offline\./)
    assert.equal(r.server.record.draft.additionalNotes, 'Saved before the drop.')

    // Reconnect: the session reopens, the copy is restored and saved through the revision check.
    await r.offline(false)
    await until(() => r.server.record.draft.additionalNotes === 'Saved before the drop. Typed while offline.')
    await savedStatus(page)
    assert.equal(await notes(page).inputValue(), 'Saved before the drop. Typed while offline.')
    assert.equal(r.server.saves.at(-1).revision, 1)
    await until(async () => (await vault(page)).records.length === 0)
    assert.equal(await page.getByText(BANNER).count(), 0)

    // Offline again, then a reload once back online: restored and saved automatically.
    await r.offline(true)
    await notes(page).fill('Second offline edit.')
    await until(async () => (await vault(page)).records[0]?.plain?.value.additionalNotes === 'Second offline edit.')
    await page.close(); await r.offline(false)
    page = await r.open()
    await until(() => r.server.record.draft.additionalNotes === 'Second offline edit.')
    await savedStatus(page)
    await until(async () => (await vault(page)).records.length === 0)
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('a conflict on reconnect shows the existing conflict choice and overwrites nothing', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Base.'); await savedStatus(page)
    await r.offline(true)
    await notes(page).fill('Base. Mine, typed offline.')
    await until(async () => (await vault(page)).records[0]?.plain?.value.additionalNotes === 'Base. Mine, typed offline.')
    // Another device saves meanwhile.
    r.server.record = { ...r.server.record, revision: r.server.record.revision + 1, draft: { ...r.server.record.draft, additionalNotes: 'Base. From another device.' } }

    // Reconnect in the same page: the revision check rejects the save and the existing choice appears.
    await r.offline(false)
    await page.getByRole('button', { name: 'Load latest version, keep my text', exact: true }).waitFor()
    assert.equal(r.server.record.draft.additionalNotes, 'Base. From another device.')
    assert.equal(await notes(page).inputValue(), 'Base. Mine, typed offline.')
    assert.equal((await vault(page)).records[0].plain.value.additionalNotes, 'Base. Mine, typed offline.')

    // Reload: the device copy is older than the server, so the conflict choice shows; nothing is applied or saved.
    const savesBefore = r.server.saves.length
    await page.close(); page = await r.open()
    await page.getByText('This device has changes from before a newer version was saved elsewhere.').waitFor()
    assert.equal(await notes(page).inputValue(), 'Base. From another device.')
    assert.equal(await notes(page).isDisabled(), true)
    await page.getByRole('button', { name: 'Review my copy', exact: true }).click()
    assert.match(await page.getByRole('textbox', { name: 'Your earlier copy (read-only)' }).inputValue(), /Mine, typed offline\./)
    await new Promise(res => setTimeout(res, 1200))
    assert.equal(r.server.saves.length, savesBefore); assert.equal(r.server.record.draft.additionalNotes, 'Base. From another device.')
    assert.equal((await vault(page)).records.length, 1)
    // Only the interviewer's explicit "Keep newer version" deletes the device copy.
    await page.getByRole('button', { name: 'Keep newer version', exact: true }).click()
    await until(async () => (await vault(page)).records.length === 0)
    assert.equal(await notes(page).isDisabled(), false)
    assert.equal(r.server.record.draft.additionalNotes, 'Base. From another device.')
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('sign-out clears the local copy and its key; another account gets nothing and the stale entry is deleted', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).waitFor(); await r.offline(true)
    await notes(page).fill('Private notes of account A.')
    await until(async () => (await vault(page)).records.length === 1)
    await page.getByRole('button', { name: 'Fixture sign out' }).click()
    await page.waitForSelector('body[data-signed-out="true"]')
    const cleared = await vault(page)
    assert.deepEqual(cleared.records, []); assert.equal(cleared.hasKey, false)
    await page.close()

    // Account A leaves a copy; account B opens the same interview in this browser.
    await r.offline(false); page = await r.open(A); await notes(page).waitFor(); await r.offline(true)
    await notes(page).fill('Account A again, offline.')
    await until(async () => (await vault(page)).records.length === 1)
    await page.close(); await r.offline(false)
    page = await r.open(B)
    await savedStatus(page)
    assert.equal(await notes(page).inputValue(), '')
    await until(async () => (await vault(page)).records.length === 0)
    assert.equal(r.server.saves.length, 0)
    assert.equal(await page.getByText('This device has changes', { exact: false }).count(), 0)
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('submitted evaluations, scores, Demo Mode and support sessions are never stored on the device', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Final notes.'); await savedStatus(page)
    await page.getByRole('button', { name: 'End current interview', exact: true }).click()
    await page.getByRole('heading', { name: 'Post-interview' }).waitFor()
    await r.offline(true)
    await page.getByRole('slider').press('End')
    await notes(page).fill('Final notes. Last thought offline.')
    const copy = await until(async () => (await vault(page)).records[0]?.plain)
    assert.equal('score' in copy.value, false); assert.equal(copy.value.postInterview, true)
    await r.offline(false)
    await until(() => r.server.record.draft.additionalNotes === 'Final notes. Last thought offline.' && r.server.record.draft.score === 10)
    await page.getByRole('button', { name: 'End post-interview', exact: true }).click()
    await page.waitForSelector('body[data-submitted="true"]')
    await until(async () => (await vault(page)).records.length === 0)
    assert.ok(r.server.record.completedAt)
    await page.close()
    // Reopening a submitted interview offline-and-back never writes a copy.
    page = await r.open()
    await page.getByText('Submitted · Read only').waitFor()
    await r.offline(true); await new Promise(res => setTimeout(res, 300))
    assert.equal((await vault(page)).records.length, 0)
    assert.equal(await page.getByText(BANNER).count(), 0)
    await r.offline(false); await page.close()

    // Demo Mode and support sessions keep the tab-only behavior: no IndexedDB database at all.
    for (const query of ['&demo', '&support']) {
      const fresh = await room()
      try {
        const p = await fresh.open(A, query)
        await notes(p).fill('Demo typing.'); await savedStatus(p)
        await fresh.offline(true)
        await notes(p).fill('Demo typing offline.')
        await p.getByText('Offline · notes kept in this tab').or(p.getByText('Saving…')).first().waitFor()
        await new Promise(res => setTimeout(res, 300))
        assert.equal((await vault(p)).exists, false, query)
        assert.equal(await p.getByText(BANNER).count(), 0)
      } finally { await fresh.context.close() }
    }
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

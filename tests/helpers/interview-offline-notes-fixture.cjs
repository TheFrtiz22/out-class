const { chromium } = require('playwright'), { bundle } = require('./browser-bundle.cjs')
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
  // window.__user can be set to null mid-session (a failed /api/users/me) by dispatching 'fixture-auth'.
  '@/contexts/auth-context': "const React=require('react'),q=new URLSearchParams(location.search);window.__user=q.get('user');exports.useAuth=()=>{const id=React.useSyncExternalStore(f=>{addEventListener('fixture-auth',f);return()=>removeEventListener('fixture-auth',f)},()=>window.__user);return {user:id?{id}:null,isImpersonating:q.has('support')}}",
  '@/contexts/demo-context': "exports.useDemoMode=()=>({isDemoEnabled:new URLSearchParams(location.search).has('demo')})",
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
async function start() { js ??= bundle(entry, mocks); browser = await chromium.launch({ headless: true }) }
async function stop() { await browser?.close() }

async function room() {
  const server = { record: { id: 'session-1', revision: 0, questions: [{ id: '00000000-0000-4000-8000-000000000011', prompt: 'Fictional question one', guidance: '' }], draft: emptyDraft(), completedAt: null }, saves: [], down: false }
  const context = await browser.newContext(), errors = []
  // ?noidb: IndexedDB writes fail (private mode, quota): IDBObjectStore.put throws.
  await context.addInitScript(() => { if (location.search.includes('noidb')) IDBObjectStore.prototype.put = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError') } })
  await context.route(ORIGIN + '/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: js })
    if (url.pathname.startsWith('/api/')) {
      if (server.down || (server.blockSaves && url.pathname === '/api/save')) return route.abort('internetdisconnected')
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

module.exports = { ORIGIN, A, B, scope, BANNER, start, stop, room, notes, savedStatus, vault, until }

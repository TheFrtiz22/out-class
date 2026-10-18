const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const { bundle } = require('./helpers/browser-bundle.cjs')
const { harness } = require('./helpers/demo-harness.cjs')

test('browser: Demo interview entry, direct links and redundant club selection retain the room and drafts', async () => {
  const h = harness(), store = h.load('lib/demo/store.ts')
  store.demoStore.start()
  store.demoStore.mutate(s => { s.perspective.role = 'leader' })
  const clubId = store.demoStore.get().clubs[0].id, user = store.demoUser()
  const workspace = h.load('lib/demo/interview-foundation.ts').getInterviewWorkspace(clubId)
  assert.ok(workspace.applications.length)
  assert.equal(h.calls(), 0)
  store.demoStore.stop()
  // Actual providers and interview queue; Auth/database and the child writing
  // surface are isolated fixtures. No production login or endpoint is involved.
  const mocks = {
    '@/components/outclass-loading-screen': "const React=require('react');exports.OutClassLoadingScreen=()=>React.createElement('p',null,'Loading Demo');",
    '@/components/workspace-loading': "const React=require('react');exports.WorkspaceLoading=()=>React.createElement('p',null,'Loading candidates');",
    '@/components/product/page-header': "const React=require('react');exports.PageHeader=({title})=>React.createElement('h1',null,title);",
    '@/lib/demo/store': `const seed={clubs:[{id:${JSON.stringify(clubId)}}],perspective:{role:'student',clubId:${JSON.stringify(clubId)}},savedWork:'keep existing demo work'};let state,active=false;const listeners=new Set();exports.demoStore={subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},active:()=>active,get:()=>state,start:()=>{state=JSON.parse(localStorage.getItem('demo-navigation-fixture')||JSON.stringify(seed));active=true;listeners.forEach(fn=>fn())},stop:()=>{active=false},mutate:fn=>{fn(state);localStorage.setItem('demo-navigation-fixture',JSON.stringify(state));listeners.forEach(fn=>fn())}};exports.demoUser=()=>(${JSON.stringify(user)});`,
    '@/lib/application-state': `const focus={clubId:${JSON.stringify(clubId)}};exports.useApplicationState=()=>({leaderFocus:focus,clearLeaderFocus(){}});`,
    '@/lib/workspace-api': `exports.resolveInterviewRoomEntry=async input=>input;exports.getInterviewWorkspace=async()=>(${JSON.stringify(workspace)});exports.openInterviewSession=async()=>{};exports.getInterviewApplicantPanel=async()=>{};exports.prepareInterviewAdvance=async()=>{};exports.confirmInterviewAdvance=async()=>{};`,
    '@/components/demo-workspace': 'exports.DemoInterviewGuide=()=>null;',
    '@/components/interview-applicant-panel': 'exports.InterviewApplicantPanel=()=>null;',
    '@/components/interview-kit-session': `const React=require('react');exports.InterviewKitSession=()=>{const[note,setNote]=React.useState('');return React.createElement('section',{'aria-label':'Fixture writing surface'},React.createElement('label',null,'Unsaved draft',React.createElement('textarea',{value:note,onChange:e=>setNote(e.target.value)})))}`,
  }
  const entry = `import React,{useEffect,useSyncExternalStore} from 'react';import{createRoot}from'react-dom/client';import{DemoDataProvider,useDemoMode}from'@/contexts/demo-context';import{AuthProvider,useAuth}from'@/contexts/auth-context';import{InterviewWorkspaceView}from'@/components/views/interview-workspace-view';
const clubId=${JSON.stringify(clubId)};for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);dispatchEvent(new Event('popstate'))}}const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};
function Workspace(){const href=useSyncExternalStore(subscribe,()=>location.href),{selectClub}=useAuth(),demo=useDemoMode(),room=new URL(href).searchParams.get('section')==='recruitment'&&new URL(href).searchParams.get('interview')==='1';useEffect(()=>{if(demo.state?.perspective.role!=='leader')selectClub(clubId)},[demo.state?.perspective.role]);return <><button onClick={()=>selectClub(clubId)}>Reselect club</button>{room?<InterviewWorkspaceView scoped/>:<><h1>Club overview</h1><button onClick={()=>history.pushState({},'', '/club/'+clubId+'/workspace?section=recruitment&tool=interviews&interview=1')}>Interview room</button></>}</>};createRoot(document.getElementById('root')).render(<DemoDataProvider allowed enabled><AuthProvider hasSession={false}><Workspace/></AuthProvider></DemoDataProvider>);`
  const js = bundle(entry, mocks)
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/fixture.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) })
    const base = `http://127.0.0.1:${server.address().port}`, route = '/club/' + clubId + '/workspace', context = await browser.newContext()
    const page = await context.newPage(), errors = [], requests = []
    page.setDefaultTimeout(10000)
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => requests.push({ url: r.url(), method: r.method() }))
    await page.goto(base + route)
    await page.getByRole('heading', { name: 'Club overview' }).waitFor()
    await page.getByRole('button', { name: 'Interview room', exact: true }).click()
    await page.getByRole('button', { name: 'Open first candidate', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Unsaved draft' })
    await draft.fill('Keep this unsaved interview draft')
    await page.getByRole('button', { name: 'Reselect club', exact: true }).click()
    assert.equal(await draft.inputValue(), 'Keep this unsaved interview draft')
    assert.equal(new URL(page.url()).searchParams.get('section'), 'recruitment')
    assert.equal(await page.getByRole('heading', { name: 'Club overview' }).count(), 0)
    await page.reload()
    await draft.waitFor()
    assert.equal(new URL(page.url()).searchParams.get('interview'), '1')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('demo-navigation-fixture')).savedWork), 'keep existing demo work')
    // Simulate an existing browser session saved in the student perspective.
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('demo-navigation-fixture')); s.perspective.role = 'student'; localStorage.setItem('demo-navigation-fixture', JSON.stringify(s)) })
    await page.goto(base + route + '?section=recruitment&tool=interviews&interview=1')
    await draft.waitFor()
    assert.equal(new URL(page.url()).searchParams.get('section'), 'recruitment')
    assert.equal(await page.getByRole('heading', { name: 'Club overview' }).count(), 0)
    assert.deepEqual(errors, [])
    assert.ok(requests.every(r => new URL(r.url).origin === base && r.method === 'GET' && !new URL(r.url).pathname.startsWith('/api/')), 'No live reads or writes')
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})

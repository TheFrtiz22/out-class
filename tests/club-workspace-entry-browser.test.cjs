const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');
const { bundle } = require('./helpers/browser-bundle.cjs');

test('browser: workspace entry, explicit choices, club changes and history stay synchronized on desktop and mobile', async () => {
  // Real workspace, shell, permission checks and preference storage. Auth/data and
  // unrelated content surfaces are synthetic; this never contacts a live service.
  const mocks = {};
  for (const file of ['components/club-workspace.tsx', 'components/shell/product-shell.tsx']) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/["'](@\/components\/[^"']+)["']/g)) {
      mocks[match[1]] = 'module.exports=new Proxy({},{get:()=>()=>null});';
    }
  }
  delete mocks['@/components/shell/product-shell'];
  Object.assign(mocks, {
    'next/dynamic': 'module.exports=()=>()=>null;',
    'next/link': `const React=require('react');module.exports=({href,onClick,children,prefetch,...props})=>React.createElement('a',{...props,href,onClick:e=>{onClick?.(e);if(!e.defaultPrevented&&!e.ctrlKey&&!e.metaKey){e.preventDefault();history.pushState(null,'',href)}}},children);`,
    'next/navigation': `const React=require('react');const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};const router={push:href=>history.pushState(null,'',href),replace:href=>history.replaceState(null,'',href)};exports.useRouter=()=>router;exports.useSearchParams=()=>new URLSearchParams(React.useSyncExternalStore(subscribe,()=>location.search));`,
    '@/contexts/auth-context': `const React=require('react');const member=id=>({id:'member-'+id,clubId:id,status:'ACTIVE',isOwner:false,permissions:id==='limited'?['tasks.manage']:['applications.review'],club:{id,name:id,color:'#142d45'}});const user={id:'fixture-user',email:'fixture@example.test',memberships:['one','two','limited'].map(member)};let selected='one';const listeners=new Set(),subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)},selectClub=id=>{selected=id;listeners.forEach(fn=>fn())};exports.useAuth=()=>({user,loading:false,activeClubId:React.useSyncExternalStore(subscribe,()=>selected),selectClub});`,
    '@/contexts/demo-context': 'exports.useDemoMode=()=>({ready:true,isDemoEnabled:false});',
    '@/contexts/organization-invitations-context': 'exports.useOrganizationInvitations=()=>({invitations:[]});',
    '@/lib/application-state': `exports.ApplicationStateProvider=({children})=>children;const state={notifications:[],durableUnread:0,syncTaskNotifications(){},syncDurableNotifications(){},focusLeader(){}};exports.useApplicationState=()=>state;`,
    '@/lib/workspace-api': `exports.getClubWorkspaceOverview=async id=>({club:{id,name:id},membership:{permissions:['applications.review']}});exports.getWorkspaceRounds=async()=>[];exports.getTaskNotifications=async()=>[];`,
    '@/actions/communications': 'exports.getDurableNotifications=async()=>({});',
    '@/utils/supabase/client': 'exports.createClient=()=>({});',
    '@/components/workspace-loading': `const React=require('react');exports.WorkspaceLoading=({label})=>React.createElement('p',{role:'status'},label);`,
    '@/components/product/page-header': `const React=require('react');exports.PageHeader=({title})=>React.createElement('h1',null,title);`,
    '@/components/shell/floating-header-controls': `const React=require('react');exports.FloatingModeNavigation=({children})=>React.createElement('nav',{'aria-label':'Product modes'},children);exports.FloatingSearchTrigger=()=>null;`,
  });
  const entry = `import React,{useSyncExternalStore}from'react';import{createRoot}from'react-dom/client';import{ClubWorkspace}from'@/components/club-workspace';
window.EventSource=class{addEventListener(){}close(){}};for(const method of ['pushState','replaceState']){const native=history[method].bind(history);history[method]=(...args)=>{native(...args);dispatchEvent(new Event('popstate'))}}const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};function App(){const pathname=useSyncExternalStore(subscribe,()=>location.pathname);return <ClubWorkspace key={pathname} clubId={pathname.split('/')[2]} section="overview"/>}createRoot(document.getElementById('root')).render(<App/>);`;
  const js = bundle(entry, mocks);
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/fixture.js' ? js : '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [];
      page.setDefaultTimeout(7000);
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { window.renderedModes = []; new MutationObserver(() => { const link = document.querySelector('[data-tour^="mode-"][aria-current="page"]'); if (link) window.renderedModes.push(link.textContent) }).observe(document, { childList: true, subtree: true, attributes: true }) });
      const go = id => page.goto(base + '/club/' + id + '/workspace');
      const switchClub = id => page.evaluate(id => history.pushState(null, '', '/club/' + id + '/workspace'), id);
      const mode = id => page.locator('[data-tour="mode-' + id + '"]');
      const active = id => page.waitForSelector('[data-tour="mode-' + id + '"][aria-current="page"]');
      await go('one'); await active('recruiting');
      assert.ok((await page.evaluate(() => window.renderedModes)).every(value => value === 'Recruiting'), 'Club must never flash during first entry');
      await mode('club').click(); await active('club');
      assert.equal(new URL(page.url()).searchParams.get('section'), 'overview');
      await go('one'); await active('club');
      await switchClub('two'); await active('recruiting');
      await mode('club').click(); await active('club');
      await switchClub('limited'); await active('club');
      assert.equal(await mode('recruiting').count(), 0);
      await page.goto(base + '/club/one/workspace?section=tasks&taskView=mine');
      await active('club'); assert.equal(new URL(page.url()).searchParams.get('taskView'), 'mine');
      await mode('recruiting').click(); await active('recruiting');
      await page.goBack(); await active('club');
      assert.equal(new URL(page.url()).searchParams.get('section'), 'tasks');
      await go('one'); await active('recruiting');
      await page.reload(); await active('recruiting');
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});

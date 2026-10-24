const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const http=require('node:http')
const path=require('node:path')
const {chromium}=require('playwright')
const {expect}=require('playwright/test')
const AxeBuilder=require('@axe-core/playwright').default
const {bundle}=require('./helpers/browser-bundle.cjs')

test('club logos: PNG/SVG/JPEG analysis, shared presentation, manual publication and reload, legacy and broken images',async()=>{
  let saved=null
  const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {ClubProfileEditor} from '@/components/clubs/club-profile-editor';import {ClubLogo} from '@/components/club-logo';import {DirectoryLogo} from '@/components/clubs/directory-logo';import {MarketingProfile} from '@/components/clubs/marketing-profile';import {profileDraft} from '@/lib/club-marketing';
const initial=profileDraft(window.initial||{name:'Campus Consulting Group',category:'Consulting',color:'#142D45',logoUrl:'/logos/white.png'});
const modes=[['white-png','/logos/white.png',{}],['white-svg','/logos/white.svg',{}],['dark','/logos/dark.png',{}],['opaque','/logos/opaque.jpg',{}],['manual','/logos/white.png',{logoBackground:{mode:'custom',color:'#315B51'}}],['legacy','/logos/white.png',{logoOnBrand:true}],['broken','/logos/missing.png',{}]];
function Replacement(){const [source,setSource]=React.useState(null);return <div data-logo-case="replacement"><ClubLogo clubId="12345678-1234-1234-1234-123456789abc" logoUrl={source} text="CC" color="#315B51" alt="Replacement club"/><button onClick={()=>setSource('/logos/missing.png')}>Break replacement</button><button onClick={()=>setSource('/logos/dark.png')}>Load replacement</button></div>}
createRoot(document.getElementById('root')).render(<main><Replacement/><h1>Club logo settings</h1><ClubProfileEditor initial={initial} onSave={async value=>{await fetch('/profile',{method:'POST',body:JSON.stringify(value)})}}/><section aria-label="Shared logo presentation">{modes.map(([id,logoUrl,marketing])=><div key={id} data-logo-case={id}><h2>{id}</h2><ClubLogo logoUrl={logoUrl} marketing={marketing} text="CC" color="#315B51" alt={id} size="lg"/></div>)}<div data-logo-case="directory"><DirectoryLogo club={{id:'club',source:'database',logoUrl:'/logos/white.png',marketing:initial.marketing,color:initial.color,logoText:'CC'}}/></div><div data-logo-case="profile"><MarketingProfile compact profile={initial}/></div></section></main>);`
  const script=bundle(entry,{
    '@/hooks/use-editor-draft':`exports.useEditorDraft=()=>({ready:true,recovery:null,dirty:false,state:'idle',flush:async()=>{},clear:async()=>{},onBlur:()=>{}});`,
    'next/image':`exports.__esModule=true;exports.default=({fill,priority,unoptimized,...p})=>require('react').createElement('img',p);`,
  })
  const css=(await require('postcss')([require('@tailwindcss/postcss')()]).process('@import "../app/globals.css";',{from:path.resolve('tests/logo-fixture.css')})).css
  const sharp=require('sharp')
  const svg=fill=>`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="${fill}" d="M20 20h60v15H35v30h45v15H20z"/></svg>`
  const white=await sharp(Buffer.from(svg('white'))).png().toBuffer(),dark=await sharp(Buffer.from(svg('#142D45'))).png().toBuffer(),opaque=await sharp({create:{width:100,height:100,channels:3,background:'#ffffff'}}).jpeg().toBuffer()
  const server=http.createServer(async(req,res)=>{
    if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(script)}
    const images={'/logos/white.png':['image/png',white],'/logos/dark.png':['image/png',dark],'/logos/opaque.jpg':['image/jpeg',opaque],'/logos/white.svg':['image/svg+xml',svg('white')]}
    if(images[req.url]){res.setHeader('Content-Type',images[req.url][0]);return res.end(images[req.url][1])}
    if(req.url==='/logos/missing.png'){res.writeHead(404);return res.end()}
    if(req.url==='/profile'){let body='';for await(const chunk of req)body+=chunk;saved=JSON.parse(body);return res.end('{}')}
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Club logo settings fixture</title><style>${css}:root{--font-dm-sans:Arial;--font-libre-caslon-text:Georgia}main{max-width:1120px;margin:auto;padding:24px}</style></head><body><div id="root"></div><script>window.initial=${JSON.stringify(saved)}</script><script src="/fixture.js"></script></body></html>`)
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser
  try {
    browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage(),errors=[]
    const requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}`
    await page.goto(url)
    assert.equal(await page.locator('[data-logo-case="replacement"] img').count(),0);assert.ok(!requests.some(path=>path.includes('12345678-1234-1234-1234-123456789abc')));
    await page.getByRole('button',{name:'Break replacement',exact:true}).click();await page.getByRole('img',{name:'Replacement club',exact:true}).waitFor();await expect(page.locator('[data-logo-case="replacement"] img')).toHaveCount(0);
    await page.getByRole('button',{name:'Load replacement',exact:true}).click();await expect(page.locator('[data-logo-case="replacement"] img')).toHaveCSS('opacity','1');
    const background=id=>page.locator(`[data-logo-case="${id}"] img`).first()
    for(const id of ['white-png','white-svg','directory','profile'])await expect(background(id)).toHaveCSS('background-color','rgb(20, 45, 69)')
    await expect(background('dark')).toHaveCSS('background-color','rgb(247, 245, 240)')
    await expect(background('opaque')).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
    await expect(background('manual')).toHaveCSS('background-color','rgb(49, 91, 81)')
    await expect(background('legacy')).toHaveCSS('background-color','rgb(49, 91, 81)')
    await page.getByRole('img',{name:'broken',exact:true}).waitFor();assert.equal(await page.locator('[data-logo-case="broken"] img').count(),0)
    const picker=page.getByRole('group',{name:'Logo background',exact:true})
    await picker.getByRole('button',{name:'Custom',exact:true}).click();await picker.getByRole('textbox',{name:'Custom background hex color'}).fill('#315B51')
    await expect(picker.locator('img')).toHaveCSS('background-color','rgb(49, 91, 81)')
    fs.mkdirSync('test-results/application-writing',{recursive:true});await picker.screenshot({path:'test-results/application-writing/logo-background-preview.png'})
    await page.getByRole('button',{name:'Publish profile',exact:true}).click();await page.getByText(/Profile published/).waitFor()
    assert.deepEqual(saved.marketing.logoBackground,{mode:'custom',color:'#315B51'});assert.equal(saved.logoUrl,'/logos/white.png')
    await page.reload();await expect(picker.getByRole('button',{name:'Custom',exact:true})).toHaveAttribute('aria-pressed','true')
    for(const id of ['directory','profile'])await expect(background(id)).toHaveCSS('background-color','rgb(49, 91, 81)')
    await picker.getByRole('button',{name:'No background',exact:true}).click();await expect(picker.locator('img')).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
    await page.getByRole('textbox',{name:'Club logo image URL'}).fill(url+'/logos/opaque.jpg')
    await picker.getByText(/This image has its own background/).waitFor();await picker.getByText(/little internal contrast/).waitFor()
    const scan=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()
    fs.mkdirSync('test-results/application-writing',{recursive:true});fs.writeFileSync('test-results/application-writing/axe-logo-settings.json',JSON.stringify(scan.violations,null,2))
    assert.deepEqual(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[])
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.screenshot({path:'test-results/application-writing/logo-settings-390.png',fullPage:true})
    assert.deepEqual(errors,[])
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
})

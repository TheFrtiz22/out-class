// The club page's actions on a phone: Apply spans the row; Save and Share sit side by side as equal halves;
// Share alone (no Save, e.g. alumni) spans the row. Real stylesheet in Chromium at 375px.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {chromium}=require('playwright')
const css=fs.readFileSync(path.join(__dirname,'..','components/clubs/club-discovery.css'),'utf8')
const row=inner=>`<div class="oc-club-profile"><div class="oc-club-action-row">${inner}</div></div>`
const page=body=>`<!doctype html><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;padding:16px}button{font:16px sans-serif}${css}</style>${body}`
const open=`<button class="oc-club-apply">Apply</button><div class="space-y-2"><button class="oc-club-follow">Save</button></div><button class="oc-club-share">Share</button><p class="oc-club-action-note">Application deadline: Dec 1</p>`
const closed=`<div class="space-y-2"><button class="oc-club-apply">Save</button></div><button class="oc-club-share">Share</button><p class="oc-club-action-note">Applications aren’t open yet</p>`
const shareOnly=`<button class="oc-club-apply">Apply</button><button class="oc-club-share">Share</button>`
test('club page actions at 375px: Apply full width, Save and Share equal halves, Share alone full width',async()=>{
 const browser=await chromium.launch();try{
  const p=await browser.newPage({viewport:{width:375,height:700}})
  const box=s=>p.locator(s).first().boundingBox()
  await p.setContent(page(row(open)))
  const apply=await box('.oc-club-apply'),save=await box('.oc-club-follow'),share=await box('.oc-club-share')
  assert.ok(apply.width>330,`Apply spans the row (${apply.width})`)
  assert.equal(Math.round(save.y),Math.round(share.y),'Save and Share share a row')
  assert.ok(Math.abs(save.width-share.width)<=1&&save.width>150,`equal halves (${save.width} vs ${share.width})`)
  assert.ok(Math.abs(save.x+save.width+8-share.x)<=1.5,'with the row gap between them')
  await p.setContent(page(row(closed)))
  const csave=await box('.oc-club-apply'),cshare=await box('.oc-club-share')
  assert.equal(Math.round(csave.y),Math.round(cshare.y),'closed: Save and Share share a row')
  assert.ok(Math.abs(csave.width-cshare.width)<=1,'closed: equal halves')
  await p.setContent(page(row(shareOnly)))
  const alone=await box('.oc-club-share'),a2=await box('.oc-club-apply')
  assert.ok(Math.abs(alone.width-a2.width)<=1,`Share alone spans the row (${alone.width} vs ${a2.width})`)
  // Desktop keeps the flex row: Share sits beside Apply at its natural width.
  await p.setViewportSize({width:1280,height:800});await p.setContent(page(row(open)))
  const dshare=await box('.oc-club-share'),dapply=await box('.oc-club-apply')
  assert.ok(dshare.width<200&&Math.round(dshare.y)===Math.round(dapply.y),'desktop: inline actions unchanged')
 }finally{await browser.close()}
})

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process')
const {chromium}=require('playwright')
// Calendar › New event: ".oc-event-editor label" is a grid, so "All-day event", "Enable RSVP" and "RSVP required"
// stretched each checkbox across the whole form row and drew it mid-row, above and away from its words.
test('event editor: each checkbox sits at the start of its label, beside its words',{timeout:90000},async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-event-checks-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true})
 const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')+fs.readFileSync('components/events/events.css','utf8')
 const check=label=>`<label class="oc-event-check"><input type="checkbox">${label}</label>`
 const html=`<!doctype html><html><head><style>${css}</style></head><body><form class="oc-event-editor"><fieldset class="oc-event-editor-fields min-w-0">${check('All-day event')}${check('Enable RSVP')}${check('RSVP required')}</fieldset><aside class="oc-event-editor-preview"></aside></form></body></html>`
 let browser
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage()
  for(const width of [1512,390]){
   await page.setViewportSize({width,height:900});await page.setContent(html)
   for(const name of ['All-day event','Enable RSVP','RSVP required']){
    const box=await page.getByRole('checkbox',{name}).boundingBox(),label=await page.locator('label',{hasText:name}).boundingBox()
    assert.ok(box.width<=24,`${width}px: "${name}" checkbox is ${Math.round(box.width)}px wide`)
    assert.ok(box.x-label.x<=2,`${width}px: "${name}" checkbox starts the label (${Math.round(box.x-label.x)}px in)`)
    assert.ok(label.height<=box.height+16,`${width}px: "${name}" checkbox and words share one line (label ${Math.round(label.height)}px tall)`)
   }
  }
 }finally{await browser?.close();fs.rmSync(tmp,{recursive:true,force:true})}
})

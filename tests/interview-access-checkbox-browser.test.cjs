const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process')
const {chromium}=require('playwright')
// The question-editor office checkboxes sit inside the scheduling manager (.ir-manager), whose button
// touch-target rule stretched them into tall pills. Real compiled CSS; the markup Radix Checkbox renders.
test('interview access: office checkboxes inside the schedule manager stay square at desktop and phone widths',{timeout:90000},async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-office-check-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true})
 const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')+fs.readFileSync('components/interviews/scheduling.css','utf8')+fs.readFileSync('components/clubs/interview-kit-editor.css','utf8')
 const box=office=>`<label class="oc-office-option"><button type="button" role="checkbox" aria-checked="false" aria-label="Jesse: ${office}" data-slot="checkbox" class="peer size-4 shrink-0"></button><span aria-hidden="true">${office}</span></label>`
 const html=`<!doctype html><html><head><style>${css}</style></head><body><main><div class="ir-manager"><ul class="oc-office-rows"><li><fieldset class="oc-office-row"><legend>Jesse</legend><div class="oc-office-options">${['President','Vice-president','Board member'].map(box).join('')}</div></fieldset></li></ul><button type="button" data-slot="button">Save changes</button></div></main></body></html>`
 let browser
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage()
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});await page.setContent(html)
   for(const checkbox of await page.getByRole('checkbox').all()){const b=await checkbox.boundingBox();assert.ok(Math.abs(b.height-b.width)<1,`${width}px: checkbox is square (${b.width}x${b.height})`);assert.ok(b.width>=15&&b.width<=17,`${width}px: checkbox keeps its 16px box`)}
   const label=await page.locator('.oc-office-option').first().boundingBox();assert.ok(label.height>=44,`${width}px: the label keeps a 44px target`)
   const save=await page.getByRole('button',{name:'Save changes'}).boundingBox();assert.ok(save.height>=36,`${width}px: other manager buttons keep their touch target`)
  }
 }finally{await browser?.close();fs.rmSync(tmp,{recursive:true,force:true})}
})

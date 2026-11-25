const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process')
const {chromium}=require('playwright')
// Leader Applicants table: the name cell (avatar + name) sits beside the email in one nowrap cell.
// A long name, or an applicant with no profile name (the email is shown as the name), spilled out of
// the open button and drew over the email. Real compiled CSS; the markup DataTable and ApplicantIdentity render.
test('applicants table: a long applicant name never draws over the email beside it',{timeout:90000},async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-applicant-name-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true})
 const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')
 const row=(label,email)=>`<tr data-openable=""><td data-primary=""><span class="oc-dt-primary"><button type="button" class="oc-dt-open"><span class="oc-applicant-person-row"><span class="oc-applicant-person"><span data-slot="avatar"><span data-slot="avatar-fallback">SA</span></span><span>${label}</span></span></span></button><span class="oc-dt-secondary oc-dt-from-xl">${email}</span></span></td><td>Submitted</td><td>Nov 25</td><td>Not scored</td></tr>`
 const email='outclass-answerkeys-479716a0-applicant@example.com'
 const html=`<!doctype html><html><head><style>${css}</style></head><body><main><div class="oc-dt"><div class="oc-data-surface"><table><thead><tr><th data-primary="">Applicant</th><th>Status</th><th>Submitted</th><th>Score</th></tr></thead><tbody>${row('Synthetic Answer key applicant with a much longer name',email)}${row(email,email)}${row('Ana Li','ana@example.com')}</tbody></table></div></div></main></body></html>`
 let browser
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage()
  await page.setViewportSize({width:1440,height:900});await page.setContent(html)
  const rows=await page.locator('tbody tr').all()
  for(const [i,r] of rows.entries()){
   const name=await r.locator('.oc-applicant-person > span:last-child').boundingBox(),secondary=await r.locator('.oc-dt-secondary').boundingBox(),open=await r.locator('.oc-dt-open').boundingBox()
   assert.ok(secondary&&secondary.width>0,`row ${i}: the email shows at desktop width`)
   assert.ok(name.x+name.width<=open.x+open.width+0.5,`row ${i}: the name stays inside its button (${Math.round(name.x+name.width)} > ${Math.round(open.x+open.width)})`)
   assert.ok(name.x+name.width<=secondary.x+0.5,`row ${i}: the name ends before the email starts (${Math.round(name.x+name.width)} > ${Math.round(secondary.x)})`)
  }
  const short=await rows[2].locator('.oc-applicant-person > span:last-child').evaluate(el=>el.scrollWidth<=el.clientWidth)
  assert.ok(short,'a short name is shown whole')
  const truncated=await rows[0].locator('.oc-applicant-person > span:last-child').evaluate(el=>getComputedStyle(el).textOverflow)
  assert.equal(truncated,'ellipsis','a cut name ends in an ellipsis')
 }finally{await browser?.close();fs.rmSync(tmp,{recursive:true,force:true})}
})

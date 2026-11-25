const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process')
const {chromium}=require('playwright')
// Settings › Interests showed 6 of the 11 "What are you into?" chips at 1512px; the rest sat past the row's edge
// behind a thin scrollbar. Real compiled CSS; the markup SegmentedControl renders for the survey's chip rows.
const labels=[...fs.readFileSync('lib/interest-survey.ts','utf8').match(/INTEREST_CHIPS[\s\S]*?\n\]/)[0].matchAll(/label: "([^"]+)"/g)].map(m=>m[1])
test('interest survey: every interest chip is in view at desktop and phone widths',{timeout:90000},async()=>{
 const form=fs.readFileSync('components/interests/interest-survey-form.tsx','utf8')
 const wrap=(form.match(/<FilterChips<InterestId>[^>]*className="([^"]+)"/)||[])[1]||''
 assert.ok(labels.length>=10,'reads the interest list')
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-interest-chips-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true})
 const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')
 const chips=labels.map(label=>`<button type="button" data-segment="" data-value="${label}">${label}</button>`).join('')
 const html=width=>`<!doctype html><html><head><style>${css}</style></head><body><main style="width:${width}px;padding:0"><section><div role="group" aria-label="What are you into?" class="oc-segmented-control oc-chip-row ${wrap}" data-slot="segmented-control" data-size="compact" data-multiple="true">${chips}</div></section></main></body></html>`
 let browser
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage()
  for(const [viewport,row] of [[1512,937],[390,358]]){
   await page.setViewportSize({width:viewport,height:900});await page.setContent(html(row))
   const group=await page.getByRole('group',{name:'What are you into?'}).boundingBox()
   for(const label of labels){
    const b=await page.getByRole('button',{name:label,exact:true}).boundingBox()
    assert.ok(b.x>=group.x-0.5&&b.x+b.width<=group.x+group.width+0.5,`${viewport}px: "${label}" is inside the row (${Math.round(b.x)}-${Math.round(b.x+b.width)} vs ${Math.round(group.x)}-${Math.round(group.x+group.width)})`)
    assert.ok(b.height>=36,`${viewport}px: "${label}" keeps its 36px chip height`)
   }
  }
 }finally{await browser?.close();fs.rmSync(tmp,{recursive:true,force:true})}
})

// Real built app, synthetic local accounts/data. The output records actual visited states.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const {chromium} = require('playwright'), AxeBuilder = require('@axe-core/playwright').default
const {readConfig,totp,Actor} = require('../tests/helpers/onboarding-e2e.cjs')
const root = path.join(os.tmpdir(),'outclass-dashboards-e2e'), c = readConfig(path.join(root,'config.json')), f = JSON.parse(fs.readFileSync(path.join(root,'visual-fixture.json')))
const phase = process.env.OUTCLASS_VISUAL_PHASE || 'after', out = path.resolve('test-results/platform-visual-unification',phase)
fs.mkdirSync(out,{recursive:true})
const club = section => `/club/${f.clubId}/workspace?section=${section}`, personal = view => `/?workspace=student&view=${view}`
const screens = [
 ['home','student',personal('student-dashboard')],['explore','student',personal('explore')],['saved','student','/saved-clubs'],['club-profile','student',`/club/${f.clubId}`],['applications','student',personal('tracker')],['status','student',personal('status')],['calendar-agenda','member',personal('calendar')],['calendar-month','member',personal('calendar'),'Month'],['calendar-week','member',personal('calendar'),'Week'],['calendar-day','member',personal('calendar'),'Day'],['notifications','student',personal('inbox')],['profile','student',personal('student-profile')],['personal-clubs','member',personal('my-clubs')],['personal-meetings','member',personal('my-clubs')+'&section=meetings'],['personal-tasks','member',personal('my-clubs')+'&section=tasks'],['corkboard','student','/corkboard'],['events-list','student','/corkboard','List View'],['club-overview','owner',club('overview')],['member-overview','member',club('overview')],['recruiting','owner',club('recruitment')+'&tool=overview'],['applicants','owner',club('recruitment')+'&tool=applicants'],['reviews','owner',club('recruitment')+'&tool=reviews'],['resumes','owner',club('recruitment')+'&tool=resumes'],['decisions','owner',club('recruitment')+'&tool=decisions'],['rejected','owner',club('recruitment')+'&tool=rejected'],['decision-schedules','owner',club('recruitment')+'&tool=scheduled-decisions'],['rounds','owner',club('recruitment')+'&tool=rounds'],['rules','owner',club('recruitment')+'&tool=rules'],['interviews','owner',club('recruitment')+'&tool=interviews'],['tasks','owner',club('tasks')],['meetings','owner',club('meetings')],['members','owner',club('members')],['announcements','owner',club('announcements')],['empty-club','owner',`/club/${f.emptyClubId}/workspace?section=overview`],['empty-recruiting','owner',`/club/${f.emptyClubId}/workspace?section=recruitment&tool=overview`],['permission-denied','student',club('members')],
 ...['general','application','cycles','pipeline','interviews','members','notifications','advanced'].map(id=>['club-settings-'+id,'owner',club('settings')+'&setting='+id]),
 ...['profile','account','availability','notifications','organizations','interviews'].map(id=>['settings-'+id,'owner','/settings/'+id]),
 ['meeting-detail','member','/meetings/'+f.meetingId],['interview-booking','student','/interviews/book'],
 ...['','users','clubs','applications','reports','support','permissions','onboarding','events','claims','school-requests','corkboard','activity','settings','audit'].map(id=>['admin-'+(id||'overview'),'admin','/platform'+(id?'/'+id:'')]),
 ...[['landing','/'],['about','/about'],['uva','/uva'],['request-school','/request-school'],['login','/login'],['signup','/signup'],['forgot-password','/forgot-password'],['reset-password','/reset-password'],['not-found','/visual-fixture-missing']].map(([name,route])=>[name,'public',route]),
 ...([['notifications-dense','member',personal('inbox')],['reviews-authorized','reviewer',club('recruitment')+'&tool=reviews'],['resumes-authorized','reviewer',club('recruitment')+'&tool=resumes'],['rooms-assigned','reviewer',club('recruitment')+'&tool=interviews'],['focused-interview','reviewer',club('recruitment')+`&tool=interviews&interview=1&applicationId=${f.focusedApplicationId}&roundId=${f.roundId}&bookingId=${f.bookingId}`],['voting-join','reviewer',`/voting/${f.votingSessionId}/join`],['voting-preview-join','public','/vote'],['student-claim','public','/auth/student-claim'],['club-access','owner',`/club-access/${f.clubId}`],['club-claim','owner',`/club-claims/${f.clubId}`],['invitation-invalid','student','/invitations/00000000-0000-4000-8000-000000000001'],['decision-unavailable','student',`/applications/${f.applicationId}/decision`],['check-in-invalid','member','/check-in'],['design-system','public','/design-system'],['preview','student','/preview'],['settings-entry','owner','/settings'],['interviews-entry','reviewer','/interviews'],['decisions-entry','student','/decisions']]),
 ['empty-home','empty',personal('student-dashboard')],['empty-status','empty',personal('status')],['empty-inbox','empty',personal('inbox')]
]
const representative = new Set(['home','explore','applications','calendar-month','notifications','club-overview','recruiting','applicants','tasks','interviews','corkboard','admin-users','club-settings-application','login'])
const sizes = [[1440,900],[390,844],...(process.env.OUTCLASS_VISUAL_MATRIX==='1'?[[1280,800],[1024,768],[768,1024],[320,844],[720,450]]:[])]
const only = process.env.OUTCLASS_VISUAL_ONLY?.split(','); const results = fs.existsSync(path.join(out,'results.json')) ? JSON.parse(fs.readFileSync(path.join(out,'results.json'))) : []; let browser
async function run() {
 browser = await chromium.launch({headless:true});const contexts={}
 for(const role of ['student','owner','member','empty','public','admin','reviewer']) {
   const context = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'})
   if(f.actors[role]) await context.addCookies(f.actors[role].cookies)
   if(role==='admin') {
     const actor=new Actor(c);await actor.signIn(c.admin.email,c.admin.password);await context.addCookies([...actor.cookies].map(([name,value])=>({name,value,url:c.appUrl})))
     const page = await context.newPage(); await page.goto(c.appUrl+'/platform/login'); await page.getByLabel('Password',{exact:true}).fill(c.admin.password); await page.getByRole('button',{name:'Continue securely'}).click(); await page.getByLabel('Authenticator code').fill(totp(c.admin.totpSecret)); await page.getByRole('button',{name:'Verify and enter'}).click(); await page.waitForURL('**/platform'); await page.close()
   }
   contexts[role]=context
 }
 for(const [width,height] of sizes) for(const [name,role,route,tab] of screens) {
   if(only&&!only.includes(name)||width!==1440&&width!==390&&!representative.has(name))continue
   const page = await contexts[role].newPage(), errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);await page.setViewportSize({width,height});if(width===720){const session=await contexts[role].newCDPSession(page);await session.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false})}
   const record={name,role,width,height,zoomEquivalent:width===720?200:100,route,phase,errors}
   try {
     if(name==='admin-overview'){await page.goto(c.appUrl+'/platform/login');await page.getByLabel('Password',{exact:true}).fill(c.admin.password);await page.getByRole('button',{name:'Continue securely'}).click();await page.getByLabel('Authenticator code').fill(totp(c.admin.totpSecret));await page.getByRole('button',{name:'Verify and enter'}).click();await page.waitForURL('**/platform')}
     const response=await page.goto(c.appUrl+route,{waitUntil:'networkidle',timeout:30000});record.httpStatus=response?.status();if(name==='preview'&&record.httpStatus===404){record.expectedGuard=true;record.guard='Presenter route requires an authorized Demo session';const previous=results.findIndex(r=>r.name===name&&r.width===width);if(previous>=0)results.splice(previous,1);results.push(record);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(`GUARDED ${name} ${width}`);await page.close();continue} await page.locator('body').waitFor(); await page.evaluate(()=>document.fonts.ready)
     await page.locator('.oc-dashboard-loading').waitFor({state:'hidden'})
     if(tab) await page.getByRole('button',{name:tab,exact:true}).click()
     await page.waitForTimeout(150)
     record.geometry=await page.evaluate(()=>({viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent).slice(0,12),alerts:[...document.querySelectorAll('[role="alert"]')].map(x=>x.textContent)}))
     record.overflow=record.geometry.pageWidth>width+1
     if(name==='admin-claims'&&record.geometry.headings.some(h=>h.includes('administrator sign-in')))record.failure='Admin fixture elevation expired before claim review'
     if(process.env.OUTCLASS_VISUAL_AXE==='1'&&width===390&&representative.has(name)) record.axe=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))
     record.screenshot=`${name}-${width}.png`;await page.screenshot({path:path.join(out,record.screenshot),fullPage:true,timeout:30000});await page.screenshot({path:path.join(out,`${name}-${width}-viewport.png`),timeout:30000});record.rendered=true
     console.log(`${record.overflow?'OVERFLOW':'CAPTURE'} ${name} ${width}${errors.length?' ERRORS '+errors.length:''}`)
   } catch(error) {record.failure=error.message;console.log(`FAILED ${name} ${width}: ${error.message.slice(0,160)}`)}
   const previous=results.findIndex(r=>r.name===name&&r.width===width);if(previous>=0)results.splice(previous,1);results.push(record); fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await page.close()
 }
 await browser.close();console.log(`Recorded ${results.length} screen/viewport states in ${out}`)
 const failures=results.filter(r=>r.failure||r.errors.length||r.overflow||r.axe?.length)
 if(failures.length){console.log(`${failures.length} states need review; see results.json`);if(phase!=='before')process.exitCode=1}
}
run().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1})

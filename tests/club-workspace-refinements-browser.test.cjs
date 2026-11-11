const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process')
const { chromium } = require('playwright')
const { bundle } = require('./helpers/browser-bundle.cjs')
const {planMemberGroups}=require('./helpers/communications-loader.cjs').loader({})('lib/member-groups.ts')

async function fixture() {
  const member = (id, firstName, year, role, groups = []) => ({ id, userId: id, clubId: 'club', status: 'ACTIVE', accessRole: role, isOwner: role === 'OWNER', permissions: role === 'OWNER' ? ['members.manage','leaders.manage','applications.review','applicants.identify','decisions.manage','meetings.manage','tasks.manage'] : [], interviewOffices: [], updatedAt: '2026-10-21T12:00:00Z', joinedAt: '2026-10-10T12:00:00Z', role: 'GENERAL_MEMBER', groups, cohort: null, user: { id, email: `${id}@example.invalid`, disabledAt: null, studentProfile: { firstName, lastName: 'Example', academicYear: year, major: 'Economics' } } })
  const owner = { ...member('owner', 'Owner', 'Fourth Year', 'OWNER'), club: { name: 'Sample Club' } }
  const app = (id, firstName, gpa, sat, score) => ({ id, studentId: id, roundId: 'round', recruitmentCycleId: 'cycle', status: 'IN_REVIEW', canEvaluate: false, publicationGuard: 'fixture', student: { email: `${id}@example.invalid`, studentProfile: { firstName, lastName: 'Example', academicYear: 'Second Year', major: 'Economics', gpa, satScore: sat, actScore: 33, resumeUrl: `12345678-1234-4123-8123-123456789abc/12345678-1234-4123-8123-123456789abc.pdf`, experiences: [] } }, evaluations: [], answers: [], bookings: [], roundScore: { average: score, submitted: 2, required: 2, provisional: false } })
  const initial = () => ({ pipeline: { rounds: [{ id: 'round', name: 'Interview round', order: 0, type: 'INTERVIEW', anonymousReview: false }], applications: [app('alpha', 'Alpha', 3.7, 1450, 8), app('beta', 'Beta', 3.9, 1550, 9)], // A club that shows GPA and LinkedIn (hidden by default).
    profileFields: { name: true, photo: true, email: true, major: true, academicYear: true, gpa: true, sat: true, act: true, experiences: true, resume: true, linkedin: true } }, directory: { actor: owner, members: [member('junior', 'Zoe', 'Third Year', 'MEMBER', ['Girls']), member('senior', 'Adam', 'Fourth Year', 'MEMBER', ['Boys']), member('freshman', 'Maya', 'First Year', 'MEMBER')], invitations: [], identifierTypes: [] }, writes: [], staged: [] })
  let state = initial()
  const api = `async function call(path,input){const response=await fetch('/api/'+path,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:undefined);if(!response.ok)throw Error('Fixture save rejected');return response.json()}exports.getClubPipeline=()=>call('pipeline');exports.getClubPipelineList=()=>call('pipeline');exports.getClubPipelinePage=async(club,q={})=>{const data=await call('pipeline');return {...require('@/lib/pipeline-page').pagePipeline(data,q,'owner','owner','fixture'),profileFields:data.profileFields}};exports.getClubPipelineSelection=async(club,q={})=>require('@/lib/pipeline-page').completePipelineSelection(await call('pipeline'),q,'owner','owner');exports.setApplicationStatus=input=>call('status',input);exports.listStagedDecisions=()=>call('staged');exports.stageDecision=input=>call('stage',input);exports.clearStagedDecision=input=>call('unstage',input);exports.submitEvaluation=input=>call('status',input);exports.getOrganizationMemberManagement=()=>call('directory');exports.assignOrganizationMemberGroups=input=>call('groups',input);exports.createOrganizationMemberGroups=input=>call('create-groups',input);exports.getApplicantDisplay=()=>call('display');exports.getInterviewFeedback=async()=>({status:'unavailable'});exports.saveApplicantObservation=input=>call('observation',input);exports.deleteApplicantObservation=input=>call('delete-observation',input);exports.listMeetings=async()=>[];exports.submitEvaluation=async()=>({});exports.moveApplicantRound=async()=>({});exports.getRecipientGroups=()=>call('catalog');exports.previewRecipientAudience=()=>call('preview');exports.publishClubAnnouncement=input=>call('announcement',input);exports.getOrganizationSetupChecklist=()=>call('checklist');exports.getClubWorkspaceOverview=()=>call('overview');`
  const empty = 'module.exports=new Proxy({},{get:()=>()=>null});'
  const mocks = {
    // Short-link writes are outside this directory/profile fixture.
    '@/actions/short-links': 'exports.createShortLink=async()=>null;',
    '@/lib/additional-observations-api': `exports.getAdditionalObservations=async()=>[];exports.saveAdditionalObservation=async()=>{throw Error('Observation writes are outside this directory/profile fixture')};`,
    'next/link': `const React=require('react');module.exports=({href,children,...props})=>React.createElement('a',{...props,href},children);`,
    'next/navigation': `exports.useSearchParams=()=>new URLSearchParams(location.search);exports.useRouter=()=>({push(){},refresh(){}});`,
    '@/contexts/auth-context': `const member=${JSON.stringify(owner)};exports.useAuth=()=>window.__refinementAuth??=({readAuthority:{},isReadAuthorityCurrent:()=>true,user:{id:'owner',memberships:[member]},activeClubId:'club',selectClub(){},refreshUser:async()=>{}});`,
    '@/contexts/demo-context': 'exports.useDemoMode=()=>({isDemoEnabled:false,ready:true});',
    '@/lib/application-state': 'exports.useApplicationState=()=>({leaderFocus:null,clearLeaderFocus(){}});',
    '@/hooks/use-editor-draft': 'exports.useEditorDraft=()=>({ready:true,dirty:false,recovery:null,flush:async()=>{},clear:async()=>{},onBlur(){}});',
    '@/components/ui/autosave-status': empty,
    '@/lib/workspace-api': api, '@/lib/workspace-read': api,
    '@/actions/organization-members': api, '@/actions/recipient-groups': api, '@/actions/communications': api, '@/actions/organization-onboarding': api,
    '@/actions/club-access': empty, '@/actions/invitation-emails': empty, '@/actions/recusals': empty,
  }
  for (const name of ['recruitment-cycles','decision-schedules','recruitment-attendance-summary','reveal-applicant','demo-workspace','availability/interviewer-eligibility','invitation-schedules','invitation-email-controls','club-access-editor','roster-csv-importer']) mocks['@/components/'+name] = empty
  const overview = { operations:{offers:[],team:null,asOf:new Date(),intake:null,cycles:[],rounds:[],queue:[],meetings:[],announcements:[],tasks:{assigned:0,completed:0,overdue:0,awaitingReview:0},reviewWork:[],bookings:[],votes:[],scheduled:[],teamTasks:[]}, club: { id: 'club', name: 'Sample Club' }, membership: owner, meeting: null, work: [], awaitingReview: 0, recruitment: [{ status: 'IN_REVIEW', count: 2 }] }
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{LiveLeaderWorkspace}from'@/components/views/leader-dashboard/live-leader-workspace';import{OrganizationMemberManagement}from'@/components/organization-member-management';import{OrganizationSetupChecklist}from'@/components/organization-setup-checklist';import{ManagerOverview}from'@/components/manager-overview';import{AudienceEditor}from'@/components/recipient-audiences';import{MeetingGroupInvitation}from'@/components/meeting-group-invitation';
  const catalog={groups:[],rosterLabels:['Boys','Girls'],gradYears:[2027,2030],cohorts:[],cycles:[],rounds:[],events:[]};
  function App(){const[value,setValue]=useState({include:[{source:'MEMBERS',gradYears:[],accessRoles:[],cohorts:[],labels:[]}],exclude:[]});const tab=new URLSearchParams(location.search).get('tab');return <div data-product-shell className="p-6"><main id="workspace-content">{tab==='members'?<OrganizationMemberManagement clubId="club"/>:tab==='overview'?<><ManagerOverview data={${JSON.stringify(overview)}} showRecaps={false}/></>:tab==='audiences'?<><AudienceEditor catalog={catalog} value={value} onChange={setValue}/><output aria-label="Selected audience">{JSON.stringify(value)}</output><MeetingGroupInvitation meeting={{id:'meeting',clubId:'club',title:'Group meeting',date:'2026-10-25T12:00:00Z',location:'Room 1'}}/></>:<LiveLeaderWorkspace scoped/>}</main></div>};createRoot(document.getElementById('root')).render(<App/>);`
  const js = bundle(entry, mocks); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-workspace-ui-'))
  cp.execFileSync(process.execPath, [path.join(__dirname, 'helpers/interview-browser-css.cjs'), path.join(tmp, 'style.css')])
  const css = fs.readFileSync(path.join(tmp, 'style.css'), 'utf8') + ['components/product/operational-dashboard.css','components/applicant-review/applicant-review.css','components/club-home/club-home.css','styles/navigation-glass.css','components/product/dashboard/dashboard.css','components/shell/authenticated-product.css','components/shell/responsive-workspace.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n') + '@font-face{font-family:SourceSans;src:url(/source-sans.woff2);font-weight:200 900}@font-face{font-family:Caslon;src:url(/caslon.woff2);font-weight:400 700}:root{--font-source-sans-3:SourceSans;--font-libre-caslon-text:Caslon}body{font-family:SourceSans,sans-serif}'
  const server = http.createServer(async (req, res) => {
    try {
      if(req.url==='/source-sans.woff2'||req.url==='/caslon.woff2'){res.setHeader('content-type','font/woff2');res.end(fs.readFileSync(req.url==='/source-sans.woff2'?'app/fonts/source-sans-3/source-sans-3-upright.woff2':'app/fonts/libre-caslon-text/libre-caslon-text-variable.woff2'));return}
      if (req.url.startsWith('/api/recruiting-resumes?')) { res.setHeader('content-type','application/pdf');res.end(fs.readFileSync('public/demo/sample-resume.pdf'));return }
      if (req.url.startsWith('/api/')) {
        let raw = ''; for await (const chunk of req) raw += chunk
        const input = raw ? JSON.parse(raw) : null, route = req.url.slice(5)
        let result
        if (route === 'pipeline') result = state.pipeline
        else if (route === 'directory') result = state.directory
        else if (route === 'staged') result = state.staged
        else if (route === 'stage') { const target = state.pipeline.applications.find(app=>app.id===input.applicationId); if(target.status!==input.expectedStatus)throw Error('stale'); const t=input.outcome==='REJECT'?'REJECTED':input.outcome==='HOLD'?'IN_REVIEW':'ACCEPTED'; const row={id:'staged-'+target.id,applicationId:target.id,outcome:input.outcome,targetStatus:t,targetRoundId:null,expectedStatus:target.status,expectedRoundId:target.roundId,stagedBy:'You',stagedByMe:true,createdAt:new Date().toISOString(),applicant:target.student.studentProfile.firstName+' Example',roundName:'Interview round',targetRoundName:null}; state.staged=state.staged.filter(r=>r.applicationId!==target.id).concat(row); result=row }
        else if (route === 'unstage') { state.staged=state.staged.filter(r=>r.applicationId!==input.applicationId); result={cleared:1} }
        else if (route === 'status') { const target = state.pipeline.applications.find(app=>app.id===input.applicationId); if(target.status!==input.expectedStatus)throw Error('stale');target.status=input.status;state.writes.push(input);result={success:true} }
        else if (route === 'groups') { for(const target of input.targets){const member=state.directory.members.find(m=>m.id===target.id);member.groups=[...new Set([...member.groups,input.group])]}state.writes.push(input);result={updated:input.targets.length} }
        else if(route==='create-groups'){const plan=planMemberGroups(input.targets.map(t=>t.id),input.name,input.split);for(const target of input.targets){const member=state.directory.members.find(m=>m.id===target.id);member.groups=[...new Set([...member.groups,input.name,plan.find(g=>g.memberIds.includes(target.id)).name])]}state.writes.push(input);result={groups:plan,members:input.targets.length}}
        else if(route==='display')result={configured:['pros','cons','score','feedback'],visible:['pros','cons','score'],withheld:['feedback'],anonymous:false,links:[],observations:[{id:'observation',kind:'PRO',body:'Clear, specific evidence.',author:'Club reviewer',own:true}],sections:[{field:'pros',label:'Pros',items:['Clear, specific evidence.']},{field:'cons',label:'Cons',items:[]},{field:'score',label:'Evaluation score',items:[]},{field:'feedback',label:'Overall feedback',items:[],withheld:true}]}
        else if(route==='observation'){state.writes.push(input);result={success:true}}
        else if (route === 'catalog') result={groups:[],rosterLabels:['Boys','Girls'],gradYears:[2027,2030],cohorts:[],cycles:[],rounds:[],events:[]}
        else if (route === 'preview') result={count:1,recipients:[{id:'senior',email:'senior@example.invalid'}],evaluatedAt:new Date().toISOString()}
        else if (route === 'announcement') { state.writes.push(input);result={id:'sent'} }
        else if (route === 'checklist') result={organizationName:'Sample Club',steps:[{id:'roster',title:'Add members',detail:'Invite the club',complete:false,href:'/?tab=members'}]}
        else result={}
        res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return
      }
      res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html')
      res.end(req.url==='/fixture.js'?js:req.url==='/style.css'?css:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script>')
    } catch { res.statusCode=409;res.end('{}') }
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  return { server, base:`http://127.0.0.1:${server.address().port}`, state:()=>state, reset(){state=initial()} }
}

test('browser: sortable lists, the applicant review, board drag/drop, staged decisions, groups and overview', {timeout:120000}, async t=>{
  const f=await fixture();t.after(()=>f.server.close())
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close())
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.setDefaultTimeout(10000);
  await page.goto(f.base)
  await page.getByRole('button',{name:'Sort by SAT',exact:true}).click()
  assert.match(await page.locator('tbody tr').first().innerText(),/Beta Example/)
  assert.equal(await page.getByRole('columnheader',{name:/^Sort by SAT,/}).getAttribute('aria-sort'),'descending')
  assert.equal(await page.getByRole('columnheader',{name:/^Sort by Applicant$/}).getAttribute('aria-sort'),'none')
  for(const label of ['Applicant','Year','Round','GPA','SAT','ACT','Rating','Status'])assert.equal(await page.getByRole('button',{name:new RegExp(`^Sort by ${label.replace('/','\\/')}`)}).count(),1,`${label} header sorts`)
  assert.equal(await page.getByRole('button',{name:'Refresh',exact:true}).count(),0)
  assert.equal(await page.getByRole('combobox',{name:'Sort applicants by'}).isVisible(),true,'the toolbar Sort is visible at every width');assert.match(await page.getByRole('combobox',{name:'Sort applicants by'}).innerText(),/SAT/,'headers and the toolbar share one sort');assert.match(page.url(),/sort=sat&order=desc/,'the sort lives in the URL')
  const narrow=await browser.newPage({viewport:{width:390,height:844}});await narrow.goto(f.base);await narrow.getByRole('button',{name:'Review applicants',exact:true}).waitFor();assert.ok(await narrow.getByRole('combobox',{name:'Sort applicants by'}).isVisible(),'Sort stays visible on phones')
  assert.ok(await narrow.evaluate(()=>document.documentElement.scrollWidth<=390),'applicants page does not overflow at 390px');await narrow.close()
  const resumeResponse=page.waitForResponse(response=>response.url().includes('/api/recruiting-resumes?')&&response.status()===200)
  await page.locator('tbody tr').first().locator('td').nth(2).click()
  await page.getByRole('dialog').waitFor()
  assert.ok((await page.getByRole('dialog').boundingBox()).width>=1440*.9,'the review uses the full screen')
  await page.getByRole('button',{name:'Résumé preview',exact:true}).click()
  await page.getByTitle('Résumé for Beta Example').waitFor()
  await page.getByRole('button',{name:'Pros/cons',exact:true}).click()
  await page.getByRole('heading',{name:'Pros & cons',exact:true}).waitFor()
  const prosCons=page.getByRole('region',{name:'review applicant information'})
  assert.ok((await prosCons.boundingBox()).height<350)
  assert.equal(await prosCons.locator('textarea').count(),0)
  await page.getByRole('button',{name:'Additional observations',exact:true}).click()
  const observations=page.getByRole('region',{name:'Additional observations',exact:true}).last()
  await observations.getByRole('button',{name:'Add observation',exact:true}).click()
  await observations.getByRole('textbox',{name:'Observation',exact:true}).waitFor()
  await observations.getByText('0 / 50 words',{exact:true}).waitFor()
  await observations.getByRole('button',{name:'Cancel',exact:true}).click()
  await page.waitForFunction(()=>document.activeElement?.textContent==='Add observation')
  // Status is one StatusPill: a tinted icon and plain text, with no capsule fill and no left bar.
  const status=page.locator('[data-slot="status-pill"]').first()
  const pill=await status.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderInlineStartWidth,icon:!!element.querySelector('svg[data-icon-pack="phosphor"]'),code:element.dataset.status}))
  assert.equal(pill.background,'rgba(0, 0, 0, 0)');assert.equal(pill.border,'0px');assert.ok(pill.icon);assert.ok(pill.code)
  await resumeResponse
  await page.getByRole('dialog').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))))
  assert.ok((await page.getByRole('dialog').boundingBox()).x<1440*.1)
  await page.screenshot({path:'/tmp/outclass-applicant-profile-desktop.png',animations:'disabled'})
  await page.getByRole('button',{name:'Close review',exact:true}).click()
  // Board: dragging stages the decision (nothing is published) and the card moves at once.
  await page.getByRole('button',{name:'Kanban',exact:true}).click()
  const card=await page.getByRole('button',{name:/^Alpha Example\./}).boundingBox(),target=await page.getByRole('listitem',{name:/^Rejected, /}).boundingBox()
  await page.mouse.move(card.x+40,card.y+card.height/2);await page.mouse.down();await page.mouse.move(card.x+60,card.y+card.height/2,{steps:4});await page.mouse.move(target.x+target.width/2,target.y+80,{steps:12});await page.mouse.up()
  await page.getByRole('listitem',{name:/^Rejected, 1/}).getByText('Alpha Example').waitFor()
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'))
  assert.deepEqual(f.state().staged.map(row=>[row.applicationId,row.targetStatus]),[['alpha','REJECTED']])
  assert.equal(f.state().writes.length,0,'staging publishes nothing')
  // Review applicants: one applicant at a time; A advances, R rejects, each saved for Decide › Send.
  await page.getByRole('button',{name:'Review applicants',exact:true}).click()
  const decide=page.getByRole('group',{name:'Decide'})
  await decide.waitFor()
  await decide.evaluate(el=>{const r=el.getBoundingClientRect();if(r.bottom>innerHeight+1||r.top<0)throw Error('decisions off screen')})
  await page.screenshot({path:'/tmp/outclass-review-flow.png',animations:'disabled'})
  // The list is sorted by SAT (descending), and the review follows the same order: Beta, then Alpha.
  await page.getByRole('heading',{name:'Beta Example',exact:true}).waitFor()
  assert.equal(await page.locator('#review-flow-progress').textContent(),'1 of 2')
  await page.locator('#review-applicant-name').press('a')
  await page.getByRole('heading',{name:'Alpha Example',exact:true}).waitFor()
  await page.locator('#review-applicant-name').press('r')
  await page.getByText('You’ve reached the end of this set',{exact:true}).waitFor()
  assert.deepEqual(f.state().staged.map(row=>[row.applicationId,row.targetStatus]).sort(),[['alpha','REJECTED'],['beta','ACCEPTED']])
  assert.equal(f.state().writes.length,0)
  await page.getByRole('button',{name:'Close review',exact:true}).first().click()
  f.reset();await page.goto(f.base+'/?tab=members')
  await page.getByRole('button',{name:'Sort by Year',exact:true}).click()
  assert.match(await page.locator('tbody tr').first().innerText(),/Adam Example/)
  assert.equal(await page.getByRole('region',{name:'Assign member groups'}).count(),0)
  await page.getByRole('button',{name:'More ways to add members',exact:true}).click();await page.getByRole('menuitem',{name:'Create groups',exact:true}).click()
  let creator=page.getByRole('dialog')
  await creator.getByLabel('Group name',{exact:true}).fill('Welcome')
  await creator.getByRole('button',{name:'Next',exact:true}).click()
  await creator.getByRole('button',{name:'By year',exact:true}).click()
  await creator.getByRole('checkbox',{name:'First Year',exact:true}).check()
  await creator.getByRole('button',{name:'Next',exact:true}).click()
  assert.equal(await creator.getByLabel('People per group',{exact:true}).count(),0)
  await creator.getByRole('button',{name:'Create group',exact:true}).click()
  await creator.waitFor({state:'hidden'})
  assert.deepEqual(f.state().writes.at(-1).targets.map(target=>target.id),['freshman'])
  assert.ok(f.state().directory.members.find(member=>member.id==='freshman').groups.includes('Welcome'))
  await page.getByRole('button',{name:'More ways to add members',exact:true}).click();await page.getByRole('menuitem',{name:'Create groups',exact:true}).click()
  creator=page.getByRole('dialog')
  await creator.getByLabel('Group name',{exact:true}).fill('Teams')
  await creator.getByRole('button',{name:'Next',exact:true}).click()
  await creator.getByRole('button',{name:'All members',exact:true}).click()
  await creator.getByRole('button',{name:'Next',exact:true}).click()
  await creator.getByRole('checkbox',{name:'Divide into random groups'}).check()
  await creator.getByLabel('Divide by',{exact:true}).selectOption('COUNT')
  await creator.getByLabel('Number of groups',{exact:true}).fill('2')
  await page.screenshot({path:'/tmp/outclass-group-builder-desktop.png',animations:'disabled'})
  await creator.getByRole('button',{name:'Create 2 groups',exact:true}).click()
  await creator.waitFor({state:'hidden'})
  assert.ok(f.state().directory.members.every(member=>member.groups.includes('Teams')&&member.groups.some(g=>g.startsWith('Teams / '))))
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('button',{name:'More ways to add members',exact:true}).click();await page.getByRole('menuitem',{name:'Create groups',exact:true}).click()
  creator=page.getByRole('dialog')
  await creator.getByLabel('Group name',{exact:true}).fill('Mobile team')
  await creator.getByRole('button',{name:'Next',exact:true}).click()
  await creator.getByRole('button',{name:'By year',exact:true}).click()
  await creator.getByRole('checkbox',{name:'First Year',exact:true}).check()
  assert.equal(await creator.evaluate(element=>element.scrollWidth<=element.clientWidth+1),true)
  await page.screenshot({path:'/tmp/outclass-group-builder-mobile.png',animations:'disabled'})
  page.once('dialog',dialog=>dialog.accept())
  await creator.getByRole('button',{name:'Close',exact:true}).click()
  await creator.waitFor({state:'hidden'})
  await page.setViewportSize({width:1440,height:1000})
  await page.goto(f.base+'/?tab=audiences')
  await page.getByRole('combobox',{name:'Send to',exact:true}).click();await page.getByRole('option',{name:'By year',exact:true}).click()
  assert.match(await page.getByLabel('Selected audience').innerText(),/PEOPLE/)
  await page.getByRole('button',{name:'Fourth Year · 2027',exact:true}).click()
  assert.match(await page.getByLabel('Selected audience').innerText(),/2027/)
  await page.getByRole('combobox',{name:'Send to',exact:true}).click();await page.getByRole('option',{name:'Boys',exact:true}).click()
  assert.match(await page.getByLabel('Selected audience').innerText(),/Boys/)
  await page.getByRole('button',{name:'Invite people',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('combobox',{name:'Send to',exact:true}).click();await page.getByRole('option',{name:'Girls',exact:true}).click()
  await dialog.getByRole('button',{name:'Preview recipients',exact:true}).click()
  await dialog.getByRole('button',{name:'Send meeting announcement · 1',exact:true}).click()
  await dialog.waitFor({state:'hidden'})
  assert.deepEqual(f.state().writes.at(-1).audienceSpec.include[0].labels,['Girls'])
  await page.goto(f.base+'/?tab=overview')
  await page.getByRole('button',{name:'Dismiss setup introduction',exact:true}).waitFor()
  await page.getByRole('heading',{name:'Needs you',exact:true}).waitFor()
  await page.getByRole('heading',{name:'This week',exact:true}).waitFor()
  assert.deepEqual(await page.locator('.oc-club-home-card h2').allTextContents(),['Next meeting','Team tasks','Announcements','This week'])
  assert.equal(await page.getByText('You’re clear for now.',{exact:true}).count(),1)
  assert.equal(await page.getByText('Nothing due this week.',{exact:true}).count(),1)
  await page.screenshot({path:'/tmp/outclass-workspace-overview-desktop.png',fullPage:true})
  await page.getByRole('button',{name:'Dismiss setup introduction',exact:true}).click()
  await page.reload();await page.getByRole('heading',{name:'Needs you',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Dismiss setup introduction',exact:true}).count(),0)
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:'/tmp/outclass-workspace-overview-mobile.png',fullPage:true})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  assert.deepEqual(errors,[])
})

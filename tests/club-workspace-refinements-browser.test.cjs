const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process')
const { chromium } = require('playwright')
const { bundle } = require('./helpers/browser-bundle.cjs')

async function fixture() {
  const member = (id, firstName, year, role, groups = []) => ({ id, userId: id, clubId: 'club', status: 'ACTIVE', accessRole: role, isOwner: role === 'OWNER', permissions: role === 'OWNER' ? ['members.manage','leaders.manage','applications.review','applicants.identify','decisions.manage','meetings.manage','tasks.manage'] : [], interviewOffices: [], updatedAt: '2026-10-21T12:00:00Z', role: 'GENERAL_MEMBER', groups, cohort: null, user: { id, email: `${id}@example.invalid`, disabledAt: null, studentProfile: { firstName, lastName: 'Example', academicYear: year, major: 'Economics' } } })
  const owner = { ...member('owner', 'Owner', 'Fourth Year', 'OWNER'), club: { name: 'Sample Club' } }
  const app = (id, firstName, gpa, sat, score) => ({ id, studentId: id, roundId: 'round', recruitmentCycleId: null, status: 'IN_REVIEW', canEvaluate: false, publicationGuard: 'fixture', student: { email: `${id}@example.invalid`, studentProfile: { firstName, lastName: 'Example', academicYear: 'Second Year', major: 'Economics', gpa, satScore: sat, actScore: 33, resumeUrl: `12345678-1234-4123-8123-123456789abc/12345678-1234-4123-8123-123456789abc.pdf`, experiences: [] } }, evaluations: [], answers: [], bookings: [], roundScore: { average: score, submitted: 2, required: 2, provisional: false } })
  const initial = () => ({ pipeline: { rounds: [{ id: 'round', name: 'Interview round', order: 0, type: 'INTERVIEW', anonymousReview: false }], applications: [app('alpha', 'Alpha', 3.7, 1450, 8), app('beta', 'Beta', 3.9, 1550, 9)] }, directory: { actor: owner, members: [member('junior', 'Zoe', 'Third Year', 'MEMBER', ['Girls']), member('senior', 'Adam', 'Fourth Year', 'MEMBER', ['Boys']), member('freshman', 'Maya', 'First Year', 'MEMBER')], invitations: [], identifierTypes: [] }, writes: [] })
  let state = initial()
  const api = `async function call(path,input){const response=await fetch('/api/'+path,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:undefined);if(!response.ok)throw Error('Fixture save rejected');return response.json()}exports.getClubPipeline=()=>call('pipeline');exports.setApplicationStatus=input=>call('status',input);exports.getOrganizationMemberManagement=()=>call('directory');exports.assignOrganizationMemberGroups=input=>call('groups',input);exports.listMeetings=async()=>[];exports.submitEvaluation=async()=>({});exports.moveApplicantRound=async()=>({});exports.getRecipientGroups=()=>call('catalog');exports.previewRecipientAudience=()=>call('preview');exports.publishClubAnnouncement=input=>call('announcement',input);exports.getOrganizationSetupChecklist=()=>call('checklist');`
  const empty = 'module.exports=new Proxy({},{get:()=>()=>null});'
  const mocks = {
    'next/link': `const React=require('react');module.exports=({href,children,...props})=>React.createElement('a',{...props,href},children);`,
    'next/navigation': `exports.useSearchParams=()=>new URLSearchParams(location.search);exports.useRouter=()=>({push(){},refresh(){}});`,
    '@/contexts/auth-context': `const member=${JSON.stringify(owner)};exports.useAuth=()=>({user:{id:'owner',memberships:[member]},activeClubId:'club',selectClub(){},refreshUser:async()=>{}});`,
    '@/contexts/demo-context': 'exports.useDemoMode=()=>({isDemoEnabled:false,ready:true});',
    '@/lib/application-state': 'exports.useApplicationState=()=>({leaderFocus:null,clearLeaderFocus(){}});',
    '@/hooks/use-editor-draft': 'exports.useEditorDraft=()=>({ready:true,dirty:false,recovery:null,flush:async()=>{},clear:async()=>{},onBlur(){}});',
    '@/components/ui/autosave-status': empty,
    '@/lib/workspace-api': api, '@/lib/workspace-read': api,
    '@/actions/organization-members': api, '@/actions/recipient-groups': api, '@/actions/communications': api, '@/actions/organization-onboarding': api,
    '@/actions/club-access': empty, '@/actions/invitation-emails': empty,
  }
  for (const name of ['recruitment-cycles','decision-schedules','applicant-intelligence','recruitment-attendance-summary','reveal-applicant','live-voting/board-decision-mode','demo-workspace','availability/interviewer-eligibility','invitation-schedules','invitation-email-controls','club-access-editor','roster-csv-importer']) mocks['@/components/'+name] = empty
  const overview = { club: { id: 'club', name: 'Sample Club' }, membership: owner, meeting: null, work: [], awaitingReview: 0, recruitment: [{ status: 'IN_REVIEW', count: 2 }] }
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{LiveLeaderWorkspace}from'@/components/views/leader-dashboard/live-leader-workspace';import{OrganizationMemberManagement}from'@/components/organization-member-management';import{OrganizationSetupChecklist}from'@/components/organization-setup-checklist';import{ManagerOverview}from'@/components/manager-overview';import{AudienceEditor}from'@/components/recipient-audiences';import{MeetingGroupInvitation}from'@/components/meeting-group-invitation';
  const catalog={groups:[],rosterLabels:['Boys','Girls'],gradYears:[2027,2030],cohorts:[],cycles:[],rounds:[],events:[]};
  function App(){const[value,setValue]=useState({include:[{source:'MEMBERS',gradYears:[],accessRoles:[],cohorts:[],labels:[]}],exclude:[]});const tab=new URLSearchParams(location.search).get('tab');return <div data-product-shell className="p-6"><main id="workspace-content">{tab==='members'?<OrganizationMemberManagement clubId="club"/>:tab==='overview'?<><ManagerOverview data={${JSON.stringify(overview)}} showRecaps={false}/><OrganizationSetupChecklist clubId="club" compact/></>:tab==='audiences'?<><AudienceEditor catalog={catalog} value={value} onChange={setValue}/><output aria-label="Selected audience">{JSON.stringify(value)}</output><MeetingGroupInvitation meeting={{id:'meeting',clubId:'club',title:'Group meeting',date:'2026-10-25T12:00:00Z',location:'Room 1'}}/></>:<LiveLeaderWorkspace scoped/>}</main></div>};createRoot(document.getElementById('root')).render(<App/>);`
  const js = bundle(entry, mocks); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-workspace-ui-'))
  cp.execFileSync(process.execPath, [path.join(__dirname, 'helpers/interview-browser-css.cjs'), path.join(tmp, 'style.css')])
  const css = fs.readFileSync(path.join(tmp, 'style.css'), 'utf8') + ['components/clubs/manager-overview.css','components/shell/authenticated-product.css','components/shell/responsive-workspace.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n') + ':root{--oc-font-sans:Arial,sans-serif;--oc-font-display:Georgia,serif}body{font-family:Arial,sans-serif}'
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/recruiting-resumes?')) { res.setHeader('content-type','application/pdf');res.end(fs.readFileSync('public/demo/sample-resume.pdf'));return }
      if (req.url.startsWith('/api/')) {
        let raw = ''; for await (const chunk of req) raw += chunk
        const input = raw ? JSON.parse(raw) : null, route = req.url.slice(5)
        let result
        if (route === 'pipeline') result = state.pipeline
        else if (route === 'directory') result = state.directory
        else if (route === 'status') { const target = state.pipeline.applications.find(app=>app.id===input.applicationId); if(target.status!==input.expectedStatus)throw Error('stale');target.status=input.status;state.writes.push(input);result={success:true} }
        else if (route === 'groups') { for(const target of input.targets){const member=state.directory.members.find(m=>m.id===target.id);member.groups=[...new Set([...member.groups,input.group])]}state.writes.push(input);result={updated:input.targets.length} }
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

test('browser: sortable lists, wide applicant profile, drag/drop, quick decisions, groups and overview', {timeout:120000}, async t=>{
  const f=await fixture();t.after(()=>f.server.close())
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close())
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.setDefaultTimeout(10000);
  await page.goto(f.base)
  await page.getByRole('button',{name:'Sort by SAT',exact:true}).click()
  assert.match(await page.locator('tbody tr').first().innerText(),/Beta Example/)
  const resumeResponse=page.waitForResponse(response=>response.url().includes('/api/recruiting-resumes?')&&response.status()===200)
  await page.locator('tbody tr').first().locator('td').nth(2).click()
  await page.getByRole('dialog').waitFor()
  assert.ok((await page.getByRole('dialog').boundingBox()).width>=1440*.9)
  await page.getByTitle('Résumé for Beta Example').waitFor()
  await resumeResponse
  await page.getByRole('dialog').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))))
  assert.ok((await page.getByRole('dialog').boundingBox()).x<1440*.1)
  await page.screenshot({path:'/tmp/outclass-applicant-profile-desktop.png',animations:'disabled'})
  await page.getByRole('button',{name:'Close',exact:true}).click()
  await page.getByRole('button',{name:'Kanban',exact:true}).click()
  await page.getByRole('button',{name:/Alpha Example.*Review & actions/}).dragTo(page.getByRole('region',{name:'Interview applicants',exact:true}))
  await page.getByRole('button',{name:'Confirm move',exact:true}).click()
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'))
  assert.equal(f.state().writes.at(-1).status,'INTERVIEWING')
  await page.getByRole('button',{name:'Quick review',exact:true}).click()
  await page.getByRole('button',{name:'Accept & next',exact:true}).click()
  await page.getByRole('heading',{name:'Alpha Example',exact:true}).waitFor()
  await page.getByRole('button',{name:'Deny & next',exact:true}).click()
  await page.getByText('Quick review complete.',{exact:true}).waitFor()
  assert.equal(f.state().writes.filter(write=>write.status==='ACCEPTED'||write.status==='REJECTED').length,2)
  f.reset();await page.goto(f.base+'/?tab=members')
  await page.getByRole('button',{name:'Sort by Year',exact:true}).click()
  assert.match(await page.locator('tbody tr').first().innerText(),/Adam Example/)
  await page.getByRole('combobox',{name:'Filter members by year'}).selectOption('First Year')
  await page.getByRole('button',{name:'Select matching members',exact:true}).click()
  await page.getByRole('button',{name:'Boys',exact:true}).click()
  await page.getByRole('button',{name:'Add to group · 1',exact:true}).click()
  await page.getByText('Added 1 members to Boys.',{exact:true}).waitFor()
  assert.deepEqual(f.state().writes.at(-1).targets.map(target=>target.id),['freshman'])
  assert.ok(f.state().directory.members.find(member=>member.id==='freshman').groups.includes('Boys'))
  await page.goto(f.base+'/?tab=audiences')
  await page.getByRole('button',{name:'By year',exact:true}).click()
  assert.match(await page.getByLabel('Selected audience').innerText(),/PEOPLE/)
  await page.getByRole('button',{name:'Fourth Year · 2027',exact:true}).click()
  assert.match(await page.getByLabel('Selected audience').innerText(),/2027/)
  await page.getByRole('button',{name:'Boys',exact:true}).click()
  assert.match(await page.getByLabel('Selected audience').innerText(),/Boys/)
  await page.getByRole('button',{name:'Invite people',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('button',{name:'Girls',exact:true}).click()
  await dialog.getByRole('button',{name:'Preview recipients',exact:true}).click()
  await dialog.getByRole('button',{name:'Send meeting announcement · 1',exact:true}).click()
  await dialog.waitFor({state:'hidden'})
  assert.deepEqual(f.state().writes.at(-1).audienceSpec.include[0].labels,['Girls'])
  await page.goto(f.base+'/?tab=overview')
  await page.getByRole('button',{name:'Dismiss setup introduction',exact:true}).waitFor()
  const panels=page.locator('.oc-manager-overview-grid > .oc-overview-panel')
  assert.equal(await panels.count(),4)
  const boxes=await panels.evaluateAll(nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,top:node.getBoundingClientRect().top})))
  assert.equal(boxes[0].height,boxes[1].height);assert.equal(boxes[2].height,boxes[3].height)
  await page.screenshot({path:'/tmp/outclass-workspace-overview-desktop.png',fullPage:true})
  await page.getByRole('button',{name:'Dismiss setup introduction',exact:true}).click()
  await page.reload();await page.getByRole('heading',{name:'Club updates',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Dismiss setup introduction',exact:true}).count(),0)
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:'/tmp/outclass-workspace-overview-mobile.png',fullPage:true})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  assert.deepEqual(errors,[])
})

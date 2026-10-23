const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
function load(file,mocks={}){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:n.endsWith('.css')?{}:n.startsWith('@/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports}
const club='00000000-0000-4000-8000-000000000001',round='00000000-0000-4000-8000-000000000002'
test('round-filtered dashboard review reads deny members and recheck authorization before returning',async()=>{
 let caps=[],calls=0,changed=false
 const api=load('actions/club-overview.ts',{'@/utils/prisma':{},'@/utils/auth':{requireClubMembership:async()=>({membership:{id:'member',permissions:changed&&calls>0?[]:caps}})},'@/utils/dashboard-summary':{dashboardSummary:async()=>({}),dashboardReviewQueue:async(id,scope,roundId)=>{assert.equal(id,club);assert.equal(roundId,round);calls++;return [{id:'candidate'}]}}})
 await assert.rejects(api.getDashboardReviewQueue(club,round),/Review access/);assert.equal(calls,0)
 caps=['applications.review'];assert.deepEqual(await api.getDashboardReviewQueue(club,round),[{id:'candidate'}])
 calls=0;changed=true;await assert.rejects(api.getDashboardReviewQueue(club,round),/access changed/)
 await assert.rejects(api.getDashboardReviewQueue(club,'invalid'))
})
test('summary scopes meetings, updates and task aggregates and does not query applicant data for members',async()=>{
 const seen={};let raw=0
 const model=name=>({findMany:async query=>{seen[name]=query;return[]},count:async query=>{(seen.counts??=[]).push(query);return 0}})
 const prisma={meeting:model('meeting'),clubAnnouncement:model('announcement'),taskAssignment:model('task'),$queryRaw:async()=>{raw++;return[]}}
 const {dashboardSummary}=load('utils/dashboard-summary.ts',{'@/utils/prisma':{prisma}})
 const result=await dashboardSummary(club,{id:'member',userId:'user',permissions:[]})
 assert.equal(raw,0);assert.deepEqual(result.rounds,[]);assert.equal(result.tasks.awaitingReview,null)
 assert.equal(seen.meeting.where.clubId,club);assert.equal(seen.meeting.take,4)
 assert.deepEqual(seen.announcement.where.notifications,{some:{userId:'user'}});assert.equal(seen.announcement.take,3)
 assert.ok(seen.counts.every(q=>q.where.memberId==='member'&&q.where.task.clubId===club))
})
test('design preview fixtures satisfy both real dashboard component contracts at runtime',()=>{
 const mockComponent=new Proxy({},{get:(_,key)=>key}),mocks={react:{useState:v=>[v,()=>{}],useEffect(){}},'next/dynamic':{__esModule:true,default:()=> 'Lazy'},'next/link':{__esModule:true,default:'a'},'@/components/ui/button':{Button:'button'},'@/components/icons':{ArrowRight:'svg'},'@/components/member-overview':{memberDate:v=>new Date(v).toISOString()},'@/components/product/dashboard-drawer':{DashboardDrawer:'Drawer'},'@/components/product/dashboard-presentation':{DashboardDate:'Date',DashboardLoading:'Loading'}}
 const source=fs.readFileSync('components/product/design-patterns.tsx','utf8')+'\nexport { overview, managerOverview };'
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n==='react'?mocks.react:n==='@/lib/demo/assets'?{demoMonogram:()=>''}:n==='@/lib/club-marketing'?{profileDraft:()=>({})}:n.startsWith('@/components/')?mockComponent:n.endsWith('.css')?{}:n==='@/lib/data'?{}:require(n),mod,mod.exports)
 const recruiting=load('components/recruiting-overview.tsx',{...mocks,'@/lib/workspace-api':{}}).RecruitingOverview
 const manager=load('components/manager-overview.tsx',mocks).ManagerOverview
 const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
 const reviewLinks = permissions => nodes(recruiting({data:{...mod.exports.overview,membership:{isOwner:false,status:'ACTIVE',permissions},operations:{...mod.exports.overview.operations,votes:[]}}})).filter(n=>n.type==='a').map(n=>n.props.href)
 for (const permissions of [[],['applications.review'],['decisions.vote'],['decisions.manage']]) {
  assert.ok(!reviewLinks(permissions).some(h=>h.includes('voting=1')||h.includes('#recruitment-review')),'partial access must not expose review mode shortcuts')
 }
 assert.ok(reviewLinks(['applications.review','decisions.vote']).some(h=>h.endsWith('&voting=1')),'voting remains discoverable before any session exists')
 assert.ok(reviewLinks(['decisions.manage','applicants.identify']).some(h=>h.endsWith('#recruitment-review')),'decision makers can discover quick review')

 for(const [component,data] of [[recruiting,mod.exports.overview],[manager,mod.exports.managerOverview]]){assert.ok(data.operations);assert.ok(Array.isArray(data.operations.bookings));assert.ok(Array.isArray(data.operations.votes));const tree=component({data});assert.ok(nodes(tree).some(n=>n.type==='h2'));assert.ok(nodes(tree).some(n=>n.type==='button'),'real inline entry points render')}
})

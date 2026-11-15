const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
// Cached per mock set, like real modules, so import cycles (student-routes ↔ student-navigation) resolve.
const loaded=new WeakMap();function load(file,mocks={}){if(!fs.existsSync(file)&&file.endsWith('.ts'))file+='x';const cache=loaded.get(mocks)??new Map();loaded.set(mocks,cache);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:n.endsWith('.css')?{}:n.startsWith('@/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports}
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
 assert.equal(seen.meeting.where.clubId,club);assert.equal(seen.meeting.take,8);assert.ok(+seen.meeting.where.date.lte-+seen.meeting.where.date.gte>13*86400000,'Club home lists two weeks of meetings')
 assert.deepEqual(seen.announcement.where.notifications,{some:{userId:'user'}});assert.equal(seen.announcement.take,3)
 assert.ok(seen.counts.every(q=>q.where.memberId==='member'&&q.where.task.clubId===club))
})
test('design preview fixtures satisfy both real dashboard component contracts at runtime',()=>{
 const mockComponent=new Proxy({},{get:(_,key)=>key}),mocks={'@/lib/club-colors':require('./helpers/component-module.cjs').loadComponent('lib/club-colors.ts'),react:{useState:v=>[v,()=>{}],useEffect(){}},'next/dynamic':{__esModule:true,default:()=> 'Lazy'},'next/link':{__esModule:true,default:'a'},'@/components/ui/button':{Button:'button'},'@/components/ui/page-header':{PageHeader:'Header'},'@/components/icons':{ArrowRight:'svg'},'@/components/member-overview':{memberDate:v=>new Date(v).toISOString()},'@/components/product/dashboard-drawer':{DashboardDrawer:'Drawer'},'@/components/product/dashboard-presentation':{DashboardDate:'Date',DashboardLoading:'Loading'},'@/components/ui/loading-state':{LoadingState:'LoadingState'},'@/components/organization-setup-checklist':{OrganizationSetupChecklist:'Checklist'}}
 const source=fs.readFileSync('components/product/design-patterns.tsx','utf8')+'\nexport { overview, managerOverview };'
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n==='react'?mocks.react:n==='@/lib/club-colors'?mocks['@/lib/club-colors']:n==='@/lib/demo/assets'?{demoMonogram:()=>''}:n==='@/lib/club-marketing'?{profileDraft:()=>({})}:n.startsWith('@/components/')?mockComponent:n.endsWith('.css')?{}:n==='@/lib/data'?{}:require(n),mod,mod.exports)
 const recruiting=load('components/recruiting-overview.tsx',{...mocks,'@/lib/workspace-api':{}}).RecruitingOverview
 const manager=load('components/manager-overview.tsx',{...mocks,'@/lib/workspace-api':{},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})}}).ManagerOverview
 const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
 for(const [component,data] of [[recruiting,mod.exports.overview],[manager,mod.exports.managerOverview]]){assert.ok(data.operations);assert.ok(Array.isArray(data.operations.bookings));assert.ok(Array.isArray(data.operations.votes));const tree=component({data});const all=nodes(tree).flatMap(n=>[n,...nodes(n.props?.main),...nodes(n.props?.side),...(n.props?.items||[]).flatMap(item=>nodes(item.action)),...nodes(n.props?.more),...nodes(n.props?.action)]);assert.ok(all.some(n=>n.type==='h2'||n.props?.headingId||typeof n.props?.title==='string'&&n.props?.id),'sections have headings');assert.ok(all.some(n=>n.type==='button'||typeof n.props?.onClick==='function'),'real inline entry points render')}
})
test('Recruiting Overview CTAs into the same club workspace switch views client-side and are never prefetched',()=>{
 const mocks={'@/lib/club-colors':require('./helpers/component-module.cjs').loadComponent('lib/club-colors.ts'),react:{useState:v=>[typeof v==='function'?v():v,()=>{}],useEffect(){},useRef:current=>({current}),useMemo:fn=>fn(),useCallback:fn=>fn},'next/dynamic':{__esModule:true,default:()=> 'Lazy'},'next/link':{__esModule:true,default:'a'},'@/components/ui/button':{Button:'button'},'@/components/ui/page-header':{PageHeader:'Header'},'@/components/icons':new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}),'@/components/member-overview':{memberDate:v=>new Date(v).toISOString()},'@/components/product/dashboard-drawer':{DashboardDrawer:'Drawer'},'@/components/product/dashboard-presentation':{DashboardDate:'Date',DashboardLoading:'Loading'},'@/lib/workspace-api':{}}
 const source=fs.readFileSync('components/product/design-patterns.tsx','utf8')+'\nexport { overview };'
 const fixture={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n==='react'?mocks.react:n==='@/lib/club-colors'?mocks['@/lib/club-colors']:n==='@/lib/demo/assets'?{demoMonogram:()=>''}:n==='@/lib/club-marketing'?{profileDraft:()=>({})}:n.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):n.endsWith('.css')?{}:n==='@/lib/data'?{}:require(n),fixture,fixture.exports)
 const data=fixture.exports.overview,{RecruitingOverview,RecruitingHero}=load('components/recruiting-overview.tsx',mocks)
 // Render every function component (cards, needs actions, more links) down to host elements.
 const hosts=[],walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object'||!('props' in n))return;if(typeof n.type==='function')return walk(n.type(n.props));hosts.push(n);for(const value of Object.values(n.props))walk(value)}
 walk(RecruitingOverview({data}));walk(RecruitingHero({clubId:data.club.id,clubName:data.club.name,membership:data.membership,data}))
 const workspace=`/club/${data.club.id}/workspace`,text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
 const links=hosts.filter(n=>n.type==='a'&&typeof n.props.href==='string'&&n.props.href.split('?')[0]===workspace)
 const names=links.map(n=>text(n.props.children).trim())
 for(const name of ['All applicants','Open applicants'])assert.ok(names.includes(name),`${name} renders as a same-workspace link (${names})`)
 assert.ok(links.length>=3,'review, applicants and setup CTAs are covered')
 const saved={window:globalThis.window,document:globalThis.document},pushed=[]
 globalThis.document={querySelector:()=>null};globalThis.window={location:{href:`https://outclass.test${workspace}?section=recruitment&tool=overview`},history:{pushState:(_,__,href)=>pushed.push(href),replaceState(){throw Error('CTA must add a history entry')}},confirm:()=>true}
 try{for(const link of links){
  assert.equal(link.props.prefetch,false,`${text(link.props.children)}: no RSC prefetch for a view the workspace renders client-side`)
  assert.equal(typeof link.props.onClick,'function',`${text(link.props.children)}: switches through the workspace navigation helper`)
  let prevented=0;const before=pushed.length
  link.props.onClick({button:0,defaultPrevented:false,preventDefault:()=>prevented++})
  assert.equal(prevented,1,`${text(link.props.children)}: Next's server navigation is cancelled`);assert.equal(pushed.length,before+1);assert.equal(new URL(pushed.at(-1)).href,new URL(link.props.href,'https://outclass.test').href,'URL stays in sync (Back/Forward restore the view)')
  // Modified clicks (new tab/window) keep the browser's default link behavior.
  let modified=0;link.props.onClick({button:0,metaKey:true,defaultPrevented:false,preventDefault:()=>modified++});assert.equal(modified,0)
 }}finally{Object.assign(globalThis,saved)}
})
test('Club home links into the same club workspace switch views client-side and are never prefetched',()=>{
 const mocks={'@/lib/club-colors':require('./helpers/component-module.cjs').loadComponent('lib/club-colors.ts'),react:{useState:v=>[typeof v==='function'?v():v,()=>{}],useEffect(){},useRef:current=>({current}),useMemo:fn=>fn(),useCallback:fn=>fn},'next/dynamic':{__esModule:true,default:()=> 'Lazy'},'next/link':{__esModule:true,default:'a'},'@/components/ui/button':{Button:'button'},'@/components/ui/page-header':{PageHeader:'Header'},'@/components/icons':new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}),'@/components/member-overview':{memberDate:v=>new Date(v).toISOString()},'@/components/product/dashboard-drawer':{DashboardDrawer:'Drawer'},'@/components/product/dashboard-presentation':{DashboardDate:'Date',DashboardLoading:'Loading'},'@/components/ui/loading-state':{LoadingState:'LoadingState'},'@/components/organization-setup-checklist':{OrganizationSetupChecklist:'Checklist'},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/lib/workspace-api':{}}
 const source=fs.readFileSync('components/product/design-patterns.tsx','utf8')+'\nexport { managerOverview };'
 const fixture={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n==='react'?mocks.react:n==='@/lib/club-colors'?mocks['@/lib/club-colors']:n==='@/lib/demo/assets'?{demoMonogram:()=>''}:n==='@/lib/club-marketing'?{profileDraft:()=>({})}:n.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):n.endsWith('.css')?{}:n==='@/lib/data'?{}:require(n),fixture,fixture.exports)
 const base=fixture.exports.managerOverview
 // Pending invitations and a completed vote add a same-workspace and a voting-room "Needs you" link.
 const done=base.operations.votes[0]&&{...base.operations.votes[0],state:'COMPLETE'}
 const data={...base,members:{active:12,recent:2,...base.members,pendingInvitations:2},operations:{...base.operations,votes:done?[done]:base.operations.votes}}
 const {ManagerOverview}=load('components/manager-overview.tsx',mocks),sections=load('components/club-home/club-home-sections.tsx',mocks),{ClubHomeActions}=load('components/club-home/club-home-actions.tsx',mocks),{railHrefs}=load('components/club-home/club-home-model.ts',mocks)
 const hrefs=railHrefs(data.membership,data.club.id)
 assert.ok(hrefs.recruiting&&hrefs.meetings&&hrefs.tasks&&hrefs.members&&hrefs.announcements,'fixture membership reaches every club home destination')
 const hosts=[],walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object'||!('props' in n))return;if(typeof n.type==='function')return walk(n.type(n.props));hosts.push(n);for(const value of Object.values(n.props))walk(value)}
 walk(ManagerOverview({data}));walk(ClubHomeActions({clubId:data.club.id,membership:data.membership}))
 // The strip loads after mount; render it directly, plus the empty Next meeting state (New meeting).
 walk(sections.RecruitingStripLink({clubId:data.club.id,strip:{open:true,applicants:3,attention:1,href:hrefs.recruiting}}))
 walk(sections.NextMeetingCard({data:{...data,operations:{...data.operations,meetings:[]}},hrefs,index:1,onOpen(){}}))
 const workspace=`/club/${data.club.id}/workspace`,text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
 const anchors=hosts.filter(n=>n.type==='a'&&typeof n.props.href==='string'),links=anchors.filter(n=>n.props.href.split('?')[0]===workspace)
 const names=links.map(n=>(n.props['aria-label']||text(n.props.children)).trim())
 for(const name of ['Open members','New announcement','All announcements','New meeting','All meetings','Meetings','Manage tasks','Members','All work'])assert.ok(names.includes(name),`${name} renders as a same-workspace link (${names})`)
 assert.ok(names.some(n=>/Recruiting overview/.test(n)),'recruiting strip is covered');assert.ok(names.some(n=>/open tasks$/.test(n)),'task count tiles are covered')
 assert.ok(links.some(n=>n.props.className==='oc-needs-action'),'a Needs you link is covered')
 // Destinations outside the workspace (voting rooms, public pages) keep Next's default prefetch.
 for(const link of anchors.filter(n=>!links.includes(n)))assert.notEqual(link.props.prefetch,false,`${link.props.href} leaves the workspace and keeps Next navigation`)
 for(const href of [`/club/${data.club.id}/voting/session`,`/clubs/${data.club.id}`,`/club/other/workspace?section=overview`])assert.equal(sections.clubLinkProps(data.club.id,href).prefetch,undefined,`${href} keeps Next prefetch`)
 const saved={window:globalThis.window,document:globalThis.document},pushed=[]
 globalThis.document={querySelector:()=>null};globalThis.window={location:{href:`https://outclass.test${workspace}?section=overview`},history:{pushState:(_,__,href)=>pushed.push(href),replaceState(){throw Error('CTA must add a history entry')}},confirm:()=>true}
 try{for(const link of links){
  const name=(link.props['aria-label']||text(link.props.children)).trim()
  assert.equal(link.props.prefetch,false,`${name}: no RSC prefetch for a view the workspace renders client-side`)
  let prevented=0;const before=pushed.length
  link.props.onClick({button:0,defaultPrevented:false,preventDefault:()=>prevented++})
  assert.equal(prevented,1,`${name}: Next's server navigation is cancelled`);assert.equal(pushed.length,before+1);assert.equal(new URL(pushed.at(-1)).href,new URL(link.props.href,'https://outclass.test').href,'URL stays in sync (Back/Forward restore the view)')
  // Cmd/Ctrl-click and middle-click keep the browser's default link behavior.
  for(const modifier of [{metaKey:true},{ctrlKey:true},{button:1}]){let modified=0;link.props.onClick({button:0,defaultPrevented:false,preventDefault:()=>modified++,...modifier});assert.equal(modified,0,`${name}: ${JSON.stringify(modifier)} opens normally`)}
 }}finally{Object.assign(globalThis,saved)}
})
test('Decisions delivered: accepted of sent offers in words, a bar that only echoes it, a calm line before any offer is sent',()=>{
 const {overview}=require('./fixtures/club-home/data.cjs'),{offerTally,offerTallySummary}=load('lib/offer-tally.ts')
 // Sent counts pending, accepted, declined and expired current offers; revoked offers and applications without one do not count.
 assert.deepEqual(offerTally([{offer:'ACCEPTED',count:2},{offer:'PENDING',count:1},{offer:'DECLINED',count:1},{offer:'EXPIRED',count:1},{offer:'REVOKED',count:4},{offer:null,count:30}]),{sent:5,accepted:2,awaiting:1,declined:1,expired:1})
 assert.equal(offerTallySummary({sent:20,accepted:12,awaiting:5,declined:2,expired:1}),'12 of 20 offers accepted')
 assert.equal(offerTallySummary({sent:1,accepted:0,awaiting:1,declined:0,expired:0}),'0 of 1 offer accepted')
 assert.equal(offerTallySummary({sent:0,accepted:0,awaiting:0,declined:0,expired:0}),null);assert.equal(offerTallySummary(null),null)
 const mocks={'@/lib/club-colors':require('./helpers/component-module.cjs').loadComponent('lib/club-colors.ts'),react:{useState:v=>[typeof v==='function'?v():v,()=>{}],useEffect(){},useRef:current=>({current}),useMemo:fn=>fn(),useCallback:fn=>fn},'next/dynamic':{__esModule:true,default:()=> 'Lazy'},'next/link':{__esModule:true,default:'a'},'@/components/ui/button':{Button:'button'},'@/components/ui/page-header':{PageHeader:'Header'},'@/components/icons':new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}),'@/components/member-overview':{memberDate:v=>new Date(v).toISOString()},'@/components/product/dashboard-drawer':{DashboardDrawer:'Drawer'},'@/components/product/dashboard-presentation':{DashboardDate:'Date',DashboardLoading:'Loading'},'@/lib/workspace-api':{}}
 const {RecruitingOverview}=load('components/recruiting-overview.tsx',mocks)
 const club={id:'00000000-0000-4000-8000-000000000001',name:'Fixture Club'},owner={id:'member',isOwner:true,permissions:[],interviewOffices:[],status:'ACTIVE'}
 const render=data=>{const hosts=[],walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object'||!('props' in n))return;if(n.props.id==='dashboard-outcomes'&&typeof n.type==='function')hosts.card=n;if(typeof n.type==='function')return walk(n.type(n.props));hosts.push(n);for(const value of Object.values(n.props))walk(value)};walk(RecruitingOverview({data}));return hosts}
 const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
 const card=hosts=>hosts.card&&{props:{children:[hosts.card.props.title,hosts.card.props.children]}}
 let hosts=render(overview('large',club,owner)),section=card(hosts)
 assert.ok(section&&hosts.some(n=>n.props.id==='dashboard-outcomes'),'the anchor id stays dashboard-outcomes');assert.match(text(section),/Decisions delivered/);assert.doesNotMatch(text(section),/Outcomes/)
 assert.match(text(section),/7 of 12 offers accepted/);assert.match(text(section),/3 awaiting response · 1 declined · 1 expired/)
 const bar=hosts.find(n=>n.type==='progress'&&n.props.max===12);assert.equal(bar.props.value,7);assert.equal(bar.props['aria-label'],'7 of 12 offers accepted')
 // No offers yet: a calm line, never 0 of 0 and no empty bar.
 const none=overview('large',club,owner);none.offerTally={sent:0,accepted:0,awaiting:0,declined:0,expired:0};hosts=render(none);section=card(hosts)
 assert.match(text(section),/No offers sent yet\./);assert.doesNotMatch(text(section),/0 of 0/);assert.ok(!hosts.some(n=>n.type==='progress'&&n.props.max===0))
 // Viewers without recruitment counts (null from the reader) never get the card.
 const member={id:'member',isOwner:false,permissions:['interviews.manage'],interviewOffices:[],status:'ACTIVE'},plain=overview('large',club,member)
 assert.equal(plain.offerTally,null);assert.equal(card(render(plain)),undefined)
})

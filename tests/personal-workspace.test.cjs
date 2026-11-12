const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
// The phone sheet renders its links through WorkspaceNavigation's renderItem (stubbed here).
// The More sheet renders each destination directly (no grouped WorkspaceNavigation since the nav reorganization).
const sheetLinks=shell=>nodes(shell).filter(n=>typeof n.props?.['data-tour']==='string'&&n.props['data-tour'].startsWith('nav-')&&!n.props['data-dock-item']);
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function load(file,mocks={}) {
 mocks={ ...require('./helpers/shell-stubs.cjs'), '@/components/shell/use-workspace-access':{useWorkspaceAccess:()=>({clubs:[],personal:true,admin:false,pending:false})}, '@/lib/autosave-navigation':{flushEditors:async()=>{}}, '@/actions/communications':{}, ...mocks };
 // The shell reads its active item from the URL; tests that omit routing hooks render at '/'.
 if(mocks['next/navigation'])mocks['next/navigation']={usePathname:()=>'/',useSearchParams:()=>new URLSearchParams(),...mocks['next/navigation']};
 mocks={'@/components/shell/workspace-selector':{WorkspaceSelector:'WorkspaceSelector',useWorkspaceOptions:()=>[]},...mocks};
 const mod={exports:{}},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','window','document','setInterval','clearInterval',code)(name=>mocks[name]||(name.endsWith('.css')?{}:name==='@/components/ui/confirm-dialog'?require('./helpers/confirm-stub.cjs'):name.startsWith('@/components/')?new Proxy({},{get:(_,key)=>String(key)}):name.startsWith('@/')?load(path.resolve(name.slice(2)+'.ts'),mocks):require(name)),mod,mod.exports,mocks.window,{querySelector:()=>null},()=>1,()=>{});
 return mod.exports;
}
function hooks() {
 const slots=[],effects=[],cleanups=new Map();let cursor=0;
 const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,useSyncExternalStore:(_s,_g,server)=>server(),
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},
 useRef(initial){const i=cursor++;return slots[i]??={current:initial}},
 useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push([i,fn])}},
 useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={fn,deps};return slots[i].fn},
 useMemo(fn,deps){return react.useCallback(fn,deps)()},
 };
 return {react,render:C=>{cursor=0;return C()},async flush(){for(const[i,fn]of effects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn())}for(let i=0;i<15;i++)await Promise.resolve()}};
}
const round=(id,name,order)=>({id,name,order});
const rounds=[round('review','Screening',0),round('interview','Conversation',1),round('final','Final round',2)];
const booking=(id='booking',roundId='interview',hours=4)=>({id,roundId,slot:{startTime:new Date(Date.now()+hours*3600000),endTime:new Date(Date.now()+(hours+1)*3600000),location:'Room 204'}});
const app=(id,status='IN_REVIEW',extra={})=>({id,clubId:'club-'+id,status,submittedAt:status==='DRAFTING'?null:new Date(),club:{name:id,color:'#142d45',questions:[{id:'q',required:true,prompt:'Why us?',type:'ESSAY'}],pipelineRounds:rounds},round:rounds[status==='INTERVIEWING'?1:0],answers:[],bookings:[],...extra});
const model=load('lib/application-presentation.ts');

test('status uses actual club rounds without inventing interviews or marking later rounds as complete',()=>{
 const source=app('Review','IN_REVIEW',{club:{pipelineRounds:[round('essay','Essay review',0),round('decision','Decision',1)]},round:round('essay','Essay review',0)});
 const result=model.applicationStatusProgress(source);assert.deepEqual(result.stages.map(stage=>stage.name),['Submitted','Essay review','Decision']);assert.equal(result.current,'essay');
 source.status='ACCEPTED';assert.equal(model.applicationStatusProgress(source).current,'decision');assert.equal(source.round.name,'Essay review');
});
test('submitted applications use their recorded current round even if the status was not changed with a round move',()=>{
 const source=app('Moved','SUBMITTED',{round:rounds[2]});assert.equal(model.applicationStatusProgress(source).current,'final');
});
test('status excludes drafts, keeps each outcome distinct, and does not interpret round names as interview invitations',()=>{
 assert.equal(model.applicationMatchesStatusFilter(app('Draft','DRAFTING'),'All'),false);
 for(const status of ['ACCEPTED','WAITLISTED','REJECTED']){const source=app(status,status);assert.equal(model.applicationMatchesStatusFilter(source,'Decisions'),true);assert.equal(model.applicationMatchesStatusFilter(source,'In progress'),false);assert.equal(model.applicationNeedsAttention(source),false)}
 assert.equal(model.applicationNeedsAttention(app('Review','IN_REVIEW',{round:{id:'interview',name:'Interview'}})),false);
});
test('earlier-round bookings do not hide current-round interview actions, and ongoing bookings remain upcoming',()=>{
 const source=app('Invite','INTERVIEWING',{bookings:[booking('earlier','review')]});assert.equal(model.applicationNeedsAttention(source),true);
 source.bookings.push(booking('current','interview',-.25));assert.equal(model.applicationNeedsAttention(source),false);assert.equal(model.applicationMatchesStatusFilter(source,'Upcoming interviews'),true);
 source.bookings=[booking('past','interview',-3)];assert.equal(model.applicationNeedsAttention(source),false);assert.equal(model.applicationMatchesStatusFilter(source,'Upcoming interviews'),false);assert.equal(model.applicationMatchesStatusFilter(source,'In progress'),true);
});
test('status sorts attention before upcoming interviews and orders interview appointments chronologically',()=>{
 const source=[app('Decision','ACCEPTED'),app('Later','INTERVIEWING',{bookings:[booking('later','interview',8)]}),app('Review'),app('Soon','INTERVIEWING',{bookings:[booking('soon')]}),app('Action','INTERVIEWING')];
 assert.deepEqual([...source].sort((a,b)=>model.compareApplicationStatus(a,b)).map(item=>item.id),['Action','Soon','Later','Review','Decision']);assert.equal(source[0].id,'Decision');
});
function trackerHarness(records,scope='status',params='') {
 const h=hooks(),calls=[],navigation=[];const auth={user:{id:'student'},loading:false,refreshUser:async()=>{}};
 const shared={focusApplicationClubId:null,clearApplicationFocus(){shared.focusApplicationClubId=null},focusApplication:id=>calls.push(['focus',id]),syncApplications:items=>calls.push(['applications',items]),syncApplicationBookings:items=>calls.push(['bookings',items])};
 let server=records,fail=false,query=params;const revalidation={};
 const C=load('components/views/application-tracker-view.tsx',{react:h.react,'@/hooks/use-server-now':{useServerAnchoredNow:()=>Date.now()},'@/hooks/use-revalidate':{useRevalidate:(fn,options)=>Object.assign(revalidation,{fn,options})},'next/navigation':{useSearchParams:()=>new URLSearchParams(query)},'@/lib/workspace-api':{getStudentApplications:async()=>{calls.push(['read']);if(fail)throw Error('Unavailable');return structuredClone(server)}},'@/contexts/auth-context':{useAuth:()=>auth},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/lib/application-state':{useApplicationState:()=>shared},window:{confirm:()=>false}}).ApplicationTrackerView;
 return {...h,calls,auth,navigation,revalidation,render:()=>h.render(()=>C({scope,onNavigate:view=>navigation.push(view)})),setRecords:records=>server=records,fail:()=>fail=true,query:value=>query=value,shared};
}
const cards=tree=>nodes(tree).filter(node=>node.type==='ApplicationStatusCard');
const management=tree=>nodes(tree).filter(node=>node.type==='ApplicationManagementCard');

test('Applications and Status are one page: four stage tabs with counts, status cards for submitted stages',async()=>{
 const h=trackerHarness([app('Draft','DRAFTING'),app('Review'),app('Decision','ACCEPTED'),app('Interview','INTERVIEWING')]);h.render();await h.flush();let tree=h.render();
 assert.equal(nodes(tree).find(node=>node.type==='PageHeader').props.title,'Applications');assert.equal(nodes(tree).some(node=>node.type==='MetricStrip'),false,'no stat boxes repeating the tabs');
 const stages=()=>nodes(h.render()).find(node=>node.type==='UnderlineTabs'&&node.props.label==='Application stage');
 assert.deepEqual(stages().props.items.map(item=>`${item.label} (${item.count})`),['Drafts (1)','In review (1)','Interviews (1)','Decisions (1)']);
 assert.deepEqual(cards(tree).map(node=>node.props.application.id),['Review']);assert.equal(management(tree).length,0);
 stages().props.onChange('interviews');assert.deepEqual(cards(h.render()).map(node=>node.props.application.id),['Interview']);
 stages().props.onChange('decisions');assert.deepEqual(cards(h.render()).map(node=>node.props.application.id),['Decision']);
 stages().props.onChange('drafts');tree=h.render();assert.equal(cards(tree).length,0);assert.deepEqual(management(tree).map(node=>node.props.application.id),['Draft']);
});
test('Applications opens on Drafts when there are drafts and uses the same stages as the Home card',async()=>{
 const h=trackerHarness([app('Draft','DRAFTING'),app('Decision','ACCEPTED'),app('Review')],'all');h.render();await h.flush();let tree=h.render();assert.equal(cards(tree).length,0);assert.equal(management(tree).length,1);
 nodes(tree).find(node=>node.type==='UnderlineTabs').props.onChange('in-review');assert.equal(cards(h.render()).length,1);
 const {stageCounts}=load('lib/application-stages.ts');assert.deepEqual(stageCounts(['Drafting','Submitted','In Review','Interviewing','Accepted','Rejected','Waitlisted']),{drafts:1,'in-review':2,interviews:1,decisions:3});
 assert.match(require('node:fs').readFileSync('components/views/student-dashboard-view.tsx','utf8'),/stageCounts\(apps\.map/);
});
test('booking changes refresh the same application and synchronize calendar bookings without a page reload',async()=>{
 const h=trackerHarness([app('Invite','INTERVIEWING')]);h.render();await h.flush();cards(h.render())[0].props.onOpen();let detail=nodes(h.render()).find(node=>node.type==='ApplicationStatusDetail');
 h.setRecords([app('Invite','INTERVIEWING',{bookings:[booking()]})]);detail.props.onBookingChanged();await h.flush();detail=nodes(h.render()).find(node=>node.type==='ApplicationStatusDetail');assert.equal(detail.props.application.bookings.length,1);assert.equal(h.calls.filter(call=>call[0]==='read').length,2);
 assert.equal(h.calls.filter(call=>call[0]==='bookings').at(-1)[1][0].bookings.length,1);
 detail.props.onResponses();await h.flush();assert.deepEqual(h.navigation,['tracker']);assert.deepEqual(h.calls.find(call=>call[0]==='focus'),['focus','club-Invite']);
});
test('Applications has no Refresh button and revalidates quietly, keeping the open status on screen',async()=>{
 const h=trackerHarness([app('Invite','INTERVIEWING')]);h.render();await h.flush();let tree=h.render();
 assert.equal(nodes(tree).some(node=>/^Refresh/.test(text(node))&&node.type==='Button'),false);
 cards(tree)[0].props.onOpen();tree=h.render();assert.equal(nodes(tree).some(node=>node.type==='Button'&&/Refresh/.test(text(node))),false);
 assert.equal(h.revalidation.options.enabled,true);h.setRecords([app('Invite','INTERVIEWING',{bookings:[booking()]})]);const reads=h.calls.filter(call=>call[0]==='read').length;
 await h.revalidation.fn();tree=h.render();assert.equal(h.calls.filter(call=>call[0]==='read').length,reads+1);assert.equal(nodes(tree).some(node=>node.type==='LoadingState'),false);
 assert.equal(nodes(tree).find(node=>node.type==='ApplicationStatusDetail').props.application.bookings.length,1);
});
test('application deep links focus only an owned submitted application in Status',async()=>{
 const h=trackerHarness([app('Draft','DRAFTING'),app('Owned')],'status','applicationId=Owned');h.render();await h.flush();h.render();await h.flush();assert.equal(nodes(h.render()).find(node=>node.type==='ApplicationStatusDetail').props.application.id,'Owned');
 const denied=trackerHarness([app('Owned')],'status','applicationId=foreign');denied.render();await denied.flush();denied.render();await denied.flush();assert.equal(nodes(denied.render()).some(node=>node.type==='ApplicationStatusDetail'),false);
});
test('empty, loading, failed and signed-out status states preserve retry and sign-in behavior',async()=>{
 const h=trackerHarness([]);assert.match(nodes(h.render()).find(n=>n.type==='LoadingState').props.label,/Preparing your applications/);await h.flush();assert.ok(nodes(h.render()).some(node=>node.type==='EmptyState'));
 const failed=trackerHarness([]);failed.fail();failed.render();await failed.flush();assert.ok(nodes(failed.render()).some(node=>node.props?.role==='alert'));
 const guest=trackerHarness([]);guest.auth.user=null;guest.render();await guest.flush();assert.match(text(guest.render()),/Sign in/);assert.equal(guest.calls.length,0);
});
test('unsaved or busy application forms retain their existing navigation guard',async()=>{
 const h=trackerHarness([app('Draft','DRAFTING')],'all');h.render();await h.flush();management(h.render())[0].props.onOpen();let tree=h.render();const form=nodes(tree).find(node=>node.type==='ApplicationForm');form.props.onDirty(true);
 nodes(h.render()).find(node=>node.type==='ApplicationForm').props.onProfile();assert.equal(h.navigation.length,0);
});

test('old applicant URLs retain focus and unrelated parameters, while manager routes remain separate',()=>{
 const {canonicalStudentParams,resolveStudentView}=load('lib/student-navigation.ts');
 for(const query of ['view=interviews','view=decisions','view=tracker&section=interviews','view=tracker&section=decisions']){
  const input=new URLSearchParams(query+'&applicationClubId=fund&applicationId=app&roundId=round&extra=value');const route=canonicalStudentParams(input);assert.equal(route.view,'status');assert.equal(route.section,'status');for(const key of ['applicationClubId','applicationId','roundId','extra'])assert.equal(route.params.get(key),input.get(key));
 }
 assert.equal(resolveStudentView('interview-scheduler'),null);assert.equal(resolveStudentView('leader-dashboard'),null);
});
test('legacy applicant path redirects preserve repeated parameters and leave the booking route intact',async()=>{
 for(const file of ['app/interviews/page.tsx','app/decisions/page.tsx']){
  const C=load(file,{'next/navigation':{redirect:value=>{throw Error(value)}}}).default;
  await assert.rejects(C({searchParams:Promise.resolve({applicationId:'application',tag:['a','b']})}),error=>{const url=new URL(error.message,'http://outclass.test'),params=url.searchParams;assert.equal(url.pathname,'/applications');assert.equal(params.get('tab'),'in-review');assert.equal(params.get('view'),null);assert.equal(params.get('applicationId'),'application');assert.deepEqual(params.getAll('tag'),['a','b']);return true});
 }
 const bookingPage=load('app/(focus)/interviews/book/page.tsx').default();assert.equal(bookingPage.props.children.type,'AuthSessionBoundary');assert.equal(bookingPage.props.children.props.children.type,'BookingLinkPage');
});

test('personal shell keeps page headings in content once, with universal and contextual navigation',()=>{
 const h=hooks(),mocks={'@/lib/workspace-api':{getTaskNotifications:async()=>[]},react:h.react,'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({}),useSearchParams:()=>new URLSearchParams()},'@/contexts/auth-context':{useAuth:()=>({user:null})},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/contexts/organization-invitations-context':{useOrganizationInvitations:()=>({invitations:[]})},'@/lib/application-state':{useApplicationState:()=>({notifications:[],focusApplication(){}})}};
 const {DashboardLayout}=load('components/dashboard-layout.tsx',mocks),{ProductShell}=load('components/shell/product-shell.tsx',mocks);
 for(const [view,section,own] of [['student-dashboard','explore',true],['explore','explore',true],['explore','categories',true],['tracker','applications',true],['status','status',true],['my-clubs','clubs',false],['student-profile','explore',false],['inbox','explore',false],['calendar','calendar',false]]){
  const boundary=h.render(()=>DashboardLayout({view,personalSection:section,appMode:'student',children:own?{type:'h1',props:{children:'Page title'}}:null,onNavigate(){}}));
  assert.equal(boundary.type,'AuthSessionBoundary');
  const layout=h.render(()=>boundary.props.children.type(boundary.props.children.props));
  assert.equal(nodes(layout).filter(node=>node.type==='PageHeader').length,own?0:1,view);
  const shell=h.render(()=>ProductShell(layout.props));
  assert.equal(nodes(shell).some(node=>node.props?.className==='oc-header-context'),false,view);
  // Sections live in the rail and phone sheet only; the pill is a workspace switcher.
  assert.equal(nodes(shell).some(node=>node.props?.['aria-label']==='Product modes'),false,view);
  assert.deepEqual(nodes(shell).filter(node=>node.type==='nav').map(node=>node.props['aria-label']),['Home','Explore','Applications','Clubs','Account'],view);
  assert.equal(nodes(shell).some(node=>node.props?.['data-tour']==='nav-inbox'),false,'Notifications live in the header bell');
 }
 const manager=h.render(()=>ProductShell({mode:'recruiting',manager:true,clubName:'Club name',active:'overview',title:'Overview',sections:[],onSelect(){},onNavigate(){}}));
 assert.equal(nodes(manager).some(node=>node.props?.className==='oc-header-context'),false);assert.equal(nodes(manager).some(node=>node.props?.['aria-label']==='Home'),false);
});

test('signed-in account menu mounts the existing Demo entry; anonymous and support sessions cannot use it',()=>{
 const auth={user:{id:'presenter',email:'presenter@virginia.edu',memberships:[]},isImpersonating:false},h=hooks();
 const {ProductShell}=load('components/shell/product-shell.tsx',{'@/lib/workspace-api':{},react:h.react,'next/navigation':{useRouter:()=>({})},'@/contexts/auth-context':{useAuth:()=>auth},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/contexts/organization-invitations-context':{useOrganizationInvitations:()=>({invitations:[]})},'@/lib/application-state':{useApplicationState:()=>({notifications:[]})}});
 const entry=()=>nodes(h.render(()=>ProductShell({mode:'explore',active:'explore',title:'Explore',sections:[],onSelect(){},onNavigate(){}}))).filter(n=>n.type==='DemoMenuItems');
 assert.equal(entry().length,1);auth.isImpersonating=true;assert.equal(entry().length,0);auth.isImpersonating=false;auth.user=null;assert.equal(entry().length,0);
});

test('Demo menu respects allowed access and existing saving/unsaved guards when enabling or exiting',async()=>{
 let calls=0,saving=false,unsaved=false,confirm=false;const demo={allowed:false,isDemoEnabled:false,toggleDemo:async()=>{calls++}},h=hooks();
 const mod={exports:{}},code=ts.transpileModule(fs.readFileSync('components/demo-controls.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','document','window',code)(name=>name==='react'?h.react:name==='@/contexts/demo-context'?{useDemoMode:()=>demo}:name==='@/components/ui/dropdown-menu'?{DropdownMenuItem:'Item',DropdownMenuSeparator:'Separator'}:name==='@/components/ui/confirm-dialog'?{useConfirm:()=>async()=>confirm}:require(name),mod,mod.exports,{querySelector:selector=>selector.includes('data-saving')?saving:unsaved},{confirm:()=>confirm});
 const render=()=>h.render(()=>mod.exports.DemoMenuItems());assert.equal(render(),null);demo.allowed=true;
 let item=nodes(render()).find(n=>n.type==='Item');assert.match(text(item),/Off/);await item.props.onSelect();assert.equal(calls,1);
 saving=true;await item.props.onSelect();assert.equal(calls,1);saving=false;unsaved=true;await item.props.onSelect();assert.equal(calls,1);confirm=true;await item.props.onSelect();assert.equal(calls,2);
 demo.isDemoEnabled=true;item=nodes(render()).find(n=>n.type==='Item');assert.match(text(item),/exit demo/);await item.props.onSelect();assert.equal(calls,3);
});

test('authoritative booking synchronization replaces cancelled/rescheduled bookings while preserving other calendar events',()=>{
 const h=hooks(),mocks={'@/lib/workspace-api':{getTaskNotifications:async()=>[]},react:h.react,'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/lib/demo/store':{},'@/lib/demo/loader':{isDemoActive:()=>false,loadedDemoStore:()=>{throw Error('demo not loaded')}}};
 const {ApplicationStateProvider}=load('lib/application-state.tsx',mocks);
 const initialData={applications:[app('Invite','INTERVIEWING',{bookings:[booking('old')]})],meetings:[{id:'meeting',clubId:'club',date:new Date(),title:'Members meeting',location:'Hall',audience:'MEMBERS',club:{name:'Club'}}]};
 const render=()=>h.render(()=>ApplicationStateProvider({children:null,initialData,persistLocalState:false})).props.value;
 let value=render();assert.ok(value.events.some(event=>event.id==='booking-old'));
 value.syncApplicationBookings([app('Invite','INTERVIEWING',{bookings:[booking('new')]})]);value=render();assert.ok(value.events.some(event=>event.id==='booking-new'));assert.equal(value.events.some(event=>event.id==='booking-old'),false);assert.ok(value.events.some(event=>event.id==='meeting-meeting'));
 value.syncApplicationBookings([]);value=render();assert.equal(value.events.some(event=>event.id.startsWith('booking-')),false);assert.ok(value.events.some(event=>event.id==='meeting-meeting'));
});

test('a member club shell keeps personal sections as real paths beside the club pages',()=>{
 const h=hooks(),navigation=[],context=[];
 const {ProductShell}=load('components/shell/product-shell.tsx',{'@/lib/workspace-api':{getTaskNotifications:async()=>[]},react:h.react,'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({})},'@/contexts/auth-context':{useAuth:()=>({user:null})},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/contexts/organization-invitations-context':{useOrganizationInvitations:()=>({invitations:[]})},'@/lib/application-state':{useApplicationState:()=>({notifications:[]})}});
 const {memberRailSections}=require('./helpers/navigation-module.cjs');
 const shell=h.render(()=>ProductShell({mode:'clubs',clubId:'member-club',title:'Overview',sections:memberRailSections('member-club','Member club'),active:'club-home',onSelect:id=>context.push(id),onNavigate:view=>navigation.push(view)}));
 const links=sheetLinks(shell),href=id=>links.find(node=>node.props?.['data-tour']==='nav-'+id)?.props.href;
 assert.deepEqual(['student-dashboard','calendar','student-profile'].map(href),['/home','/calendar','/profile']);
 assert.equal(href('club-home'),'/club/member-club/workspace?section=overview');assert.equal(href('inbox'),undefined);
 assert.equal(links.find(node=>node.props?.['data-tour']==='nav-club-home').props['aria-current'],'page');
 assert.deepEqual(navigation,[]);assert.deepEqual(context,[]);
});

test('the /preview sample shell navigates in place and never links to live student routes',()=>{
 const h=hooks(),moves=[];
 const mocks={'@/lib/workspace-api':{getTaskNotifications:async()=>[]},react:h.react,'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({}),useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/preview'},'@/contexts/auth-context':{useAuth:()=>({user:null})},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/contexts/organization-invitations-context':{useOrganizationInvitations:()=>({invitations:[]})},'@/lib/application-state':{useApplicationState:()=>({notifications:[],focusApplication(){}})}};
 const {DashboardLayout}=load('components/dashboard-layout.tsx',mocks),{ProductShell}=load('components/shell/product-shell.tsx',mocks);
 const boundary=h.render(()=>DashboardLayout({view:'explore',personalSection:'explore',appMode:'student',onNavigate:(view,section)=>moves.push([view,section])}));
 const layout=h.render(()=>boundary.props.children.type(boundary.props.children.props));
 const shell=h.render(()=>ProductShell(layout.props)),links=sheetLinks(shell);
 assert.ok(links.length>0);assert.ok(links.every(node=>node.type==='button'&&!node.props.href),'every preview destination is an in-place button');
 links.find(node=>node.props['data-tour']==='nav-applications').props.onClick();assert.deepEqual(moves,[['tracker','applications']]);
});
test('Calendar is one rail destination in every personal section and keeps its title and active state',()=>{
 const h=hooks(),navigation=[];
 const mocks={'@/lib/workspace-api':{getTaskNotifications:async()=>[]},react:h.react,'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({}),useSearchParams:()=>new URLSearchParams()},'@/contexts/auth-context':{useAuth:()=>({user:null})},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/contexts/organization-invitations-context':{useOrganizationInvitations:()=>({invitations:[]})},'@/lib/application-state':{useApplicationState:()=>({notifications:[],focusApplication(){}})}};
 const {DashboardLayout}=load('components/dashboard-layout.tsx',mocks),{ProductShell}=load('components/shell/product-shell.tsx',mocks);
 const {personalDestination}=load('lib/product-navigation.ts');assert.deepEqual(personalDestination('calendar'),{view:'calendar'});
 for(const [section,mode] of [['explore','explore'],['applications','apply'],['tasks','clubs']]){
  const boundary=h.render(()=>DashboardLayout({view:'calendar',personalSection:section,appMode:'student',onNavigate:view=>navigation.push(view)}));
  const layout=h.render(()=>boundary.props.children.type(boundary.props.children.props));
  assert.equal(layout.props.mode,mode);assert.equal(layout.props.title,'Calendar');assert.equal(layout.props.active,'calendar');
  const shell=h.render(()=>ProductShell(layout.props));
  const calendar=sheetLinks(shell).filter(node=>node.props?.['data-tour']==='nav-calendar');
  assert.equal(calendar.length,1);assert.equal(calendar[0].props.href,'/calendar');assert.equal(calendar[0].props['aria-current'],'page');
  // The phone bar is the app's five tabs, so Calendar is one of them (and highlighted here).
  const mobile=nodes(shell).find(node=>node.type==='MobileNavigation');assert.deepEqual(mobile.props.items.map(item=>item.id),['student-dashboard','explore','inbox','calendar','student-profile']);assert.equal(mobile.props.active,'calendar');
 }
});
test('a background reload that lands after a draft opens keeps the open draft object and still updates the rest',async()=>{
 const draft=app('Draft','DRAFTING',{revision:1,answers:[{questionId:'q',response:'Local words'}]});
 const h=trackerHarness([draft,app('Other')],'all');h.render();await h.flush();let tree=h.render();
 h.setRecords([{...draft,revision:2,answers:[{questionId:'q',response:'Server words'}]},app('Other','ACCEPTED')]);
 const landing=h.revalidation.fn();management(tree).find(node=>node.props.application.id==='Draft').props.onOpen();tree=h.render();
 const before=nodes(tree).find(node=>node.type==='ApplicationForm').props.application;
 await landing;await h.flush();tree=h.render();const form=nodes(tree).find(node=>node.type==='ApplicationForm');
 assert.equal(form.props.application,before,'the open draft keeps its object');assert.equal(form.props.application.revision,1);assert.equal(form.props.application.answers[0].response,'Local words');
 const synced=h.calls.filter(call=>call[0]==='applications').at(-1)[1];assert.equal(synced.find(item=>item.id==='Other').status,'Accepted','other applications still update');
});
test('background and explicit application refresh failures are surfaced quietly without losing the list',async()=>{
 const h=trackerHarness([app('Invite','INTERVIEWING')]);h.render();await h.flush();let tree=h.render();
 h.fail();await h.revalidation.fn();tree=h.render();assert.equal(cards(tree).length,1,'current applications stay visible');
 assert.ok(nodes(tree).some(node=>node.props?.role==='status'&&/Couldn’t update your applications/.test(text(node))));
 cards(tree)[0].props.onOpen();tree=h.render();await nodes(tree).find(node=>node.type==='ApplicationStatusDetail').props.onRefresh();await h.flush();
 assert.match(nodes(h.render()).find(node=>node.type==='ApplicationStatusDetail').props.notice,/Couldn’t refresh/);
});

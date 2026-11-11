const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(search,{permission=true,selected=true,loading=false}={}) {
 const changes=[],redirects=[],member={id:'panel',clubId:'club',status:'ACTIVE',accessRole:'MEMBER',permissions:permission?['applications.review']:[],club:{name:'Synthetic',pipelineVersion:1,applicationVersion:1}};
 const url=new URL('https://example.test/club/club/workspace?'+search),browser={location:{href:url.href},history:{replaceState:(_s,_t,href)=>changes.push(href)}};
 const nav={exports:{}};new Function('module','exports','window',compile('lib/workspace-navigation.ts'))(nav,nav.exports,browser);
 const mocks={
  react:{useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:()=>{}},
  'next/navigation':{useRouter:()=>({replace:href=>redirects.push(href)}),useSearchParams:()=>new URLSearchParams(search)},
  'next/dynamic':{default:()=> 'Dynamic'},
  '@/contexts/auth-context':{useAuth:()=>({user:{id:'one',memberships:[member]},loading,activeClubId:selected?'club':'elsewhere',selectClub(){}})},
  '@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},
  '@/hooks/use-revalidate':{useRevalidate(){}},
  '@/components/shell/workspace-shell-context':{useShellBindings(){}},
  '@/lib/permissions':{hasWorkspace:()=>true,hasPermission:(m,p)=>m.permissions.includes(p)},
  '@/lib/club-workspace':{clubWorkspaceHref:id=>`/club/${id}/workspace`,recruitmentTools:()=>[{id:'interviews'}]},
  '@/lib/recruiting-settings':{RECRUITING_SETTINGS_PARAM:'recruitingSettings',recruitingSettingsSection:()=>null,canOpenRecruitingSettings:()=>false,recruitingSettingsSections:[],withRecruitingSettings:q=>new URLSearchParams(q)},
  '@/lib/club-workspace-preference':{clubWorkspacePreferenceKey:()=> 'test-preference'},
  '@/lib/product-navigation':{mobileDestinations:items=>items,canLeaveWorkspace:()=>true,managerNavigation:()=>[{id:'interviews',label:'Interviews'}]},
  '@/lib/navigation':{leaderRailSections:()=>[{id:'recruiting',items:[{id:'interviews',label:'Interviews'}]}],memberRailSections:()=>[],studentPath:()=>'/home'},
  '@/lib/club-settings':{resolveSettingsTab:()=>({})},
  '@/lib/campus-illustrations':{clubCampusIllustration:()=>undefined},
  '@/lib/interview-access':{interviewCapabilities:()=>({participate:true})},
  '@/lib/workspace-navigation':nav.exports,
  '@/lib/voting-navigation':require('./helpers/interview-harness.cjs').harness().load('lib/voting-navigation.ts'),
  '@/lib/workspace-routes':require('./helpers/interview-harness.cjs').harness().load('lib/workspace-routes.ts'),
  '@/lib/application-decisions':require('./helpers/interview-harness.cjs').harness().load('lib/application-decisions.ts'),
  '@/lib/copy/terms':require('./helpers/interview-harness.cjs').harness().load('lib/copy/terms.ts'),
  '@/lib/interview-entry':require('./helpers/interview-harness.cjs').harness().load('lib/interview-entry.ts'),
  '@/lib/applicant-interview-navigation':require('./helpers/interview-harness.cjs').harness().load('lib/applicant-interview-navigation.ts'),
 };
 const mod={exports:{}};new Function('require','module','exports',compile('components/club-workspace.tsx'))(name=>mocks[name]||(name.startsWith('@/')?new Proxy({},{get:(_,key)=>String(key)}):require(name)),mod,mod.exports);
 const tree=mod.exports.ClubWorkspace({clubId:'club'}),screen=tree;
 const nodes=[];function collect(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collect);return}nodes.push(node);collect(node.props?.children)}collect(screen);
 return {screen,nodes,changes,redirects};
}
test('an old in-workspace room URL holds on loading and moves to the interview route with its filters',()=>{
 const old=render('section=recruitment&tool=interviews&interview=1&interviewTab=rooms&applicationId=a&roundId=r');
 assert.equal(old.screen.type,'WorkspaceLoading');assert.deepEqual(old.changes,[]);
 const entry=require('./helpers/interview-harness.cjs').harness().load('lib/interview-entry.ts');
 assert.equal(entry.legacyInterviewRoomHref('club','section=recruitment&tool=interviews&interview=1&interviewTab=rooms&applicationId=a&roundId=r'),'/club/club/interview?interviewTab=rooms&applicationId=a&roundId=r');
 assert.equal(entry.legacyInterviewRoomHref('club','section=overview&interview=1'),null);
 assert.equal(entry.legacyInterviewRoomHref('club','section=recruitment&tool=applicants&interview=1'),null);
 assert.equal(entry.clubInterviewHref('a/b'),'/club/a%2Fb/interview');
});
function room(search,{permission=true,selected=true,loading=false,suspendedAt=null}={}) {
 const pushes=[],member={id:'panel',clubId:'club',status:'ACTIVE',accessRole:'MEMBER',permissions:permission?['applications.review']:[],club:{name:'Synthetic',color:'#123456',suspendedAt}},frames=[];
 const mocks={
  react:{useEffect:()=>{}},
  'next/navigation':{useRouter:()=>({push:href=>pushes.push(href)}),useSearchParams:()=>new URLSearchParams(search)},
  'next/dynamic':{default:()=> 'Dynamic'},'next/link':{default:'a'},
  '@/contexts/auth-context':{useAuth:()=>({user:{id:'one',memberships:[member]},loading,activeClubId:selected?'club':'elsewhere',selectClub(){}})},
  '@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},
  '@/lib/permissions':{hasWorkspace:()=>true,hasPermission:(m,p)=>m.permissions.includes(p)},
  '@/lib/interview-entry':require('./helpers/interview-harness.cjs').harness().load('lib/interview-entry.ts'),
  '@/components/shell/focus-frame-context':{useFocusFrame:details=>frames.push(details)},
 };
 const mod={exports:{}};new Function('require','module','exports',compile('components/interviews/club-interview-room.tsx'))(name=>mocks[name]||(name.startsWith('@/')?new Proxy({},{get:(_,key)=>String(key)}):require(name)),mod,mod.exports);
 const tree=mod.exports.ClubInterviewRoom({clubId:'club'});
 const nodes=[];function collect(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collect);return}nodes.push(node);collect(node.props?.children)}collect(tree);
 return {tree,nodes,pushes,frames};
}
test('the interview route restores the room on a fresh mount without assigning phase or score; Exit returns to the filtered list',()=>{
 const resumed=room('interviewTab=rooms&applicationId=a&roundId=r'),screen=resumed.nodes.find(node=>node.type==='Dynamic');
 assert.equal(screen.props.scoped,true);assert.equal(screen.props.postInterview,undefined);assert.equal(screen.props.score,undefined);
 screen.props.onExit();assert.deepEqual(resumed.pushes,['/club/club/workspace?interviewTab=rooms&roundId=r&section=recruitment&tool=interviews']);
 assert.equal(resumed.frames[0].exitHref,resumed.pushes[0]);assert.deepEqual(resumed.frames[0].club,{name:'Synthetic',color:'#123456'});
});
// The persistent shell lives in app/(workspace)/layout.tsx; the workspace renders its content (ShellState), not a loader.
test('scheduled list replaces generic entry and unrelated screens do not restore a room',()=>{
 const initial=render('section=recruitment&tool=interviews');
 assert.equal(initial.screen.type,'ShellState');
 assert.equal(initial.nodes.some(node=>node.props?.children==='Enter interview mode'),false);
 assert.deepEqual(initial.changes,[]);
 assert.equal(render('section=overview&interview=1').screen.type,'ShellState');
 assert.equal(render('section=recruitment&tool=applicants&interview=1').screen.type,'ShellState');
});
test('URL restoration still waits for current membership and selected club permissions',()=>{
 for(const options of [{selected:false},{loading:true}])assert.equal(room('applicationId=a&roundId=r',options).tree.type,'WorkspaceLoading');
 const denied=room('applicationId=a&roundId=r',{permission:false});
 assert.equal(denied.nodes.some(node=>node.type==='Dynamic'),false);assert.ok(denied.nodes.some(node=>node.props?.title==='Interview room unavailable'));
});
test('a club suspended after the page loaded shows the notice and never mounts the room',()=>{
 const suspended=room('applicationId=a&roundId=r',{suspendedAt:'2026-11-06T00:00:00Z'});
 assert.equal(suspended.nodes.some(node=>node.type==='Dynamic'),false);assert.ok(suspended.nodes.some(node=>node.props?.title==='This club is suspended'));
});

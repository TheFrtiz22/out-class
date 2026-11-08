const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const mod={exports:{}};new Function('require','module','exports','window','document',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.replace('@/','')+'.ts',mocks):n.startsWith('@/')||n.endsWith('.css')?new Proxy({},{get:(_,k)=>String(k)}):require(n),mod,mod.exports,mocks.window,mocks.document);return mod.exports}
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const label=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(label).join(''):n?.props?label(n.props.children):'';
const flush=()=>new Promise(r=>setImmediate(r));
const club={id:'club',name:'Research Club',source:'database',category:'Academic',color:'#142d4e',pitch:'Explore research',tags:[],logoText:'RC'};
function providerHarness({consumer=true,demo={isDemoEnabled:false,state:null}}={}){
 const slots=[],effects=[],listeners={};let cursor=0,activated=false,user={id:'student'},records=[{club,savedAt:'2026-10-03T12:00:00.000Z'}],resolve,reject,reads=0;
 const react={createContext:()=>({Provider:'Provider'}),useContext(){},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;return slots[i]??=({current:initial})},useCallback(fn,deps){const i=cursor++,prev=slots[i];if(!prev||deps.some((v,j)=>v!==prev.deps[j]))slots[i]={fn,deps};return slots[i].fn},useEffect(fn,deps){const i=cursor++,prev=slots[i];if(!prev||deps.some((v,j)=>v!==prev[j])){slots[i]=deps;effects.push(fn)}}};
 const api={getCorkboard:async()=>{reads++;return{items:structuredClone(records)}},setCorkboardClub:({saved})=>new Promise((res,rej)=>{resolve=()=>{records=saved?[{club,savedAt:'2026-10-03T12:00:00.000Z'}]:[];res({saved,savedAt:saved?'2026-10-03T12:00:00.000Z':null})};reject=()=>rej(Error('Database unavailable'))})};
 const {CorkboardProvider}=load('contexts/corkboard-context.tsx',{react,'@/contexts/auth-context':{useAuth:()=>({user,loading:false})},'@/contexts/demo-context':{useDemoMode:()=>demo},'@/lib/workspace-api':api,window:{addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener(){}},document:{visibilityState:'visible'}});
 return{render(){cursor=0;let value=CorkboardProvider({children:null}).props.value;if(consumer&&!activated){activated=true;while(effects.length)effects.shift()();value.activate();cursor=0;value=CorkboardProvider({children:null}).props.value}while(effects.length)effects.shift()();return value},finish:()=>resolve(),fail:()=>reject(),focus:()=>listeners.focus(),listening:()=>'focus' in listeners,logout:()=>user=null,reads:()=>reads};
}
test('optimistic Corkboard removal is immediate, blocks stale focus reads, and persists after reload',async()=>{const h=providerHarness();assert.equal(h.render().loading,true);await flush();let data=h.render();assert.equal(data.items.length,1);const pending=data.saveClub(club,false);data=h.render();assert.equal(data.items.length,0);assert.equal(data.pending.has(club.id),true);const reads=h.reads();await h.focus();assert.equal(h.reads(),reads);h.finish();await pending;await flush();data=h.render();assert.equal(data.items.length,0);assert.equal(data.pending.size,0);await data.refresh();assert.equal(h.render().items.length,0)});
test('failed removal restores only the affected item; account changes immediately conceal prior private saves',async()=>{const h=providerHarness();h.render();await flush();const pending=h.render().saveClub(club,false);assert.equal(h.render().items.length,0);h.fail();await assert.rejects(pending,/restored/);assert.equal(h.render().items.length,1);assert.match(h.render().error,/restored/);h.logout();const loggedOut=h.render();assert.equal(loggedOut.items.length,0);assert.equal(loggedOut.authenticated,false)});
test('saving is immediate, produces one shared saved state, and repeated clicks while pending cannot duplicate requests',async()=>{const h=providerHarness();h.render();await flush();let pending=h.render().saveClub(club,false);h.finish();await pending;await flush();const data=h.render();pending=data.saveClub(club,true);assert.equal(h.render().items.length,1);await h.render().saveClub(club,true);h.finish();await pending;await flush();assert.equal(h.render().items.length,1)});
test('Corkboard has loading, sign-in, empty, populated and retry states, reusing the existing card/profile',()=>{let state={items:[],loading:true,authenticated:true,error:'',refresh:async()=>{}};const mocks={'@/contexts/corkboard-context':{useCorkboard:()=>state},react:{useState:()=>[null,()=>{}]}};const {SavedClubsView}=load('components/views/saved-clubs-view.tsx',mocks),actions=[];const render=()=>SavedClubsView({onNavigate:v=>actions.push(v)});assert.ok(nodes(render()).some(n=>n.type==='LoadingState'&&n.props.label==='Loading Saved clubs…'));state.loading=false;assert.match(nodes(render()).find(n=>n.type==='EmptyState').props.title,/No saved clubs yet\./);nodes(render()).find(n=>n.type==='EmptyState').props.action.props.onClick();assert.deepEqual(actions,['explore']);state.authenticated=false;assert.match(label(render()),/Sign in to save/);state.authenticated=true;state.items=[{club,savedAt:'2026-10-03'}];assert.ok(nodes(render()).some(n=>n.type==='DiscoveryCard'&&n.props.club.id===club.id));state.items=[];state.error='Unavailable';assert.match(label(render()),/Retry Saved clubs/)});
test('rail and phone bar read one registry: one name per destination, Notifications only in the header',()=>{
 const nav=require('./helpers/navigation-module.cjs'),sections=nav.personalRailSections(),items=nav.railItems(sections);
 // Seven destinations: Settings is in the account menu, Inbox behind the bell, Status an Applications tab, Meetings a Calendar filter.
 assert.deepEqual(items.map(item=>item.label),['Home','Explore','Events','Applications','My Clubs','Calendar','Profile']);
 assert.equal(items.some(item=>item.id==='inbox'||item.label==='Discover'),false);
 assert.ok(items.every(item=>item.href?.startsWith('/')),'every rail item is a real path');
 assert.ok(sections.every(section=>section.label||section.name),'every rail group has an accessible name');
 const bar=nav.bottomBarItems(sections,'personal');assert.deepEqual(bar.map(item=>item.label),['Home','Explore','Applications','My Clubs']);
 const {MobileNavigation}=load('components/shell/mobile-navigation.tsx',{'next/link':{default:'Link'}});
 const tree=MobileNavigation({items:bar,groups:items,active:nav.activeNavItem('/explore/categories'),onSelect(){},onLink(){},onMore(){}});
 const links=nodes(tree).filter(node=>node.type==='Link');assert.deepEqual(links.map(label),['Home','Explore','Applications','My Clubs']);
 assert.equal(links.find(node=>label(node)==='Explore').props['aria-current'],'page');
 assert.equal(nodes(tree).find(node=>node.type==='button').props['aria-label'],'More sections');
});
test('the active rail item follows the URL, including detail pages, and stays empty where no rail item applies',()=>{
 const {activeNavItem,inPlaceSections,personalRailSections,railItems}=require('./helpers/navigation-module.cjs'),q=v=>new URLSearchParams(v);
 const cases=[['/home','student-dashboard'],['/explore','explore'],['/explore/categories','explore'],['/corkboard','corkboard'],['/saved-clubs','corkboard'],['/applications','applications'],['/applications/status','applications'],['/applications/app-1/decision','applications'],['/clubs','clubs'],['/clubs/meetings','calendar'],['/meetings','calendar'],['/meetings/m-1','calendar'],['/clubs/tasks','clubs'],['/calendar','calendar'],['/settings/interviews','calendar'],['/profile','student-profile'],['/settings/notifications','settings'],['/inbox',null],['/club/abc','explore'],['/platform','overview'],['/platform/audit','audit']];
 for(const [path,id] of cases)assert.equal(activeNavItem(path),id,path);
 assert.equal(activeNavItem('/preview'),null,'preview falls back to the shell state');
 const ws=(search,member)=>activeNavItem('/club/c/workspace',q(search),{member});
 assert.equal(ws('section=recruitment&tool=overview'),'overview');assert.equal(ws('section=recruitment&tool=rules'),'overview');assert.equal(ws('section=recruitment'),'applicants');
 assert.equal(ws('section=overview'),'club-home');assert.equal(ws(''),'club-home');
 assert.equal(ws('section=tasks'),'tasks');assert.equal(ws('section=tasks',true),'club-tasks');assert.equal(ws('section=announcements&mode=recruiting'),'announcements');
 assert.ok(railItems(inPlaceSections(personalRailSections())).every(item=>!item.href),'the /preview shell keeps navigation in place');
});
test('student tutorials keep their eight-step indices/version contract while replacing the existing Corkboard placeholder',()=>{const {tutorialSteps,tutorialInput}=load('lib/tutorials.ts');assert.equal(tutorialSteps.student.length,8);assert.equal(tutorialSteps.student[1].view,'explore');assert.equal(tutorialSteps.student[6].view,'corkboard');assert.equal(tutorialSteps.student[6].anchor,'nav-corkboard');assert.equal(tutorialInput.parse({experience:'student',action:'progress',step:6}).step,6);assert.doesNotMatch(JSON.stringify(tutorialSteps.student),/when available|view":"discover"|Categories/)});

test('pages without a saved-club consumer never request the Corkboard and attach no focus refresh',async()=>{const h=providerHarness({consumer:false});h.render();await flush();h.render();assert.equal(h.listening(),false,'no focus refresh is attached');assert.equal(h.reads(),0);const data=h.render();data.activate();h.render();await flush();assert.equal(h.reads(),1,'the first consumer loads it once');assert.equal(h.render().items.length,1)});

test('after a consumer activates it, focus refreshes saved clubs as before',async()=>{const h=providerHarness();h.render();await flush();h.render();const reads=h.reads();assert.equal(h.listening(),true);await h.focus();await flush();assert.equal(h.reads(),reads+1)});
test('Demo Mode loads once on activation and refreshes when demo data changes, never without a consumer',async()=>{const demo={isDemoEnabled:true,state:{v:1}};const idle=providerHarness({consumer:false,demo});idle.render();await flush();idle.render();assert.equal(idle.reads(),0,'no consumer: no demo read');const h=providerHarness({demo});h.render();await flush();h.render();assert.equal(h.reads(),1,'activation loads once (no duplicate demo refresh)');demo.state={v:2};h.render();await flush();h.render();assert.equal(h.reads(),2,'a demo edit refreshes once')});
test('useCorkboard activates the provider from an effect',()=>{let activated=0;const effects=[];const react={createContext:()=>({Provider:'Provider'}),useContext:()=>({activate:()=>activated++}),useState:v=>[v,()=>{}],useRef:v=>({current:v}),useCallback:f=>f,useEffect:fn=>effects.push(fn)};const {useCorkboard}=load('contexts/corkboard-context.tsx',{react,'@/contexts/auth-context':{useAuth:()=>({})},'@/contexts/demo-context':{useDemoMode:()=>({})},'@/lib/workspace-api':{}});useCorkboard();assert.equal(activated,0,'not during render');effects.forEach(fn=>fn());assert.equal(activated,1,'once its effect runs')});

test('Explore\'s Applications open disclosure uses the Phosphor chevron instead of the native text triangle', () => {
  const source = fs.readFileSync('components/views/explore-view.tsx', 'utf8')
  const summary = source.match(/<details className="oc-explore-available group"><summary className="([^"]+)">(<ChevronDown [^>]+\/>)Applications open/)
  assert.ok(summary, 'summary starts with ChevronDown')
  assert.match(summary[1], /list-none/); assert.match(summary[1], /\[&::-webkit-details-marker\]:hidden/)
  assert.match(summary[2], /group-open:rotate-0/); assert.match(summary[2], /motion-reduce:transition-none/)
})

test('Filter menus close on Escape with focus returned to the summary, and on an outside press', () => {
  class FakeNode {}
  const listeners = {}, documentStub = { addEventListener: (type, fn) => listeners[type] = fn, removeEventListener: type => delete listeners[type] }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', 'document', 'Node', ts.transpileModule(fs.readFileSync('hooks/use-dismissable-details.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => ({ useCallback: fn => fn }), mod, mod.exports, documentStub, FakeNode)
  let focused = false, keydown = null
  const inside = new FakeNode(), outside = new FakeNode(), summary = { focus: () => focused = true }
  const details = { open: true, contains: node => node === inside, addEventListener: (type, fn) => keydown = fn, removeEventListener: () => keydown = null, querySelector: selector => selector === ':scope > summary' ? summary : null }
  const cleanup = mod.exports.useDismissableDetails()(details)
  let stopped = false; const key = name => ({ key: name, preventDefault() {}, stopPropagation() { stopped = true } })
  keydown(key('Tab')); assert.equal(details.open, true)
  keydown(key('Escape')); assert.equal(details.open, false); assert.equal(focused, true); assert.equal(stopped, true, 'an enclosing drawer stays open')
  details.open = true; listeners.pointerdown({ target: inside }); assert.equal(details.open, true, 'presses inside keep it open')
  listeners.pointerdown({ target: outside }); assert.equal(details.open, false, 'an outside press closes it')
  cleanup(); assert.equal(listeners.pointerdown, undefined); assert.equal(keydown, null)
})

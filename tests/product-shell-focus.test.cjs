const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
test('shell focuses content on primary mode or club changes even when the destination remains Overview',()=>{
 const slots=[],effects=[],calls=[]
 let index=0
 const react={useState(v){index++;return[v,()=>{}]},useRef(v){const i=index++;return slots[i]??={current:v}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
 const mocks={react,'@/lib/profile-photo':{profilePhotoSource:()=>undefined},'next/navigation':{useRouter:()=>({push(){}})},'@/lib/workspace-api':{getTaskNotifications:async()=>[]},'@/contexts/auth-context':{useAuth:()=>({user:null})},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/contexts/organization-invitations-context':{useOrganizationInvitations:()=>({invitations:[]})},'@/lib/application-state':{useApplicationState:()=>({notifications:[]})},'@/lib/views':{adminNav:[],studentNav:[]},'@/lib/utils':{cn:()=>''},'@/lib/permissions':{hasPermission:()=>false},'@/lib/product-navigation':{personalUniversalItems:[],canLeaveWorkspace:()=>true}}
 const mod={exports:{}},code=ts.transpileModule(fs.readFileSync('components/shell/product-shell.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
 new Function('require','module','exports','window','document',code)(name=>mocks[name]||(name.endsWith('.css')?{}:name.startsWith('@/')?new Proxy({},{get:(_,key)=>String(key)}):require(name)),mod,mod.exports,{scrollTo:()=>calls.push('scroll'),matchMedia:()=>({addEventListener(){},removeEventListener(){}}),addEventListener(){},removeEventListener(){}},{title:''})
 function render(mode,clubId='mii'){
  index=0
  mod.exports.ProductShell({mode,clubId,active:'overview',title:'Overview',modes:[],items:[],onNavigate(){},onSelect(){}})
  slots[3].current={focus:()=>calls.push('focus')}
  while(effects.length)effects.shift()()
 }
 render('recruiting');assert.deepEqual(calls,[])
 render('club');assert.deepEqual(calls,['focus','scroll'])
 render('club');assert.equal(calls.length,2)
 render('club','other');assert.deepEqual(calls,['focus','scroll','focus','scroll'])
})

test('pending invitations drive the notification bell and are reviewable in the inbox without a separate notification record',()=>{
 const {nodes}=require('./helpers/invitations-ui.cjs'),path=require('node:path');
 const state={invitations:[]},navigations=[];
 const mocks={
  react:{useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect(){},useMemo:fn=>fn()},
  'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({})},
  '@/lib/workspace-api':{getTaskNotifications:async()=>[]},'@/contexts/auth-context':{useAuth:()=>({user:null})},
  '@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},
  '@/contexts/organization-invitations-context':{useOrganizationInvitations:()=>state},
  '@/lib/application-state':{useApplicationState:()=>({notifications:[],focusNotificationId:null})},
  '@/lib/views':{adminNav:[],studentNav:[]},
  '@/lib/product-navigation':{personalUniversalItems:[],canLeaveWorkspace:()=>true},
 };
 function load(file){
  const mod={exports:{}},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>mocks[name]||(name.endsWith('.css')?{}:name.startsWith('@/lib/')?load(path.resolve(name.slice(2)+'.ts')):name.startsWith('@/')?new Proxy({},{get:(_,key)=>String(key)}):require(name)),mod,mod.exports);
  return mod.exports;
 }
 const {ProductShell}=load('components/shell/product-shell.tsx'),{InboxView}=load('components/views/inbox-view.tsx');
 const render=()=>ProductShell({mode:'personal',active:'student-dashboard',title:'Overview',modes:[],items:[],onSelect(){},onNavigate:view=>navigations.push(view)});
 const bell=()=>nodes(render()).find(node=>node.props?.['data-tour']==='notifications');
 assert.equal(bell().props['aria-label'],'Notifications');assert.equal(nodes(bell()).some(node=>node.type==='span'),false);
 assert.equal(nodes(InboxView({onNavigate(){}})).some(node=>node.type==='OrganizationOwnershipRequests'),false);
 state.invitations=[{id:'invite'}];
 assert.equal(bell().props['aria-label'],'Notifications, 0 unread, 1 pending invitation');assert.ok(nodes(bell()).some(node=>node.type==='span'));
 bell().props.onClick();assert.deepEqual(navigations,['inbox']);
 assert.equal(nodes(InboxView({onNavigate(){}})).find(node=>node.type==='OrganizationOwnershipRequests').props.includeDismissed,true);
 state.invitations=[];assert.equal(bell().props['aria-label'],'Notifications');assert.equal(nodes(bell()).some(node=>node.type==='span'),false);
});

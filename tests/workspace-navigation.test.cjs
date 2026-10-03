const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const navigationModule={exports:{}}
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/student-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(navigationModule,navigationModule.exports)
function shell(routeSearch,windowSearch='') {
 const effects=[],changes=[],redirects=[],stateChanges=[]
 const demo={isDemoEnabled:true,state:{perspective:{role:'leader',clubId:'mii'}},viewAs:(...args)=>changes.push(args)}
 const router={replace:path=>redirects.push(path),push:path=>redirects.push(path)}
 const mocks={
  react:{useState:initial=>[initial,value=>stateChanges.push(value)],useEffect:effect=>effects.push(effect)},
  'next/navigation':{useRouter:()=>router,useSearchParams:()=>new URLSearchParams(routeSearch)},
  '@/contexts/demo-context':{useDemoMode:()=>demo},
  '@/contexts/auth-context':{useAuth:()=>({user:{memberships:[]},selectClub(){}})},
  '@/lib/demo/store':{demoDashboard:()=>({applications:[],attendances:[]})},
  '@/lib/student-navigation':navigationModule.exports,
  '@/lib/club-workspace':{clubWorkspaceHref:id=>`/club/${id}/workspace`},
 }
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync('components/app-shell.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 new Function('require','module','exports','window',code)(name=>mocks[name]||(name.startsWith('@/')?new Proxy({},{get:(_,key)=>String(key)}):require(name)),mod,mod.exports,{location:{search:windowSearch}})
 const tree=mod.exports.AppShell({})
 effects.forEach(effect=>effect())
 return {view:tree.type === "LandingPageView" ? "landing" : tree.props.children.props.view,mode:tree.props.children?.props.appMode,changes,redirects,stateChanges,enter:tree.props.onNavigateToApp}
}
test('Student workspace navigation uses the incoming route, even before the browser URL commits',()=>{
 const result=shell('?workspace=student','')
 assert.equal(result.view,'student-dashboard')
 assert.equal(result.mode,'student')
 assert.deepEqual(result.changes,[['student']])
 assert.deepEqual(result.redirects,[])
})
test('explicit leader workspace still forwards to the permitted MII workspace',()=>{
 const result=shell('?workspace=leader')
 assert.equal(result.mode,'admin')
 assert.deepEqual(result.redirects,['/club/mii/workspace'])
})

test("main site link opens landing even with a saved demo leader session",()=>{
 const result=shell('')
 assert.equal(result.view,"landing")
 assert.deepEqual(result.redirects,[])
})

test("landing Sign in opens authentication despite a saved demo session",()=>{
 const result=shell('')
 result.stateChanges.length=0
 result.enter("student")
 assert.deepEqual(result.stateChanges,["student","auth"])
})

test('legacy Discovery/Categories bookmarks resolve into one canonical Explore destination',()=>{
 for(const alias of ['discover','discovery','categories']){
  const result=shell(`?workspace=student&view=${alias}`);assert.ok(result.stateChanges.includes('explore'));assert.deepEqual(result.redirects,['/?workspace=student&view=explore']);
 }
 const current=shell('?workspace=student&view=explore');assert.ok(current.stateChanges.includes('explore'));assert.deepEqual(current.redirects,[]);
 const board=shell('?workspace=student&view=corkboard');assert.ok(board.stateChanges.includes('corkboard'));assert.deepEqual(board.redirects,[]);
});
test('student route scope preserves existing interviews, decisions, membership tasks and rejects unrelated sections',()=>{
 const {resolveStudentView,sectionForStudentView}=navigationModule.exports;
 assert.equal(resolveStudentView('bad'),null);assert.equal(resolveStudentView('Categories'),'explore');assert.equal(sectionForStudentView('tracker','interviews'),'interviews');assert.equal(sectionForStudentView('tracker','decisions'),'decisions');assert.equal(sectionForStudentView('my-clubs','tasks'),'tasks');assert.equal(sectionForStudentView('explore','categories'),'explore');assert.equal(sectionForStudentView('corkboard','tasks'),'corkboard');
});

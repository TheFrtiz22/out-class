const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
function shell(routeSearch,windowSearch='') {
 const effects=[],changes=[],redirects=[]
 const demo={isDemoEnabled:true,state:{perspective:{role:'leader',clubId:'mii'}},viewAs:(...args)=>changes.push(args)}
 const router={replace:path=>redirects.push(path),push:path=>redirects.push(path)}
 const mocks={
  react:{useState:initial=>[initial,()=>{}],useEffect:effect=>effects.push(effect)},
  'next/navigation':{useRouter:()=>router,useSearchParams:()=>new URLSearchParams(routeSearch)},
  '@/contexts/demo-context':{useDemoMode:()=>demo},
  '@/contexts/auth-context':{useAuth:()=>({user:{memberships:[]},selectClub(){}})},
  '@/lib/demo/store':{demoDashboard:()=>({applications:[],attendances:[]})},
  '@/lib/club-workspace':{clubWorkspaceHref:id=>`/club/${id}/workspace`},
 }
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync('components/app-shell.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 new Function('require','module','exports','window',code)(name=>mocks[name]||(name.startsWith('@/')?new Proxy({},{get:(_,key)=>String(key)}):require(name)),mod,mod.exports,{location:{search:windowSearch}})
 const tree=mod.exports.AppShell({})
 effects.forEach(effect=>effect())
 return {view:tree.props.children.props.view,mode:tree.props.children.props.appMode,changes,redirects}
}
test('Student workspace navigation uses the incoming route, even before the browser URL commits',()=>{
 const result=shell('?workspace=student','')
 assert.equal(result.view,'student-dashboard')
 assert.equal(result.mode,'student')
 assert.deepEqual(result.changes,[['student']])
 assert.deepEqual(result.redirects,[])
})
test('leader home still forwards to the permitted MII workspace',()=>{
 const result=shell('')
 assert.equal(result.mode,'admin')
 assert.deepEqual(result.redirects,['/club/mii/workspace'])
})

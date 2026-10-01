const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
test('shell focuses content on primary mode or club changes even when the destination remains Overview',()=>{
 const slots=[],effects=[],calls=[]
 let index=0
 const react={useState(v){index++;return[v,()=>{}]},useRef(v){const i=index++;return slots[i]??={current:v}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
 const mocks={react,'next/navigation':{useRouter:()=>({push(){}})},'@/contexts/auth-context':{useAuth:()=>({user:null})},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false})},'@/lib/application-state':{useApplicationState:()=>({notifications:[]})},'@/lib/views':{adminNav:[],studentNav:[]},'@/lib/utils':{cn:()=>''},'@/lib/permissions':{hasPermission:()=>false}}
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

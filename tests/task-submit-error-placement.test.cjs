const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function compile(file,mocks={}){const mod={exports:{}};new Function('require','module','exports','window','document',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n]||(n.startsWith('@/lib/')?compile(n.replace('@/','')+'.ts'):n==='@/components/ui/confirm-dialog'?require('./helpers/confirm-stub.cjs'):n.startsWith('@/')?new Proxy({},{get:(_,k)=>k}):require(n)),mod,mod.exports,{addEventListener(){},removeEventListener(){},confirm(){return true},dispatchEvent(){}},{querySelector(){return null},getElementById(){return null}});return mod.exports}
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
const text=n=>typeof n==='number'?String(n):typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''

// The server refuses a link with "Use a full link that starts with https://.". That message used to
// appear at the top of the task drawer (and on the list behind it), while the member was scrolled
// down at Submit work, so on a phone nothing visible happened when they pressed it.
const refusal=Object.assign(new Error('Use a full link that starts with https://.'),{name:'UserFacingError'})
function setup(){
 const slots=[],effects=[];let index=0
 const own={id:'a',memberId:'member',revision:2,viewedAt:new Date(),submittedAt:null,reviewedAt:null,text:'',link:'',files:[],member:{user:{email:'m@example.test',studentProfile:null}}}
 const workspace={clubId:'club',memberId:'member',manage:false,members:[],tasks:[{id:'task',clubId:'club',revision:3,title:'Your research',description:'',kind:'TASK',status:'OPEN',dueAt:null,requirements:['TEXT'],assignments:[own]}]}
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useRef(v){const i=index++;return slots[i]??={current:v}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
 const draft={flush:async()=>{},clear:async()=>{},onBlur(){},dirty:false}
 const mod=compile('components/club-tasks.tsx',{react,'next/link':{__esModule:true,default:'Link'},'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[]},loading:false})},'@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},'@/hooks/use-revalidate':{useRevalidate(){}},'@/hooks/use-editor-draft':{useEditorDraft:()=>draft},'@/lib/user-message':{userMessage:(e,fallback)=>e?.message||fallback},'@/lib/workspace-api':{getTaskWorkspace:async()=>workspace,viewTask:async()=>{},submitTask:async()=>{throw refusal}}})
 // Render the page and the drawer's submission form together, as React would.
 function render(){index=0;const page=mod.ClubTasks({clubId:'club',embedded:true,initialScope:'mine'});while(effects.length)effects.shift()();const detailEl=nodes(page).find(n=>n.type?.name==='TaskDetail');let form=null;if(detailEl){const detail=detailEl.type(detailEl.props);const sub=nodes(detail).find(n=>n.type?.name==='Submission');form=sub.type(sub.props)}return{page,form}}
 return{render}
}
test('a refused submission is shown beside Submit work, not at the top of the drawer',async()=>{
 const h=setup();h.render();await flush();let {page}=h.render()
 nodes(page).find(n=>n.type==='button'&&text(n).includes('Your research')).props.onClick({currentTarget:{}})
 ;({page}=h.render())
 let {form}=h.render()
 const saved=globalThis.FormData;globalThis.FormData=class{get(k){return {text:'Done',link:'ftp://example.com/x'}[k]}}
 try{await nodes(form).find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}});await flush()}finally{globalThis.FormData=saved}
 ;({page,form}=h.render())
 const formNodes=nodes(form),alertAt=formNodes.findIndex(n=>n.props?.role==='alert'&&text(n).includes('Use a full link that starts with https://.')),buttonAt=formNodes.findIndex(n=>n.type==='Button'&&/Submit work/.test(text(n)))
 assert.ok(alertAt>=0,'the refusal is shown inside the submission form')
 assert.ok(buttonAt>alertAt,'the refusal sits above the Submit work button')
 const drawer=nodes(page).find(n=>n.type==='SheetContent')
 assert.equal(nodes(drawer).filter(n=>n.props?.role==='alert'&&text(n).includes('Use a full link')).length,0,'the drawer header does not repeat it')
 assert.doesNotMatch(text(page),/Use a full link/,'the list behind the drawer does not show it with a reload button')
})

test('the dashboard task view routes a submit refusal to the form as well', () => {
 const source=fs.readFileSync('components/tasks/dashboard-task.tsx','utf8')
 assert.match(source,/async function run\(fn: \(\) => Promise<unknown>, options\?: \{ onError\?: \(message: string\) => void \}\)/)
 assert.match(source,/if \(options\?\.onError\) options\.onError\(message\); else setError\(message\)/)
})

const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function compile(file,mocks={}){const mod={exports:{}};new Function('require','module','exports','window','document',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n]||(n.startsWith('@/lib/')?compile(n.replace('@/','')+'.ts'):n.startsWith('@/')?new Proxy({},{get:(_,k)=>k}):require(n)),mod,mod.exports,{addEventListener(){},removeEventListener(){},confirm(){return true}},{querySelector(){return null}});return mod.exports}
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
const text=n=>typeof n==='number'?String(n):typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
function harness(manage=true,personalOnly=false){
 const slots=[],effects=[],calls=[];let index=0
 const own={id:'a',memberId:'member',revision:2,viewedAt:null,submittedAt:null,reviewedAt:null,member:{user:{email:'member@example.test',studentProfile:null}}}
 const workspace={clubId:'club',memberId:'member',manage,members:[],tasks:[{id:'task',revision:3,title:'Your research',description:'Read the paper',kind:'TASK',status:'OPEN',dueAt:null,assignments:[own]},{id:'team-task',revision:1,title:'Team project',description:'',kind:'PROJECT',status:'OPEN',dueAt:null,assignments:[{...own,id:'b',memberId:'other'}]},{id:'submitted',revision:1,title:'Submitted paper',description:'',kind:'TASK',status:'OPEN',dueAt:null,assignments:[{...own,id:'c',submittedAt:new Date()}]}]}
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useRef(v){const i=index++;return slots[i]??={current:v}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
 const C=compile('components/club-tasks.tsx',{react,'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[]},loading:false})},'@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},'@/lib/workspace-api':{getTaskWorkspace:async()=>workspace,viewTask:async id=>calls.push(['view',id])}}).ClubTasks
 return{calls,workspace,render(){index=0;const tree=C({clubId:'club',embedded:true,personalOnly});while(effects.length)effects.shift()();return tree}}
}
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
test('task workspace keeps Team gated and opens a shared detail drawer without changing task revisions',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();assert.ok(button(tree,'My Tasks'));assert.ok(button(tree,'Team'));assert.doesNotMatch(text(tree),/Team project/)
 const row=nodes(tree).find(n=>n.type==='button'&&text(n).includes('Your research'));row.props.onClick({currentTarget:{}});tree=h.render()
 const detail=nodes(tree).find(n=>n.type?.name==='TaskDetail');assert.equal(detail.props.task.revision,3);assert.equal(detail.props.manager,false);assert.equal(nodes(tree).find(n=>n.type==='Sheet').props.open,true);assert.deepEqual(h.calls,[['view','a']])
 nodes(tree).find(n=>n.type==='Sheet').props.onOpenChange(false);tree=h.render();button(tree,'Team').props.onClick();tree=h.render();assert.match(text(tree),/Team project/)
 const limited=harness(false);limited.render();await flush();assert.equal(button(limited.render(),'Team'),undefined)
 const personal=harness(true,true);personal.render();await flush();tree=personal.render();assert.equal(button(tree,'Team'),undefined);assert.doesNotMatch(text(tree),/Team project/)
})
test('submitted filter separates work awaiting review from outstanding assignments',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();nodes(tree).find(n=>n.type==='select'&&n.props.value==='open').props.onChange({target:{value:'submitted'}});tree=h.render();assert.match(text(tree),/Submitted paper/);assert.doesNotMatch(text(tree),/Your research/)
})

test('personal task totals separate due, missing and submitted work and filter on click',async()=>{
 const h=harness(false,true)
 const base=h.workspace.tasks[0]
 h.workspace.tasks.push(
  {...base,id:'late',title:'Missing exercise',dueAt:new Date('2020-01-01'),assignments:[{...base.assignments[0],id:'late-a'}]},
  {...base,id:'reviewed',title:'Reviewed exercise',assignments:[{...base.assignments[0],id:'review-a',submittedAt:new Date(),reviewedAt:new Date()}]},
  {...base,id:'closed',title:'Closed exercise',status:'DONE',assignments:[{...base.assignments[0],id:'closed-a'}]}
 )
 h.render();await flush();let tree=h.render()
 const total=(key)=>nodes(tree).find(n=>n.type==='button'&&n.props.className===`oc-task-total oc-task-${key}`)
 assert.equal(text(total('due')),'1Due')
 assert.equal(text(total('missing')),'1Missing')
 assert.equal(text(total('submitted')),'2Submitted')
 total('missing').props.onClick();tree=h.render()
 assert.match(text(tree),/Missing exercise/);assert.doesNotMatch(text(tree),/Your research|Reviewed exercise|Closed exercise/)
 total('submitted').props.onClick();tree=h.render()
 assert.match(text(tree),/Submitted paper/);assert.match(text(tree),/Reviewed exercise/);assert.doesNotMatch(text(tree),/Missing exercise/)
 total('due').props.onClick();tree=h.render()
 assert.match(text(tree),/Your research/);assert.doesNotMatch(text(tree),/Submitted paper|Missing exercise/)
})

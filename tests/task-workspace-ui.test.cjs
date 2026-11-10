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
 const C=compile('components/club-tasks.tsx',{react,'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[]},loading:false})},'@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},'@/hooks/use-revalidate':{useRevalidate(){}},'@/lib/workspace-api':{getTaskWorkspace:async()=>workspace,viewTask:async id=>calls.push(['view',id])}}).ClubTasks
 return{calls,workspace,render(){index=0;const tree=C({clubId:'club',embedded:true,personalOnly,initialScope:"mine"});while(effects.length)effects.shift()();return tree}}
}
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
// The My Tasks / Manage switch is a SegmentedControl: expose its options like buttons.
const scope=(tree,label)=>{const group=nodes(tree).find(n=>n.type==='SegmentedControl'&&n.props.label==='Task workspace'),option=group?.props.options.find(o=>o.label===label);return option&&{props:{onClick:()=>group.props.onChange(option.value)}}}
test('task workspace keeps Team gated and opens a shared detail drawer without changing task revisions',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();assert.ok(scope(tree,'My Tasks'));assert.ok(scope(tree,'Manage'));assert.doesNotMatch(text(tree),/Team project/)
 const row=nodes(tree).find(n=>n.type==='button'&&text(n).includes('Your research'));row.props.onClick({currentTarget:{}});tree=h.render()
 const detail=nodes(tree).find(n=>n.type?.name==='TaskDetail');assert.equal(detail.props.task.revision,3);assert.equal(detail.props.manager,false);assert.equal(nodes(tree).find(n=>n.type==='Sheet').props.open,true);assert.deepEqual(h.calls,[['view','a']])
 nodes(tree).find(n=>n.type==='Sheet').props.onOpenChange(false);tree=h.render();scope(tree,'Manage').props.onClick();tree=h.render();assert.equal(nodes(tree).find(node=>node.type==='TaskManagerWorkspace').props.workspace.tasks.length,3)
 const limited=harness(false);limited.render();await flush();assert.equal(scope(limited.render(),'Manage'),undefined)
 const personal=harness(true,true);personal.render();await flush();tree=personal.render();assert.equal(scope(tree,'Manage'),undefined);assert.doesNotMatch(text(tree),/Team project/)
})
test('submitted filter separates work awaiting review from outstanding assignments',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();nodes(tree).find(n=>['select','NativeSelect'].includes(n.type?.name??n.type)&&n.props.value==='open').props.onChange({target:{value:'submitted'}});tree=h.render();assert.match(text(tree),/Submitted paper/);assert.doesNotMatch(text(tree),/Your research/)
})

test('personal task counts separate due, missing and submitted work inside the Status filter',async()=>{
 const h=harness(false,true)
 const base=h.workspace.tasks[0]
 h.workspace.tasks.push(
  {...base,id:'late',title:'Missing exercise',dueAt:new Date('2020-01-01'),assignments:[{...base.assignments[0],id:'late-a'}]},
  {...base,id:'reviewed',title:'Reviewed exercise',assignments:[{...base.assignments[0],id:'review-a',submittedAt:new Date(),reviewedAt:new Date()}]},
  {...base,id:'closed',title:'Closed exercise',status:'DONE',assignments:[{...base.assignments[0],id:'closed-a'}]}
 )
 h.render();await flush();let tree=h.render()
 // Counts live in the Status options (no separate counter boxes).
 assert.equal(nodes(tree).some(n=>typeof n.props?.className==='string'&&n.props.className.includes('oc-task-total')),false)
 const status=()=>nodes(tree).find(n=>n.props?.['aria-label']==='Status')
 const labels=nodes(status()).filter(n=>n.type==='option').map(text)
 assert.ok(labels.includes('Due (1)'));assert.ok(labels.includes('Missing (1)'));assert.ok(labels.includes('Submitted (2)'))
 status().props.onChange({target:{value:'overdue'}});tree=h.render()
 assert.match(text(tree),/Missing exercise/);assert.doesNotMatch(text(tree),/Your research|Reviewed exercise|Closed exercise/)
 status().props.onChange({target:{value:'submitted'}});tree=h.render()
 assert.match(text(tree),/Submitted paper/);assert.match(text(tree),/Reviewed exercise/);assert.doesNotMatch(text(tree),/Missing exercise/)
 status().props.onChange({target:{value:'due'}});tree=h.render()
 assert.match(text(tree),/Your research/);assert.doesNotMatch(text(tree),/Submitted paper|Missing exercise/)
})

test('personal empty states distinguish no assignments from filtered or completed work',async()=>{
 const h=harness(false,true);h.workspace.tasks=[];h.render();await flush();let tree=h.render()
 assert.match(text(tree),/You're all caught up\./);assert.doesNotMatch(text(tree),/No matching work/)
 const search=nodes(tree).find(n=>n.type==='Input'&&n.props['aria-label']==='Search tasks');search.props.onChange({target:{value:'research'}});tree=h.render();assert.match(text(tree),/No tasks match your filters\./)
 button(tree,'Clear filters').props.onClick();tree=h.render();assert.match(text(tree),/You're all caught up\./)
 const saved=harness(false,true);saved.workspace.tasks=saved.workspace.tasks.filter(task=>task.id==='submitted');saved.render();await flush();tree=saved.render();assert.match(text(tree),/You're all caught up\./);button(tree,'View all tasks').props.onClick();assert.match(text(saved.render()),/Submitted paper/)
})

function reloadHarness(){
 const slots=[],effects=[];let index=0,reload=null;const reads=[]
 const workspace=status=>({clubId:'club',memberId:'member',manage:true,members:[],tasks:[{id:'task',revision:3,title:`Research (${status})`,description:'',kind:'TASK',status:'OPEN',dueAt:null,assignments:[{id:'a',memberId:'member',revision:2,viewedAt:new Date(),submittedAt:null,reviewedAt:null,member:{user:{email:'m@example.test',studentProfile:null}}}]}]})
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useRef(v){const i=index++;return slots[i]??={current:v}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
 const read=()=>new Promise((resolve,reject)=>reads.push({resolve:status=>resolve(workspace(status)),reject}))
 const C=compile('components/club-tasks.tsx',{react,'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[]},loading:false})},'@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},'@/hooks/use-revalidate':{useRevalidate(fn){reload=fn}},'@/lib/workspace-api':{getTaskWorkspace:read,viewTask:async()=>{}}}).ClubTasks
 return{reads,reload:()=>reload(),render(){index=0;const tree=C({clubId:'club',embedded:true,personalOnly:true,initialScope:'mine'});while(effects.length)effects.shift()();return tree}}
}
test('a failed background task reload keeps the list with a quiet note; only a failed first load blanks',async()=>{
 const h=reloadHarness();h.render();h.reads[0].resolve('first');await flush();let tree=h.render();assert.match(text(tree),/Research \(first\)/)
 h.reload();h.render();h.reads[1].reject(Error('offline'));await flush();tree=h.render()
 assert.match(text(tree),/Research \(first\)/,'current tasks stay visible');assert.match(text(tree),/Couldn’t update tasks/);assert.equal(nodes(tree).some(n=>n.props?.role==='alert'),false,'not a blocking error')
 button(tree,'Try again').props.onClick();h.render();h.reads[2].resolve('second');await flush();tree=h.render();assert.match(text(tree),/Research \(second\)/);assert.doesNotMatch(text(tree),/Couldn’t update tasks/)
 const blank=reloadHarness();blank.render();blank.reads[0].reject(Error('Could not load tasks.'));await flush();tree=blank.render();assert.ok(nodes(tree).some(n=>n.props?.role==='alert'));assert.doesNotMatch(text(tree),/Research/)
})
test('a background task reload that started before a write never overwrites the write\'s own fresh read',async()=>{
 const h=reloadHarness();h.render();h.reads[0].resolve('first');await flush();let tree=h.render()
 nodes(tree).find(n=>n.type==='button'&&text(n).includes('Research')).props.onClick({currentTarget:{}});tree=h.render()
 const run=nodes(tree).find(n=>n.type?.name==='TaskDetail').props.run
 h.reload();h.render()
 const saving=run(async()=>{});await flush();h.reads[2].resolve('saved');await saving;await flush()
 h.reads[1].resolve('older');await flush();tree=h.render()
 assert.match(text(tree),/Research \(saved\)/);assert.doesNotMatch(text(tree),/older/)
})

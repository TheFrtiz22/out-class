const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
function harness(canManageKit=false){
 const slots=[],effects=[],cleanups=[],timers=new Map(),calls=[];let index=0,timerId=0,fail=false,defer=null
 const record={id:'session',revision:0,completedAt:null,questions:[{id:'q1',prompt:'Snapshot question',guidance:'Listen carefully'}],draft:{questionNotes:[],additionalQuestions:[],overallReview:'',score:null}}
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=index++;return slots[i]??={current:initial}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}}
 const api={openInterviewSession:async()=>structuredClone(record),getInterviewKit:async()=>{calls.push(['library']);return{questions:[...record.questions,{id:'q2',prompt:'New kit question',guidance:'New guidance'}]}},saveInterviewSession:async input=>{calls.push(['save',structuredClone(input)]);if(defer)await defer;if(fail)throw Error('Revision changed. Retry before leaving.');record.draft=structuredClone(input.draft);record.revision++;if(input.complete)record.completedAt='2026-09-27';return{session:structuredClone(record),evaluation:input.complete?{id:'evaluation'}:null}}}
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync('components/interview-kit-session.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
 new Function('require','module','exports','setTimeout','clearTimeout',code)(name=>name==='react'?react:name==='@/lib/workspace-api'?api:name==='@/lib/interview-kits'?{emptyInterviewDraft:record.draft}:name.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):require(name),mod,mod.exports,fn=>{timers.set(++timerId,fn);return timerId},id=>timers.delete(id))
 const props={clubId:'club',applicationId:'app',roundId:'round',formRef:{current:null},onState(){},onComplete(...args){calls.push(['complete',...args])},canManageKit}
 return {calls,record,fail(value){fail=value},defer(value){defer=value},render(){index=0;const tree=mod.exports.InterviewKitSession(props);while(effects.length)effects.shift()();return tree},tick(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())}}
}
test('focused session opens closing review before completion and preserves failed draft for retry',async()=>{
 const h=harness();h.render();await flush();let tree=h.render()
 assert.match(text(tree),/Your private question notes/)
 button(tree,'End Interview').props.onClick();tree=h.render();assert.ok(button(tree,'Confirm completion'));assert.equal(h.calls.length,0)
 nodes(tree).find(n=>n.props?.id==='interview-score').props.onChange({target:{value:'8'}})
 tree=h.render();h.fail(true);button(tree,'Confirm completion').props.onClick();await flush();tree=h.render()
 assert.match(text(tree),/Revision changed/);assert.equal(h.calls.filter(c=>c[0]==='complete').length,0)
 h.fail(false);button(tree,'Confirm completion').props.onClick();await flush();tree=h.render()
 assert.ok(h.record.completedAt);assert.equal(h.record.draft.score,8);assert.equal(h.calls.filter(c=>c[0]==='complete').length,1);assert.equal(button(tree,'End Interview'),undefined)
})
test('snapshot library is available to reviewers; current kit fetching and additional prompts require kit permission',async()=>{
 const reviewer=harness();reviewer.render();await flush();let tree=reviewer.render();assert.equal(reviewer.calls.length,0);assert.ok(button(tree,'Go to question'))
 const manager=harness(true);manager.render();await flush();tree=manager.render();assert.deepEqual(manager.calls,[['library']]);button(tree,'Add to Interview').props.onClick();tree=manager.render();assert.match(text(tree),/Off-script/)
 button(tree,'Save draft').props.onClick();await flush();assert.equal(manager.record.questions.length,1);assert.equal(manager.record.draft.additionalQuestions[0].question,'New kit question')
})
test('edits during an in-flight autosave are subsequently saved using the new revision',async()=>{
 const h=harness();h.render();await flush();let tree=h.render()
 const edit=value=>nodes(tree).find(n=>n.props?.id==='active-notes-q1').props.onChange({target:{value}})
 let release;h.defer(new Promise(resolve=>release=resolve));edit('First');tree=h.render();h.tick();tree=h.render();edit('Latest');tree=h.render();h.tick();release();await flush();h.defer(null);tree=h.render();h.tick();await flush();h.render()
 assert.equal(h.record.draft.questionNotes[0].notes,'Latest');assert.deepEqual(h.calls.filter(c=>c[0]==='save').map(c=>c[1].revision),[0,1])
})

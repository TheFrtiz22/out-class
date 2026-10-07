const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(r=>setImmediate(r));
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function harness(){
 const slots=[],effects=[],cleanups=[],storage=new Map();let index=0,calls=0,denied=false;
 const rows=['a','b','c'].map(id=>({id,name:id.toUpperCase(),roundId:'r',assignedRoundIds:['r'],completedRoundIds:[]}));
 let pipeline={rounds:[{id:'r',name:'Round 1',archived:false}],applications:rows};
 const depsChanged=(a,b)=>!a||b.some((v,i)=>v!==a[i]);
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x]},useRef(v){const i=index++;return slots[i]??={current:v}},useCallback(fn,deps){const i=index++;if(!slots[i]||depsChanged(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},useEffect(fn,deps){const i=index++;if(depsChanged(slots[i],deps)){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const queue=require('./helpers/demo-harness.cjs').harness().load('lib/interview-queue.ts');
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('components/views/interview-workspace-view.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const clear=()=>{};
 new Function('require','module','exports','window','sessionStorage','requestAnimationFrame',code+';exports.TestSession=InterviewSession;')(n=>n==='react'?react:n.endsWith('.css')?{}:n==='@/lib/workspace-api'?{getInterviewWorkspace:async()=>{calls++;if(denied)throw Error('revoked');return structuredClone(pipeline)}}:n==='@/lib/interview-queue'?queue:n==='@/lib/application-state'?{useApplicationState:()=>({leaderFocus:null,clearLeaderFocus:clear})}:n.startsWith('@/')?new Proxy({},{get:(_,k)=>k}):require(n),mod,mod.exports,{addEventListener(){},removeEventListener(){},confirm:()=>true},{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fn=>fn());
 const props={membership:{id:'member',clubId:'club',club:{name:'MII'}},onLock(){},onExit(){}};
 return{storage,calls:()=>calls,deny:()=>denied=true,fresh:p=>pipeline=p,rows,render(){index=0;const t=mod.exports.TestSession(props);while(effects.length)effects.shift()();return t}};
}
const kit=t=>nodes(t).find(n=>n.type==='InterviewKitSession');
test('selection controls exist only on the interview list; active and post-interview room has no strip or candidate navigation',async()=>{
 const h=harness();h.render();await flush();let t=h.render();t=h.render();
 assert.ok(nodes(t).find(n=>n.props?.id==='interview-round'));
 nodes(t).find(n=>n.props?.id==='interview-candidate').props.onChange({target:{value:'a'}});t=h.render();
 assert.equal(nodes(t).find(n=>n.type==='select'),undefined);assert.equal(kit(t).props.applicationId,'a');
 assert.doesNotMatch(text(t),/evaluated by you|Previous candidate|Next candidate/);
 const toolbar=kit(t).props.toolbar(false);assert.match(text(toolbar),/InterviewsMII/);assert.doesNotMatch(text(toolbar),/timer/i);
 assert.equal(text(kit(t).props.toolbar(true)),text(toolbar));
 nodes(toolbar).find(n=>n.type==='Button').props.onClick();t=h.render();assert.ok(nodes(t).find(n=>n.props?.id==='interview-round'));assert.equal(h.storage.size,0);
});
test('next applicant refreshes assignments, skips completed/revoked rows and changes the keyed session together',async()=>{
 const h=harness();h.render();await flush();let t=h.render();t=h.render();nodes(t).find(n=>n.props?.id==='interview-candidate').props.onChange({target:{value:'a'}});t=h.render();
 const old=kit(t);old.props.onComplete();t=h.render();t=h.render();assert.equal(kit(t).props.applicationId,'a');
 h.fresh({rounds:[{id:'r',name:'Round 1',archived:false}],applications:[{...h.rows[0],completedRoundIds:['r']},{...h.rows[1],assignedRoundIds:[]},h.rows[2]]});
 assert.equal(await kit(t).props.onNextApplicant(),true);t=h.render();t=h.render();assert.equal(kit(t).props.applicationId,'c');assert.notEqual(kit(t).key,old.key);assert.equal(h.calls(),2);
 h.deny();await assert.rejects(kit(t).props.onNextApplicant(),/revoked/);assert.equal(kit(h.render()).props.applicationId,'c');
});

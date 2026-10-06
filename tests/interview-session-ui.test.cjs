const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
const text=n=>typeof n==='number'?String(n):typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
function harness(existing){
 const slots=[],effects=[],cleanups=[],timers=new Map(),calls=[];let index=0,timerId=0,fail=false,defer=null,lost=false
 const record=existing || {id:'session',revision:0,completedAt:null,questions:[{id:'q1',prompt:'Snapshot question',guidance:'Listen carefully'}],draft:{questionNotes:[],additionalQuestions:[],overallReview:'',additionalNotes:'',applicantQuestions:'',completedQuestionIds:[],score:null}}
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=index++;return slots[i]??={current:initial}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}}
 const api={getPreviousInterviewScores:async()=>[],openInterviewSession:async()=>structuredClone(record),getInterviewKit:async()=>{calls.push(['library']);return{questions:[...record.questions,{id:'q2',prompt:'New kit question',guidance:'New guidance'}]}},saveInterviewSession:async input=>{calls.push(['save',structuredClone(input)]);if(defer)await defer;if(fail)throw Error('Revision changed. Retry before leaving.');if(record.completedAt){if(!input.complete||input.revision!==record.revision-1||JSON.stringify(input.draft)!==JSON.stringify(record.draft))throw Error('Interview already completed.');return{session:structuredClone(record),evaluation:{id:'evaluation'}};}record.draft=structuredClone(input.draft);record.revision++;if(input.complete)record.completedAt='2026-09-27';if(lost){lost=false;throw Error('Response interrupted after commit');}return{session:structuredClone(record),evaluation:input.complete?{id:'evaluation'}:null}}}
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync('components/interview-kit-session.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
 new Function('require','module','exports','setTimeout','clearTimeout',code)(name=>name==='react'?react:name==='@/lib/workspace-api'?api:name==='@/lib/interview-kits'?{emptyInterviewDraft:record.draft}:name.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):require(name),mod,mod.exports,fn=>{timers.set(++timerId,fn);return timerId},id=>timers.delete(id))
 const props={clubId:'club',applicationId:'app',roundId:'round',formRef:{current:null},onState(){},onComplete(...args){calls.push(['complete',...args])}}
 return {calls,record,fail(value){fail=value},loseResponse(){lost=true},defer(value){defer=value},render(){index=0;const tree=mod.exports.InterviewKitSession(props);while(effects.length)effects.shift()();return tree},tick(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())}}
}
const select=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&text(n).startsWith(label)).props.onClick()
const edit=(tree,value)=>nodes(tree).find(n=>n.props?.id==='active-notes-q1').props.onChange({target:{value}})
test('completion requires acknowledged Save and close; failed text stays open with retry',async()=>{
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');t=h.render();edit(t,'Private answer');t=h.render()
 assert.deepEqual(h.record.draft.completedQuestionIds,[])
 h.fail(true);button(t,'Save and close').props.onClick();await flush();t=h.render()
 assert.match(text(t),/Your interview could not be saved/);assert.doesNotMatch(text(t),/Revision changed/);assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Private answer');assert.deepEqual(h.record.draft.completedQuestionIds,[])
 h.fail(false);button(t,'Save and close').props.onClick();await flush();t=h.render()
 assert.deepEqual(h.record.draft.completedQuestionIds,['q1']);assert.equal(h.record.draft.questionNotes[0].notes,'Private answer');assert.match(text(t),/Question saved and moved/);assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1'),undefined)
 select(t,'Snapshot question');t=h.render();edit(t,'Revised private answer');t=h.render();button(t,'Save and close').props.onClick();await flush();assert.equal(h.record.draft.questionNotes[0].notes,'Revised private answer')
})
test('two interviewer UIs remain independent and reload restores only acknowledged personal completion',async()=>{
 const a=harness(),b=harness();a.render();b.render();await flush();let t=a.render();select(t,'Snapshot question');t=a.render();edit(t,'Only A');t=a.render();button(t,'Save and close').props.onClick();await flush();a.render()
 assert.deepEqual(b.record.draft.completedQuestionIds,[]);assert.doesNotMatch(text(b.render()),/Only A/)
 const reload=harness(structuredClone(a.record));reload.render();await flush();t=reload.render();assert.match(text(t),/Completed questions · 1/);select(t,'Snapshot question');t=reload.render();assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Only A')
})
test('assigned interviewer browses current bank without editing; session wording and stable IDs survive kit changes',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'Question bank').props.onClick();h.render();await flush();t=h.render();assert.deepEqual(h.calls,[['library']]);assert.equal(button(t,'Save kit'),undefined)
 button(t,'Use question').props.onClick();t=h.render();assert.match(text(t),/Off-script/);button(t,'Save and close').props.onClick();await flush();t=h.render();assert.equal(h.record.questions[0].prompt,'Snapshot question');assert.equal(h.record.draft.additionalQuestions[0].id,'q2');assert.deepEqual(h.record.draft.completedQuestionIds,['q2'])
})
test('off-script questions persist independently of opening and typing',async()=>{
 const h=harness();h.render();await flush();let t=h.render();nodes(t).find(n=>n.props?.id==='new-interview-question').props.onChange({target:{value:'Follow-up'}});t=h.render();button(t,'Add question').props.onClick();t=h.render();button(t,'Save draft').props.onClick();await flush();t=h.render();assert.equal(h.record.draft.additionalQuestions[0].question,'Follow-up');assert.deepEqual(h.record.draft.completedQuestionIds,[])
 button(t,'Save and close').props.onClick();await flush();assert.equal(h.record.draft.completedQuestionIds[0],h.record.draft.additionalQuestions[0].id)
})
test('End interview opens a nullable-score draft, and explicit half-point slider selection enables final submission',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End interview').props.onClick();t=h.render();await flush();assert.ok(button(t,'Save and finish').props.disabled);assert.equal(h.record.draft.score,null);assert.equal(h.record.completedAt,null)
 nodes(t).find(n=>n.props?.type==='range').props.onChange({currentTarget:{value:'8.5'}});t=h.render();button(t,'Save and finish').props.onClick();await flush();t=h.render();assert.equal(h.record.draft.score,8.5);assert.ok(h.record.completedAt);assert.equal(button(t,'End interview'),undefined)
})
test('edits during an in-flight autosave use the acknowledged next revision',async()=>{
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');t=h.render();let release;h.defer(new Promise(resolve=>release=resolve));edit(t,'First');t=h.render();h.tick();t=h.render();edit(t,'Latest');t=h.render();h.tick();release();await flush();h.defer(null);t=h.render();h.tick();await flush();h.render()
 assert.equal(h.record.draft.questionNotes[0].notes,'Latest');assert.deepEqual(h.calls.filter(c=>c[0]==='save').map(c=>c[1].revision),[0,1])
})
const scoreInput=t=>nodes(t).find(n=>n.props?.type==='range');
test('discussion has no score or submission; pointer and touch select unchanged lower endpoint and exact upper endpoint',async()=>{
 for(const [event,value] of [['pointer','1'],['touch','10']]){
  const h=harness();h.render();await flush();let t=h.render();button(t,'End interview').props.onClick();t=h.render();await flush();t=h.render();
  assert.match(text(t),/Not scored/);assert.equal(scoreInput(t).props.value,1);assert.equal(h.calls.filter(c=>c[0]==='save').length,0);
  scoreInput(t).props.onPointerUp({pointerType:event,currentTarget:{value}});t=h.render();assert.equal(button(t,'Save and finish').props.disabled,false);button(t,'Save and finish').props.onClick();await flush();t=h.render();assert.equal(h.record.draft.score,Number(value));assert.equal(scoreInput(t),undefined);
 }
});
test('keyboard focus alone is unscored; Home, End and half-step arrow interactions explicitly score',async()=>{
 for(const [key,value] of [['Home','1'],['End','10'],['ArrowRight','1.5']]){
  const h=harness();h.render();await flush();let t=h.render();button(t,'End interview').props.onClick();t=h.render();scoreInput(t).props.onKeyDown({key:'Tab',preventDefault(){throw Error('Tab must retain native focus navigation')}});t=h.render();assert.ok(button(t,'Save and finish').props.disabled);
  let prevented=false;scoreInput(t).props.onKeyDown({key,currentTarget:{value:'1'},preventDefault(){prevented=true}});t=h.render();assert.equal(prevented,true);assert.equal(scoreInput(t).props['aria-valuetext'],`${value} out of 10`);
 }
});
test('keyboard scoring clamps endpoints and steps from current draft despite a stale native input value',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End interview').props.onClick();t=h.render();
 for(const [key,value] of [['ArrowLeft',1],['ArrowRight',1.5],['End',10],['ArrowUp',10],['ArrowLeft',9.5],['ArrowDown',9],['PageDown',8],['PageUp',9],['Home',1],['ArrowDown',1]]){
  let prevented=false;scoreInput(t).props.onKeyDown({key,currentTarget:{value:'10'},preventDefault(){prevented=true}});t=h.render();assert.equal(prevented,true);assert.equal(scoreInput(t).props.value,value);
 }
 scoreInput(t).props.onKeyDown({key:'ArrowRight',ctrlKey:true,preventDefault(){throw Error('Browser shortcut must remain native')}});t=h.render();assert.equal(scoreInput(t).props.value,1);assert.equal(h.record.completedAt,null);
});
test('finish flushes latest text after autosave and double clicks create one final request',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End interview').props.onClick();t=h.render();nodes(t).find(n=>n.props?.id==='additional-interview-notes').props.onChange({target:{value:'Discussion draft'}});t=h.render();h.tick();await flush();t=h.render();
 nodes(t).find(n=>n.props?.id==='additional-interview-notes').props.onChange({target:{value:'Latest consensus, own assessment'}});t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'7.5'}});t=h.render();let release;h.defer(new Promise(resolve=>release=resolve));const finish=button(t,'Save and finish');finish.props.onClick();finish.props.onClick();t=h.render();assert.ok(button(t,'Save and finish').props.disabled);h.tick();release();await flush();
 assert.equal(h.record.draft.additionalNotes,'Latest consensus, own assessment');assert.equal(h.calls.filter(c=>c[0]==='save'&&c[1].complete).length,1);assert.equal(h.record.draft.score,7.5);
});
test('failed finish retains closing text and exposes explicit final retry',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End interview').props.onClick();t=h.render();nodes(t).find(n=>n.props?.id==='applicant-questions').props.onChange({target:{value:'What happens next?'}});t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'8.5'}});t=h.render();h.fail(true);button(t,'Save and finish').props.onClick();await flush();t=h.render();assert.equal(nodes(t).find(n=>n.props?.id==='applicant-questions').props.value,'What happens next?');assert.equal(h.record.completedAt,null);
 h.fail(false);button(t,'Retry save and finish').props.onClick();await flush();assert.equal(h.record.draft.applicantQuestions,'What happens next?');assert.ok(h.record.completedAt);
});
test('lost successful response retries the identical final revision and locks without duplicate completion',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End interview').props.onClick();t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'10'}});t=h.render();h.loseResponse();button(t,'Save and finish').props.onClick();await flush();t=h.render();assert.match(text(t),/Your interview could not be saved/);assert.doesNotMatch(text(t),/Response interrupted/);assert.equal(h.record.revision,1);assert.ok(h.record.completedAt);button(t,'Retry save and finish').props.onClick();await flush();t=h.render();assert.equal(h.record.revision,1);assert.equal(button(t,'Save and finish'),undefined);assert.equal(h.calls.filter(c=>c[0]==='complete').length,1);assert.deepEqual(h.calls.filter(c=>c[0]==='save').map(c=>c[1].revision),[0,0]);
});

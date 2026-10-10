const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
const text=n=>typeof n==='number'?String(n):typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
function harness(existing, overrides = {}){
 const slots=[],effects=[],cleanups=[],timers=new Map(),calls=[];let index=0,timerId=0,fail=false,defer=null,lost=false
 const record=existing || {id:'session',revision:0,completedAt:null,questions:[{id:'q1',prompt:'Snapshot question',guidance:'Listen carefully'}],draft:{questionNotes:[],additionalQuestions:[],overallReview:'',additionalNotes:'',applicantQuestions:'',completedQuestionIds:[],score:null}}
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=index++;return slots[i]??={current:initial}},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}}
 react.useLayoutEffect=react.useEffect
 const api={getPreviousInterviewScores:async()=>[],openInterviewSession:async()=>structuredClone(record),getInterviewKit:async()=>{calls.push(['library']);return{questions:[...record.questions,{id:'q2',prompt:'New kit question',guidance:'New guidance'}]}},saveInterviewSession:async input=>{calls.push(['save',structuredClone(input)]);if(defer)await defer;if(fail)throw Error('Revision changed. Retry before leaving.');if(record.completedAt){if(!input.complete||input.revision!==record.revision-1||JSON.stringify(input.draft)!==JSON.stringify(record.draft))throw Error('Interview already completed.');return{session:structuredClone(record),evaluation:{id:'evaluation'}};}record.draft=structuredClone(input.draft);record.revision++;if(input.complete)record.completedAt='2026-09-27';if(lost){lost=false;throw Error('Response interrupted after commit');}return{session:structuredClone(record),evaluation:input.complete?{id:'evaluation'}:null}}}
 const mod={exports:{}}
 let sharedView=null;const collab={clientId:'tab',get view(){return sharedView},error:'',refresh:async()=>{},dismiss:async()=>{},select:async id=>({revision:1,question:[...record.questions,{id:'q2',prompt:'New kit question',guidance:'New guidance'}].find(q=>q.id===id)})};
 const code=ts.transpileModule(fs.readFileSync('components/interview-kit-session.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
 const motion={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/interview-question-motion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(motion,motion.exports)
 new Function('require','module','exports','setTimeout','clearTimeout',code)(name=>name==='react'?react:name==='@/hooks/use-interview-workspace'?{useInterviewWorkspace:()=>collab}:name==='@/lib/demo/interview-collaboration'?{}:name==='@/lib/interview-question-motion'?motion.exports:name==='@/lib/workspace-api'?api:name==='@/lib/interview-kits'?{emptyInterviewDraft:{questionNotes:[],additionalQuestions:[],overallReview:'',score:null}}:name.startsWith('@/components/')?new Proxy({},{get:(_,key)=>key}):require(name),mod,mod.exports,fn=>{timers.set(++timerId,fn);return timerId},id=>timers.delete(id))
 const props={clubId:'club',applicationId:'app',roundId:'round',formRef:{current:null},onState(){},onComplete(...args){calls.push(['complete',...args])}, ...overrides}
 return {calls,record,shared(value){sharedView=value},fail(value){fail=value},loseResponse(){lost=true},defer(value){defer=value},render(){index=0;const tree=mod.exports.InterviewKitSession(props);while(effects.length)effects.shift()();return tree},tick(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())}}
}
const select=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&(text(n).startsWith(label)||nodes(n).some(c=>c.props?.className==='oc-completed-prompt'&&text(c).startsWith(label)))).props.onClick()
const edit=(tree,value)=>nodes(tree).find(n=>n.props?.id==='active-notes-q1').props.onChange({target:{value}})
test('incoming shared changes preserve typing and composition, wait for explicit opening, and never change closing phase',async()=>{
 const priorDocument=global.document;global.document={activeElement:null};
 try{
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');await flush();t=h.render();edit(t,'Still typing privately');t=h.render();
 h.shared({sessionId:'room',revision:2,participants:[],invitation:null,selection:{question:{id:'q2',prompt:'Other shared question',guidance:'Shared key'},by:'Peer',memberId:'peer'}});h.render();t=h.render();
 assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Still typing privately');assert.ok(button(t,'Open question'));
 nodes(t).find(n=>n.type==='form').props.onCompositionStart();button(t,'Open question').props.onClick();await flush();t=h.render();assert.ok(nodes(t).find(n=>n.props?.id==='active-notes-q1'));
 nodes(t).find(n=>n.type==='form').props.onCompositionEnd();button(t,'Open question').props.onClick();await flush();t=h.render();assert.equal(h.record.draft.questionNotes[0].notes,'Still typing privately');assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q2').props.value,'');assert.equal(h.record.draft.completedQuestionIds.length,0);
 button(t,'End current interview').props.onClick();await flush();t=h.render();h.shared({sessionId:'room',revision:3,participants:[],invitation:null,selection:{question:{id:'q1',prompt:'Snapshot question',guidance:''},by:'Peer',memberId:'peer'}});h.render();t=h.render();assert.ok(nodes(t).find(n=>n.props?.['aria-label']==='Post-interview'));assert.equal(h.record.draft.score,null);
 }finally{global.document=priorDocument;}
});
test('Proceed never submits an unfinished review and Stay here leaves private content and phase untouched',async()=>{
 const h=harness();h.render();await flush();h.shared({sessionId:'room',revision:0,participants:[],selection:null,invitation:{id:'invite',sender:'Peer',candidate:'Destination'}});let t=h.render();t=h.render();
 button(t,'Proceed').props.onClick();await flush();t=h.render();assert.match(text(t),/Finish your current review before joining/);assert.equal(h.calls.filter(c=>c[0]==='save').length,0);assert.equal(h.record.draft.score,null);assert.equal(h.record.draft.postInterview,undefined);button(t,'Stay here').props.onClick();await flush();assert.equal(h.record.completedAt,null);
});
test('fresh and legacy drafts stay in interview until explicit ending; saved phase belongs only to that personal record',async()=>{
 const h=harness();h.record.draft.score=8.5;h.record.draft.applicantQuestions='Legacy discussion';h.record.draft.additionalNotes='Keep legitimate notes';h.render();await flush();let t=h.render();
 assert.ok(button(t,'End current interview'));assert.equal(scoreInput(t),undefined);assert.equal(nodes(t).find(n=>n.props?.id==='applicant-questions'),undefined);assert.doesNotMatch(text(t),/Your previous five/);assert.equal(button(t,'Next candidate →'),undefined);
 const before=harness(structuredClone(h.record));before.render();await flush();assert.ok(button(before.render(),'End current interview'));
 button(t,'End current interview').props.onClick();await flush();t=h.render();assert.equal(h.record.draft.postInterview,true);assert.equal(h.record.completedAt,null);
 const resumed=harness(structuredClone(h.record));resumed.render();await flush();t=resumed.render();assert.ok(scoreInput(t));assert.equal(nodes(t).find(n=>n.props?.id==='applicant-questions').props.value,'Legacy discussion');
 const fresh=harness();fresh.render();await flush();assert.ok(button(fresh.render(),'End current interview'));assert.equal(fresh.record.draft.score,null);assert.equal(scoreInput(fresh.render()),undefined);
 const prepared=harness(structuredClone(h.record),{initialSession:structuredClone(h.record)});t=prepared.render();assert.ok(scoreInput(t));assert.equal(nodes(t).find(n=>n.props?.id==='additional-interview-notes').props.value,'Keep legitimate notes');
});
test('completion requires acknowledged Save and close; failed text stays open with retry',async()=>{
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');await flush();t=h.render();edit(t,'Private answer');t=h.render()
 assert.deepEqual(h.record.draft.completedQuestionIds,[])
 h.fail(true);button(t,'Save & close').props.onClick();await flush();t=h.render()
 assert.match(text(t),/Your interview could not be saved/);assert.doesNotMatch(text(t),/Revision changed/);assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Private answer');assert.deepEqual(h.record.draft.completedQuestionIds,[])
 h.fail(false);button(t,'Save & close').props.onClick();await flush();t=h.render()
 assert.deepEqual(h.record.draft.completedQuestionIds,['q1']);assert.equal(h.record.draft.questionNotes[0].notes,'Private answer');assert.match(text(t),/Question saved and moved/);assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1'),undefined)
 select(t,'Snapshot question');await flush();t=h.render();button(t,'Reopen question').props.onClick();t=h.render();edit(t,'Revised private answer');t=h.render();button(t,'Save & close').props.onClick();await flush();assert.equal(h.record.draft.questionNotes[0].notes,'Revised private answer')
})
test('two interviewer UIs remain independent and reload restores only acknowledged personal completion',async()=>{
 const a=harness(),b=harness();a.render();b.render();await flush();let t=a.render();select(t,'Snapshot question');await flush();t=a.render();edit(t,'Only A');t=a.render();button(t,'Save & close').props.onClick();await flush();a.render()
 assert.deepEqual(b.record.draft.completedQuestionIds,[]);assert.doesNotMatch(text(b.render()),/Only A/)
 const reload=harness(structuredClone(a.record));reload.render();await flush();t=reload.render();assert.match(text(t),/Completed questions\s+1/);select(t,'Snapshot question');await flush();t=reload.render();assert.equal(nodes(t).find(n=>n.props?.id==='review-notes-q1').props.value,'Only A')
})
test('assigned interviewer browses current bank without editing; session wording and stable IDs survive kit changes',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'Question bank').props.onClick();h.render();await flush();t=h.render();assert.deepEqual(h.calls,[['library']]);assert.equal(button(t,'Save kit'),undefined)
 button(t,'Use question').props.onClick();await flush();t=h.render();assert.match(text(t),/Club answer key/);assert.doesNotMatch(text(t),/Off-script<|Off-script$/);button(t,'Save & close').props.onClick();await flush();t=h.render();assert.equal(h.record.questions[0].prompt,'Snapshot question');assert.equal(h.record.draft.additionalQuestions[0].id,'q2');assert.deepEqual(h.record.draft.completedQuestionIds,['q2'])
})
test('off-script questions persist independently of opening and typing',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'+ Off-script question').props.onClick();t=h.render();nodes(t).find(n=>n.props?.id==='new-interview-question').props.onChange({target:{value:'Follow-up'}});t=h.render();button(t,'Add question').props.onClick();t=h.render();h.tick();await flush();t=h.render();assert.equal(h.record.draft.additionalQuestions[0].question,'Follow-up');assert.deepEqual(h.record.draft.completedQuestionIds,[])
 button(t,'Save & close').props.onClick();await flush();assert.equal(h.record.draft.completedQuestionIds[0],h.record.draft.additionalQuestions[0].id)
})
test('End interview opens a nullable-score draft, and explicit half-point slider selection enables final submission',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();await flush();assert.ok(button(t,'End post-interview').props.disabled);assert.equal(h.record.draft.score,null);assert.equal(h.record.completedAt,null)
 nodes(t).find(n=>n.props?.type==='range').props.onChange({currentTarget:{value:'8.5'}});t=h.render();button(t,'End post-interview').props.onClick();await flush();t=h.render();assert.equal(h.record.draft.score,8.5);assert.ok(h.record.completedAt);assert.equal(button(t,'End current interview'),undefined)
})
test('edits during an in-flight autosave use the acknowledged next revision',async()=>{
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');await flush();t=h.render();let release;h.defer(new Promise(resolve=>release=resolve));edit(t,'First');t=h.render();h.tick();t=h.render();edit(t,'Latest');t=h.render();h.tick();release();await flush();h.defer(null);t=h.render();h.tick();await flush();h.render()
 assert.equal(h.record.draft.questionNotes[0].notes,'Latest');assert.deepEqual(h.calls.filter(c=>c[0]==='save').map(c=>c[1].revision),[0,1])
})
const scoreInput=t=>nodes(t).find(n=>n.props?.type==='range');
test('repeated Save & close clicks issue one acknowledged completion and retain private text on failure',async()=>{
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');await flush();t=h.render();edit(t,'Latest personal text');t=h.render();let release;h.defer(new Promise(r=>release=r));
 const save=button(t,'Save & close');save.props.onClick();save.props.onClick();h.fail(true);release();await flush();t=h.render();assert.equal(h.calls.filter(c=>c[0]==='save').length,1);assert.deepEqual(h.record.draft.completedQuestionIds,[]);assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Latest personal text');
 h.fail(false);h.defer(null);button(t,'Save & close').props.onClick();await flush();t=h.render();assert.deepEqual(h.record.draft.completedQuestionIds,['q1']);assert.equal(h.record.draft.questionNotes[0].notes,'Latest personal text');assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1'),undefined);
});
test('discussion has no score or submission; pointer and touch select unchanged lower endpoint and exact upper endpoint',async()=>{
 for(const [event,value] of [['pointer','1'],['touch','10']]){
  const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();await flush();t=h.render();
  assert.match(text(t),/Not scored/);assert.equal(scoreInput(t).props.value,1);assert.equal(h.calls.filter(c=>c[0]==='save'&&c[1].complete).length,0);
  scoreInput(t).props.onPointerUp({pointerType:event,currentTarget:{value}});t=h.render();assert.equal(button(t,'End post-interview').props.disabled,false);button(t,'End post-interview').props.onClick();await flush();t=h.render();assert.equal(h.record.draft.score,Number(value));assert.equal(scoreInput(t),undefined);
 }
});
test('keyboard focus alone is unscored; Home, End and half-step arrow interactions explicitly score',async()=>{
 for(const [key,value] of [['Home','1'],['End','10'],['ArrowRight','1.5']]){
  const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();scoreInput(t).props.onKeyDown({key:'Tab',preventDefault(){throw Error('Tab must retain native focus navigation')}});t=h.render();assert.ok(button(t,'End post-interview').props.disabled);
  let prevented=false;scoreInput(t).props.onKeyDown({key,currentTarget:{value:'1'},preventDefault(){prevented=true}});t=h.render();assert.equal(prevented,true);assert.equal(scoreInput(t).props['aria-valuetext'],`${value} out of 10`);
 }
});
test('keyboard scoring clamps endpoints and steps from current draft despite a stale native input value',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();
 for(const [key,value] of [['ArrowLeft',1],['ArrowRight',1.5],['End',10],['ArrowUp',10],['ArrowLeft',9.5],['ArrowDown',9],['PageDown',8],['PageUp',9],['Home',1],['ArrowDown',1]]){
  let prevented=false;scoreInput(t).props.onKeyDown({key,currentTarget:{value:'10'},preventDefault(){prevented=true}});t=h.render();assert.equal(prevented,true);assert.equal(scoreInput(t).props.value,value);
 }
 scoreInput(t).props.onKeyDown({key:'ArrowRight',ctrlKey:true,preventDefault(){throw Error('Browser shortcut must remain native')}});t=h.render();assert.equal(scoreInput(t).props.value,1);assert.equal(h.record.completedAt,null);
});
test('finish flushes latest text after autosave and double clicks create one final request',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();nodes(t).find(n=>n.props?.id==='additional-interview-notes').props.onChange({target:{value:'Discussion draft'}});t=h.render();h.tick();await flush();t=h.render();
 nodes(t).find(n=>n.props?.id==='additional-interview-notes').props.onChange({target:{value:'Latest consensus, own assessment'}});t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'7.5'}});t=h.render();let release;h.defer(new Promise(resolve=>release=resolve));const finish=button(t,'End post-interview');finish.props.onClick();finish.props.onClick();t=h.render();assert.ok(button(t,'Submitting…').props.disabled);h.tick();release();await flush();
 assert.equal(h.record.draft.additionalNotes,'Latest consensus, own assessment');assert.equal(h.calls.filter(c=>c[0]==='save'&&c[1].complete).length,1);assert.equal(h.record.draft.score,7.5);
});
test('failed finish retains closing text and exposes explicit final retry',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();nodes(t).find(n=>n.props?.id==='applicant-questions').props.onChange({target:{value:'What happens next?'}});t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'8.5'}});t=h.render();h.fail(true);button(t,'End post-interview').props.onClick();await flush();t=h.render();assert.equal(nodes(t).find(n=>n.props?.id==='applicant-questions').props.value,'What happens next?');assert.equal(h.record.completedAt,null);
 h.fail(false);button(t,'Retry end post-interview').props.onClick();await flush();assert.equal(h.record.draft.applicantQuestions,'What happens next?');assert.ok(h.record.completedAt);
});
test('lost successful response retries the identical final revision and locks without duplicate completion',async()=>{
 const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'10'}});t=h.render();h.loseResponse();button(t,'End post-interview').props.onClick();await flush();t=h.render();assert.match(text(t),/Your interview could not be saved/);assert.doesNotMatch(text(t),/Response interrupted/);assert.equal(h.record.revision,2);assert.ok(h.record.completedAt);button(t,'Retry end post-interview').props.onClick();await flush();t=h.render();assert.equal(h.record.revision,2);assert.equal(button(t,'End post-interview'),undefined);assert.equal(h.calls.filter(c=>c[0]==='complete').length,1);assert.deepEqual(h.calls.filter(c=>c[0]==='save'&&c[1].complete).map(c=>c[1].revision),[1,1]);
});


test('post-interview replaces only the middle, keeps side nodes and notes, and restores its saved screen on reload', async () => {
 const context = {type:'ApplicantPanel',props:{children:'Applicant · Scholar · Résumé'}};
 const h = harness(undefined, {context}); h.render(); await flush(); let t = h.render();
 select(t,'Snapshot question'); await flush(); t=h.render(); edit(t,'Keep my question draft'); t=h.render();
 const side = nodes(t).find(n=>n.props?.id==='interview-completed');
 button(t,'End current interview').props.onClick(); await flush(); t=h.render();
 assert.ok(nodes(t).includes(context)); assert.equal(nodes(t).find(n=>n.props?.id==='interview-completed').type,side.type);assert.equal(nodes(t).find(n=>n.props?.id==='additional-interview-notes').props.value,'');assert.match(text(nodes(t).find(n=>n.props?.id==='interview-completed')),/Used · Not marked complete/);
 assert.equal(nodes(t).some(n=>n.props?.['aria-label']==='Available questions'),false);
 assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1'),undefined);
 nodes(t).find(n=>n.props?.id==='applicant-questions').props.onChange({target:{value:'Can I join a project?'}}); t=h.render();
 h.tick();await flush();t=h.render();assert.equal(h.record.draft.postInterview,true);assert.equal(h.record.draft.score,null);
 const reload=harness(structuredClone(h.record),{context});reload.render();await flush();t=reload.render();assert.ok(button(t,'End post-interview').props.disabled);assert.equal(nodes(t).find(n=>n.props?.id==='applicant-questions').props.value,'Can I join a project?');
 button(t,'Keep interviewing').props.onClick();t=reload.render();assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1'),undefined);select(t,'Snapshot question');await flush();t=reload.render();assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Keep my question draft');
});

test('completion stays locked, next failures retry without duplicate requests, and empty queue is explicit', async () => {
 let attempts=0, fail=true, release;
 const h=harness(undefined,{onNextApplicant:async()=>{attempts++;if(fail)throw Error('access');await new Promise(r=>release=r);return false;},onReturnToList(){}});
 h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'6.5'}});t=h.render();
 button(t,'End post-interview').props.onClick();await flush();t=h.render();assert.match(text(t),/Interview complete/);assert.equal(scoreInput(t),undefined);assert.equal(nodes(t).find(n=>n.type==='fieldset').props.disabled,true);
 button(t,'Next candidate →').props.onClick();await flush();t=h.render();assert.match(text(t),/Could not load the next applicant/);assert.ok(h.record.completedAt);
 fail=false;const next=button(t,'Next candidate →');next.props.onClick();next.props.onClick();t=h.render();assert.ok(button(t,'Loading next candidate…').props.disabled);release();await flush();t=h.render();
 assert.equal(attempts,2);assert.match(text(t),/No more applicants/);assert.ok(button(t,'Return to interview list'));assert.equal(h.calls.filter(c=>c[0]==='complete').length,1);
});

test('bank browsing keeps unsaved personal notes and does not mark completion; autosave is the only routine save', async () => {
 const h=harness();h.render();await flush();let t=h.render();
 assert.equal(button(t,'Save draft'),undefined);assert.equal(nodes(t).find(n=>n.props?.id==='new-interview-question'),undefined);
 select(t,'Snapshot question');await flush();t=h.render();edit(t,'Retained while browsing');t=h.render();
 button(t,'Question bank').props.onClick();h.render();await flush();t=h.render();
 assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Retained while browsing');
 assert.deepEqual(h.record.draft.completedQuestionIds,[]);
 button(t,'Back to question bank').props.onClick();t=h.render();select(t,'Snapshot question');await flush();t=h.render();
 assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Retained while browsing');
 h.tick();await flush();t=h.render();assert.equal(h.record.draft.questionNotes[0].notes,'Retained while browsing');
 assert.deepEqual(h.record.draft.completedQuestionIds,[]);assert.match(text(t),/All changes saved/);
 button(t,'Save & close').props.onClick();await flush();t=h.render();
 assert.equal(text(nodes(t).find(n=>n.props?.className==='oc-note-preview')),'Retained while browsing');
});

test('one header save indicator shows pending, failure and acknowledged retry without clearing notes', async () => {
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');await flush();t=h.render();edit(t,'Keep this');t=h.render();
 const header=()=>nodes(t).find(n=>n.type==='header');assert.match(text(header()),/Saving…/);
 h.fail(true);h.tick();await flush();t=h.render();assert.match(text(header()),/Couldn’t save/);
 assert.equal(nodes(t).find(n=>n.props?.id==='active-notes-q1').props.value,'Keep this');
 h.fail(false);button(t,'Retry').props.onClick();await flush();t=h.render();assert.match(text(header()),/All changes saved/);
 assert.deepEqual(h.record.draft.completedQuestionIds,[]);
});

test('miscellaneous notes occupy one persistent right-panel slot; used questions keep keys without false completion', async () => {
 const h=harness();h.render();await flush();let t=h.render();
 const right=()=>nodes(t).find(n=>n.props?.id==='interview-completed');
 const field=()=>nodes(t).find(n=>n.props?.id==='additional-interview-notes');
 assert.ok(nodes(right()).includes(field()));const ref=field().props.ref;
 field().props.onChange({target:{value:'Keep throughout'}});t=h.render();select(t,'Snapshot question');await flush();t=h.render();edit(t,'Used, still unfinished');t=h.render();
 button(t,'End current interview').props.onClick();button(t,'End current interview').props.onClick();await flush();t=h.render();
 assert.equal(field().props.ref,ref);assert.equal(field().props.value,'Keep throughout');assert.equal(nodes(t).filter(n=>n.props?.id==='additional-interview-notes').length,1);
 assert.deepEqual(h.record.draft.completedQuestionIds,[]);assert.match(text(right()),/Used · Not marked complete/);
 select(t,'Snapshot question');await flush();t=h.render();assert.equal(nodes(t).find(n=>n.props?.id==='review-notes-q1').props.value,'Used, still unfinished');assert.match(text(right()),/Club answer keyListen carefully/);
 assert.ok(nodes(t).find(n=>n.props?.['aria-label']==='Post-interview'));assert.equal(h.calls.filter(c=>c[0]==='save').length,2); // Private text flushes before shared selection, then phase saves independently.
 const reload=harness(structuredClone(h.record));reload.render();await flush();t=reload.render();assert.equal(field().props.value,'Keep throughout');
});

test('End interview waits for a pending save, preserves late miscellaneous edits and remains active on failure', async () => {
 const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');await flush();t=h.render();edit(t,'First');t=h.render();
 let release;h.defer(new Promise(r=>release=r));h.tick();t=h.render();button(t,'End current interview').props.onClick();t=h.render();
 assert.equal(nodes(t).some(n=>n.props?.['aria-label']==='Post-interview'),false);
 nodes(t).find(n=>n.props?.id==='additional-interview-notes').props.onChange({target:{value:'Latest during pending save'}});t=h.render();release();await flush();h.defer(null);t=h.render();
 assert.equal(h.record.draft.additionalNotes,'Latest during pending save');assert.equal(h.record.draft.postInterview,true);assert.equal(h.record.completedAt,null);
 const bad=harness();bad.render();await flush();t=bad.render();bad.fail(true);button(t,'End current interview').props.onClick();await flush();t=bad.render();assert.ok(button(t,'End current interview'));assert.equal(bad.record.draft.postInterview,undefined);assert.match(text(t),/could not be saved/);
});

test('finish waits for autosave and submits the latest miscellaneous notes exactly once', async () => {
 const h=harness();h.render();await flush();let t=h.render();button(t,'End current interview').props.onClick();await flush();t=h.render();scoreInput(t).props.onChange({currentTarget:{value:'6.5'}});t=h.render();
 const field=()=>nodes(t).find(n=>n.props?.id==='additional-interview-notes');field().props.onChange({target:{value:'First'}});t=h.render();let release;h.defer(new Promise(r=>release=r));h.tick();t=h.render();
 field().props.onChange({target:{value:'Latest'}});t=h.render();const finish=button(t,'End post-interview');assert.equal(finish.props.disabled,false);finish.props.onClick();finish.props.onClick();t=h.render();assert.equal(field().props.disabled,true);release();await flush();h.defer(null);t=h.render();
 assert.equal(h.record.draft.additionalNotes,'Latest');assert.equal(h.calls.filter(c=>c[0]==='save'&&c[1].complete).length,1);assert.ok(h.record.completedAt);
});

test('desktop renders an inert flight, preserves notes above its stable landing and uses an unscaled 1040ms crossfade',async()=>{
 const priorWindow=global.window,priorDocument=global.document;
 global.window={matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}}),addEventListener(){},removeEventListener(){}};
 global.document={activeElement:null};
 try {
  const h=harness();h.render();await flush();let t=h.render();select(t,'Snapshot question');await flush();t=h.render();edit(t,'Used');t=h.render();
  nodes(t).find(n=>n.props?.['aria-label']==='Active question').props.ref({animate(){},getBoundingClientRect:()=>({left:300,top:150,width:600,height:400})});
  button(t,'End current interview').props.onClick();await flush();t=h.render();
  const flight=nodes(t).find(n=>n.props?.className==='oc-question-flight');assert.ok(flight);assert.equal(flight.props['aria-hidden'],'true');assert.equal(flight.props.inert,true);assert.equal(nodes(flight).some(n=>['button','Button','Textarea','input'].includes(n.type)),false);
  const calls=[],animate=(frames,options)=>{calls.push({frames,options});return{finished:new Promise(()=>{}),cancel(){}};};
  flight.props.ref({animate});const row=nodes(t).find(n=>n.type==='li'&&n.props?.style?.opacity===0);row.props.ref({animate,getBoundingClientRect:()=>({left:1000,top:330,width:280,height:150})});
  await flush();assert.equal(calls[0].options.duration,1040);assert.equal(calls[1].options.duration,320);assert.equal(calls[1].options.delay,720);assert.equal(calls[2].options.delay,720);
  assert.ok(calls[0].frames.every(frame=>!frame.transform.includes('scale')));assert.equal(calls[0].frames.at(-1).transform,'translate(700px,180px)');assert.equal(calls[0].frames.at(-1).width,'280px');assert.deepEqual(calls[1].frames,[{opacity:1},{opacity:0}]);
  assert.deepEqual(h.record.draft.completedQuestionIds,[]);assert.equal(h.record.draft.score,null);
 } finally {global.window=priorWindow;global.document=priorDocument;}
});

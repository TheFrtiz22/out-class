const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(r=>setImmediate(r));
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function harness(opts={}){
 const slots=[],effects=[],cleanups=[],storage=new Map(),confirmations=[],frames=[];let index=0,calls=0,denied=false,confirmationDenied=false,exits=0;
 const rows=['a','b','c'].map(id=>({id,name:id.toUpperCase(),roundId:'r',assignedRoundIds:['r'],completedRoundIds:[]}));
 let pipeline={rounds:[{id:'r',name:'Round 1',archived:false}],applications:rows}, deferred=null, sessionDenied=false;
 const depsChanged=(a,b)=>!a||b.some((v,i)=>v!==a[i]);
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x]},useRef(v){const i=index++;return slots[i]??={current:v}},useCallback(fn,deps){const i=index++;if(!slots[i]||depsChanged(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},useEffect(fn,deps){const i=index++;if(depsChanged(slots[i],deps)){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 react.useLayoutEffect=react.useEffect;
 const queue=require('./helpers/demo-harness.cjs').harness().load('lib/interview-queue.ts');
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('components/views/interview-workspace-view.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const clear=()=>{};
 const location=new URL(opts.url||"https://out-class.net/club/club/interview?interviewTab=rooms"),history={state:null,replaceState(_s,_t,href){location.href=new URL(href,location).href}};
 const api={resolveInterviewRoomEntry:opts.resolveEntry||(async input=>input),getInterviewWorkspace:async()=>{calls++;if(denied)throw Error('revoked');return structuredClone(pipeline)},openInterviewSession:async scope=>{if(deferred)await deferred;if(sessionDenied)throw Error('panel revoked');return{id:scope.applicationId,completedAt:null,draft:{score:null},questions:[]}},getInterviewApplicantPanel:async scope=>({name:scope.applicationId,document:null})};
 api.prepareInterviewAdvance=async scope=>{if(denied)throw Error('revoked');const next=queue.nextInterviewApplicant(pipeline.applications,scope.roundId,scope.applicationId);return next?{moveId:'move',scope:{clubId:scope.clubId,roundId:scope.roundId,applicationId:next.id}}:null};
 api.confirmInterviewAdvance=async receipt=>{confirmations.push(receipt);if(confirmationDenied)throw Error('disconnected');return{confirmed:true}};
 new Function('require','module','exports','window','sessionStorage','requestAnimationFrame','setInterval','clearInterval',code+';exports.TestSession=InterviewSession;')(n=>n==='react'?react:n.endsWith('.css')?{}:n==='@/components/shell/focus-frame-context'?{useFocusFrame:details=>frames.push(details)}:n==='@/lib/workspace-api'?api:n==='@/lib/interview-queue'?queue:n==='@/lib/application-state'?{useApplicationState:()=>({leaderFocus:null,clearLeaderFocus:clear})}:n.startsWith('@/')?new Proxy({},{get:(_,k)=>k}):require(n),mod,mod.exports,{location,history,addEventListener(){},removeEventListener(){},confirm:()=>true},{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fn=>fn(),()=>0,()=>{});
 const props={membership:{id:'member',clubId:'club',club:{name:'MII'}},onLock(){},onExit(){exits++}};
 return{frames,storage,confirmations,exits:()=>exits,denyConfirmation:v=>confirmationDenied=v,calls:()=>calls,deny:()=>denied=true,denySession:v=>sessionDenied=v,defer:p=>deferred=p,fresh:p=>pipeline=p,rows,unmount(){cleanups.forEach(fn=>fn?.())},render(){index=0;const t=mod.exports.TestSession(props);while(effects.length)effects.shift()();return t}};
}
const kit=t=>nodes(t).find(n=>n.type==='InterviewKitSession');
test('selection controls exist only on the interview list; active and post-interview room has no strip or candidate navigation',async()=>{
 const h=harness();h.render();await flush();let t=h.render();t=h.render();
 assert.ok(nodes(t).find(n=>n.props?.id==='interview-round'));
 nodes(t).find(n=>n.props?.id==='interview-candidate').props.onChange({target:{value:'a'}});t=h.render();
 assert.equal(nodes(t).find(n=>n.type==='select'),undefined);assert.equal(kit(t).props.applicationId,'a');
 assert.doesNotMatch(text(t),/evaluated by you|Previous candidate|Next candidate/);
 const toolbar=kit(t).props.toolbar(false);assert.equal(text(toolbar),'Interviews','the focus frame bar carries the club and round');assert.equal(h.frames.at(-1).task,'Interview · Round 1');assert.doesNotMatch(text(toolbar),/timer/i);
 assert.equal(text(kit(t).props.toolbar(true)),text(toolbar));
 nodes(toolbar).find(n=>n.type==='Button').props.onClick();t=h.render();assert.equal(h.exits(),1);assert.equal(h.storage.size,0);
});
test('a destination response after leaving the room cannot change selection or recovery state',async()=>{
 const h=harness();h.render();await flush();let t=h.render();t=h.render();nodes(t).find(n=>n.props?.id==='interview-candidate').props.onChange({target:{value:'a'}});t=h.render();
 let release;h.defer(new Promise(r=>release=r));const pending=kit(t).props.onNextApplicant();await flush();h.unmount();release();assert.equal(await pending,false);assert.match(h.storage.get('outclass-interview:club:member'),/"applicationId":"a"/);
});
test('advancement waits for destination authorization/data, guards duplicate clicks and preserves current screen on denial',async()=>{
 const h=harness();h.render();await flush();let t=h.render();t=h.render();nodes(t).find(n=>n.props?.id==='interview-candidate').props.onChange({target:{value:'a'}});t=h.render();
 let release;h.defer(new Promise(r=>release=r));const next=kit(t).props.onNextApplicant;const pending=next();assert.equal(await next(),false);await flush();t=h.render();assert.equal(kit(t).props.applicationId,'a');assert.ok(kit(t).props.advancing);
 h.denySession(true);release();await assert.rejects(pending,/panel revoked/);t=h.render();assert.equal(kit(t).props.applicationId,'a');assert.equal(kit(t).props.advancing,false);assert.equal(h.storage.get('outclass-interview:club:member'),'\{"roundId":"r","applicationId":"a"\}');
 h.defer(null);h.denySession(false);assert.equal(await kit(t).props.onNextApplicant(),true);t=h.render();t=h.render();assert.equal(kit(t).props.applicationId,'b');assert.equal(kit(t).props.initialSession.draft.score,null);assert.equal(kit(t).props.initialSession.draft.postInterview,undefined);assert.equal(kit(t).props.context.props.initialPanel.name,'b');
});
test('next applicant refreshes assignments, skips completed/revoked rows and changes the keyed session together',async()=>{
 const h=harness();h.render();await flush();let t=h.render();t=h.render();nodes(t).find(n=>n.props?.id==='interview-candidate').props.onChange({target:{value:'a'}});t=h.render();
 const old=kit(t);old.props.onComplete();t=h.render();t=h.render();assert.equal(kit(t).props.applicationId,'a');
 h.fresh({rounds:[{id:'r',name:'Round 1',archived:false}],applications:[{...h.rows[0],completedRoundIds:['r']},{...h.rows[1],assignedRoundIds:[]},h.rows[2]]});
 assert.equal(await kit(t).props.onNextApplicant(),true);t=h.render();t=h.render();assert.equal(kit(t).props.applicationId,'c');assert.notEqual(kit(t).key,old.key);assert.equal(h.calls(),2);
 h.deny();await assert.rejects(kit(t).props.onNextApplicant(),/revoked/);assert.equal(kit(h.render()).props.applicationId,'c');
});
test('failed arrival confirmation retains only its receipt and resumes after refresh',async()=>{
 const h=harness();h.render();await flush();let t=h.render();t=h.render();nodes(t).find(n=>n.props?.id==='interview-candidate').props.onChange({target:{value:'a'}});t=h.render();
 h.denyConfirmation(true);await kit(t).props.onNextApplicant('tab');h.render();h.render();await flush();t=h.render();assert.match(text(t),/Retry confirmation/);
 const saved=h.storage.get('outclass-interview:club:member');assert.deepEqual(JSON.parse(saved),{roundId:'r',applicationId:'b',moveId:'move',clientId:'tab'});h.unmount();
 const restored=harness();restored.storage.set('outclass-interview:club:member',saved);restored.render();await flush();restored.render();restored.render();await flush();t=restored.render();
 assert.equal(kit(t).props.applicationId,'b');assert.deepEqual(restored.confirmations,[{moveId:'move',clientId:'tab'}]);assert.deepEqual(JSON.parse(restored.storage.get('outclass-interview:club:member')),{roundId:'r',applicationId:'b'});
});

test('frame Exit from the interview room asks before discarding unsaved evaluation work',()=>{
 const frames=[],exits=[],confirms=[];let state=[];
 const react={useState:v=>{const value=state.length?state.shift():v;return[value,()=>{}]},useRef:v=>({current:v}),useCallback:fn=>fn,useEffect(){},useLayoutEffect(){}};
 const member={id:'m',clubId:'club',club:{name:'MII',color:'#123456'},permissions:['applications.review']};
 const code=ts.transpileModule(fs.readFileSync('components/views/interview-workspace-view.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 const mocks={react,'@/components/shell/focus-frame-context':{useFocusFrame:d=>frames.push(d)},'@/contexts/auth-context':{useAuth:()=>({user:{id:'u',memberships:[member]},loading:false,activeClubId:'club',selectClub(){}})},'@/lib/application-state':{useApplicationState:()=>({leaderFocus:null})},'@/lib/permissions':{hasPermission:(m,p)=>m.permissions.includes(p)}};
 const win={confirm:message=>{confirms.push(message);return win.answer}};
 new Function('require','module','exports','window',code)(n=>mocks[n]||(n.endsWith('.css')?{}:n.startsWith('@/')?new Proxy({},{get:(_,k)=>k}):require(n)),mod,mod.exports,win);
 const render=(locked,saving)=>{frames.length=0;state=[locked,saving];mod.exports.InterviewWorkspaceView({onExit:()=>exits.push('exit'),scoped:true});return frames[0]};
 assert.deepEqual(render(false,false).club,{name:'MII',color:'#123456'});
 render(false,false).onExit();assert.deepEqual(exits,['exit']);assert.deepEqual(confirms,[],'nothing unsaved: leave at once');
 win.answer=false;render(true,false).onExit();assert.deepEqual(exits,['exit'],'unsaved and declined: stay');assert.equal(confirms.length,1);
 win.answer=true;render(true,false).onExit();assert.deepEqual(exits,['exit','exit'],'unsaved and confirmed: leave');
 render(true,true).onExit();assert.equal(exits.length,2,'a save in flight blocks leaving');
 assert.equal((frames.length=0,state=[false,false],mod.exports.InterviewWorkspaceView({scoped:true}),frames[0].onExit),undefined,'without an exit handler the frame keeps its Exit link');
});
test('an exact room link the server reports unavailable shows the cannot-open state and never opens a candidate',async()=>{
 const seen=[];const h=harness({url:'https://out-class.net/club/club/interview?interviewTab=rooms&applicationId=a&roundId=r',resolveEntry:async input=>{seen.push(input.applicationId);return{unavailable:'Current panel assignment or explicit leadership permission required.'}}});
 h.render();await flush();let t=h.render();t=h.render();
 assert.deepEqual(seen,['a']);assert.equal(kit(t),undefined);assert.match(text(t),/couldn.t open this interview/i);
 const ok=harness({url:'https://out-class.net/club/club/interview?interviewTab=rooms&applicationId=a&roundId=r'});ok.render();await flush();t=ok.render();t=ok.render();assert.equal(kit(t).props.applicationId,'a','an available exact entry still opens the linked candidate');
});

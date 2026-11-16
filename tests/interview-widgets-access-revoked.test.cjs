// Interview room widgets (shared timer, round score, earlier rounds) hand an ACCESS_REVOKED refusal to the
// room's onAccessRevoked: no generic error or Retry, polling stops, and late refusals after close are ignored.
// Without a handler (e.g. the leader's Submitted reviews) the existing inline message stays.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {loadComponent}=require('./helpers/component-module.cjs');
const actionResult=require('./helpers/communications-loader.cjs').loader({})('lib/action-result.ts');
const flush=()=>new Promise(r=>setImmediate(r));
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
const button=(t,label)=>nodes(t).find(n=>n.type==='Button'&&(text(n)===label||n.props?.['aria-label']===label));
const revokedError=()=>new actionResult.UserFacingError('You no longer have access to this interview.','ACCESS_REVOKED');
const scope={clubId:'club',applicationId:'app',roundId:'round'};

function mount(file,api){
 const slots=[],effects=[],cleanups=[],intervals=new Map(),listeners=new Set();let index=0,id=0;
 const react={useState(v){const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x]},useRef(v){const i=index++;if(!(i in slots))slots[i]={current:v};return slots[i]},useEffect(fn,deps){const i=index++;if(!slots[i]||!deps||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps||[];effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const window={addEventListener:(k,fn)=>k==='focus'&&listeners.add(fn),removeEventListener:(k,fn)=>k==='focus'&&listeners.delete(fn)};
 const document={hidden:false,addEventListener(){},removeEventListener(){}};
 const mod={exports:{}},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','setInterval','clearInterval','window','document',code)(n=>n==='react'?react:n==='@/lib/workspace-api'?api:n==='@/lib/action-result'?actionResult:n==='@/components/ui/button'?{Button:'Button'}:n==='@/components/icons'?{ChevronRight:'ChevronRight'}:n==='@/components/ui/loading-state'?{LoadingState:'LoadingState'}:n.startsWith('@/lib/')?loadComponent(n.slice(2)+'.ts'):require(n),mod,mod.exports,fn=>{intervals.set(++id,fn);return id},i=>intervals.delete(i),window,document);
 return {exports:mod.exports,intervals,listeners,render(component,props){index=0;const t=component(props);while(effects.length)effects.shift()();return t},unmount(){cleanups.forEach(c=>c?.())},poll(){[...intervals.values()].forEach(fn=>fn())}};
}

const timing={durationMs:30*60000,contextKey:'ctx',source:'round'};
const shared={durationMs:30*60000,contextKey:'ctx',startedAt:null,pausedAt:null,pausedMs:0,revision:1,serverNow:Date.now(),clockOffsetMs:0};
function timer(control,props={}){
 const m=mount('components/interview-timer.tsx',{controlInterviewTimer:control});
 const render=()=>m.render(m.exports.InterviewTimer,{scope,paused:false,timing,shared,...props});
 render();return {...m,render};
}

test('a shared-timer command refused with ACCESS_REVOKED hands off to the room once: no "Couldn’t update the timer", controls stay disabled',async()=>{
 let calls=0;const removed=[];const h=timer(async()=>{calls++;throw revokedError()},{onAccessRevoked:()=>removed.push(1)});
 let t=h.render();const pressing=button(t,'Start').props.onClick();t=h.render();await pressing;await flush();t=h.render();
 assert.equal(calls,1);assert.equal(removed.length,1,'the room is told');
 assert.doesNotMatch(text(t),/Couldn’t update the timer/);assert.equal(button(t,'Start').props.disabled,true,'no further commands while the room switches');
 button(t,'Reset').props.onClick();await flush();assert.equal(calls,1,'no retry is sent');assert.equal(removed.length,1);
});
test('a timer refusal arriving after the timer unmounted is ignored',async()=>{
 let reject;const removed=[];const h=timer(()=>new Promise((_,r)=>reject=r),{onAccessRevoked:()=>removed.push(1)});
 const t=h.render();button(t,'Start').props.onClick();h.unmount();reject(revokedError());await flush();
 assert.deepEqual(removed,[],'a late refusal does not close a reopened room');
});
test('without a room handler the timer keeps its existing inline message',async()=>{
 const h=timer(async()=>{throw revokedError()});let t=h.render();button(t,'Start').props.onClick();await flush();t=h.render();
 assert.match(text(t),/Couldn’t update the timer/);
});

function references(api){const m=mount('components/interview-review-references.tsx',api);return m;}
test('round score polling refused with ACCESS_REVOKED hands off to the room and stops: no "unavailable" or Retry',async()=>{
 let reads=0,denied=false;const removed=[];
 const m=references({getInterviewRoundScore:async()=>{reads++;if(denied)throw revokedError();return{average:8,submitted:1,required:2,provisional:true}}});
 const render=()=>m.render(m.exports.RoundScore,{scope,onAccessRevoked:()=>removed.push(1)});
 render();await flush();let t=render();assert.match(text(t),/8/);
 denied=true;m.poll();await flush();t=render();
 assert.equal(removed.length,1);assert.doesNotMatch(text(t),/unavailable/);assert.equal(button(t,'Retry'),undefined);
 assert.equal(m.intervals.size,0,'polling interval cleared');assert.equal(m.listeners.size,0,'focus refresh removed');
 const before=reads;m.poll();m.listeners.forEach(fn=>fn());await flush();assert.equal(reads,before,'no further reads');assert.equal(removed.length,1);
});
test('a round score refusal after unmount is ignored; without a handler the inline message and Retry stay',async()=>{
 let reject;const removed=[];
 const m=references({getInterviewRoundScore:()=>new Promise((_,r)=>reject=r)});
 m.render(m.exports.RoundScore,{scope,onAccessRevoked:()=>removed.push(1)});m.unmount();reject(revokedError());await flush();
 assert.deepEqual(removed,[]);
 const plain=references({getInterviewRoundScore:async()=>{throw revokedError()}});
 const render=()=>plain.render(plain.exports.RoundScore,{scope});render();await flush();const t=render();
 assert.match(text(t),/Round scores unavailable/);assert.ok(button(t,'Retry'),'leader Submitted reviews keep Retry');
});
test('earlier rounds refused with ACCESS_REVOKED hand off to the room; a refusal after the section closed is ignored',async()=>{
 let reads=0,reject=null;const removed=[];
 const m=references({getEarlierInterviewReviews:()=>{reads++;return reject===null?Promise.reject(revokedError()):new Promise((_,r)=>reject=r)}});
 const render=()=>m.render(m.exports.EarlierRounds,{scope,onAccessRevoked:()=>removed.push(1)});
 let t=render();assert.equal(reads,0,'nothing read while closed');button(t,'Earlier rounds').props.onClick();render();await flush();t=render();
 assert.equal(removed.length,1);assert.doesNotMatch(text(t),/Earlier reviews unavailable/);assert.equal(button(t,'Retry'),undefined);
 assert.equal(m.intervals.size,0);assert.equal(m.listeners.size,0);
 const late=references({getEarlierInterviewReviews:()=>new Promise((_,r)=>reject=r)});const lateRemoved=[];
 const lateRender=()=>late.render(late.exports.EarlierRounds,{scope,onAccessRevoked:()=>lateRemoved.push(1)});
 t=lateRender();button(t,'Earlier rounds').props.onClick();t=lateRender();button(t,'Earlier rounds').props.onClick();lateRender();
 reject(revokedError());await flush();t=lateRender();assert.deepEqual(lateRemoved,[],'closed before the refusal arrived');
});
test('earlier rounds without a handler keep the inline message and Retry',async()=>{
 const m=references({getEarlierInterviewReviews:async()=>{throw revokedError()}});
 const render=()=>m.render(m.exports.EarlierRounds,{scope});let t=render();button(t,'Earlier rounds').props.onClick();render();await flush();t=render();
 assert.match(text(t),/Earlier reviews unavailable/);assert.ok(button(t,'Retry'));
});

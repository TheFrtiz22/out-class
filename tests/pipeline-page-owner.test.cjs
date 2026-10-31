const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {load}=require('./helpers/voting-harness.cjs');
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
function setup(){
 const slots=[],effects=[],setups=new Map(),cleanups=new Map(),requests=[];let index=0,changed=false,epoch={},currentEpoch=epoch;
 const isReadAuthorityCurrent=authority=>authority===currentEpoch;
 const react={useState(value){const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],next=>{const v=typeof next==='function'?next(slots[i]):next;changed||=!Object.is(v,slots[i]);slots[i]=v}]},useRef(value){return slots[index++]??={current:value}},useMemo(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,value:fn()};return slots[i].value},useCallback(fn,deps){return react.useMemo(()=>fn,deps)},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;setups.set(i,fn);effects.push([i,fn])}}};
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('hooks/use-pipeline-page.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='react'?react:name==='@/contexts/auth-context'?{useAuth:()=>({readAuthority:epoch,isReadAuthorityCurrent})}:name==='@/lib/workspace-api'?{getClubPipelinePage:(club,query)=>new Promise((resolve,reject)=>requests.push({club,query,resolve,reject}))}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);
 return{requests,notifyEpoch(){currentEpoch={}},commitEpoch(){epoch=currentEpoch},renderBeforeEffects(props){index=0;changed=false;return mod.exports.usePipelinePage(props)},async commitEffects(){for(const[i,fn]of effects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn())}await tick()},render(props){let result;for(let step=0;step<20;step++){index=0;changed=false;result=mod.exports.usePipelinePage(props);for(const[i,fn]of effects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn())}if(!changed)return result}throw Error('Hook failed to settle')},replay(){for(const fn of cleanups.values())fn?.();cleanups.clear();for(const[i,fn]of setups)cleanups.set(i,fn())},cleanup(){for(const fn of cleanups.values())fn?.()}};
}
const props=()=>({clubId:'club',query:{},revision:0,authority:{},enabled:true,initialData:null,validatedInitialData:false});
test('a covered complete page filters locally but never crosses authority or mutation revisions',async()=>{
 const h=setup(),{pagePipeline}=load('lib/pipeline-page.ts'),id=n=>`123e4567-e89b-12d3-a456-${String(n).padStart(12,'0')}`;
 const applications=['Ada','Zoe'].map((firstName,i)=>({id:id(i),roundId:id(9),status:'IN_REVIEW',studentId:id(i+20),student:{email:firstName+'@example.invalid',studentProfile:{firstName,lastName:'Student',major:'Economics',academicYear:'Second Year'}},evaluations:[],roundScore:null,answers:[firstName+' detail']}));
 const page={...pagePipeline({rounds:[],genderCounts:null,applications},{},'member','user','scope'),coverage:{complete:true,mode:'applicants'}};
 let p={...props(),reviewerId:'member',userId:'user',validatedInitialData:true,initialData:page};
 const initial=h.render(p);assert.equal(initial.ready,true);assert.equal(initial.data,page,'retain the exact server-ranked page until the query changes');p={...p,query:{query:'Zoe'}};
 let v=h.render(p);assert.equal(v.ready,true);assert.deepEqual(v.data.applications.map(a=>a.answers),[['Zoe detail']]);assert.equal(h.requests.length,0);
 const old=v;h.notifyEpoch();assert.equal(old.isCurrent(),false);assert.equal(h.render(p).data,null);
 h.commitEpoch();h.render(p);assert.equal(h.requests.length,1);h.requests[0].resolve({...page,coverage:{complete:false,mode:'applicants'}});await tick();h.render(p);
 p={...p,revision:1};assert.equal(h.render(p).data,null);assert.equal(h.requests.length,2,'a mutation never reuses complete-page coverage');h.cleanup();
});
test('a fresh read supersedes complete coverage even when denied after its query becomes obsolete',async()=>{
 const h=setup(),{pagePipeline}=load('lib/pipeline-page.ts'),id='123e4567-e89b-12d3-a456-000000000001';
 const applications=[{id,roundId:id,status:'SUBMITTED',studentId:'student',student:{email:'a@example.invalid',studentProfile:null},evaluations:[],roundScore:null}];
 const page={...pagePipeline({rounds:[],genderCounts:null,applications},{},'member','user','scope'),coverage:{complete:true,mode:'applicants'}};
 let p={...props(),reviewerId:'member',userId:'user',validatedInitialData:true,initialData:page};h.render(p);
 p={...p,query:{roundId:id,gender:'Female'}};assert.equal(h.render(p).ready,false);assert.equal(h.requests.length,1);
 p={...p,query:{}};assert.equal(h.render(p).ready,false,'returning to a complete query cannot resurrect superseded coverage');
 h.requests[0].reject(Error('permission revoked'));await tick();assert.equal(h.requests.length,2);
 h.requests[1].reject(Error('still revoked'));await tick();assert.equal(h.render(p).data,null);
 p={...p,query:{query:'a'}};assert.equal(h.render(p).ready,false);assert.equal(h.requests.length,3);h.cleanup();
});
test('a notified epoch blocks page dispatch before its React commit',async()=>{
 const h=setup(),p=props();h.renderBeforeEffects(p);h.notifyEpoch();await h.commitEffects();assert.equal(h.requests.length,0);
 h.commitEpoch();h.render(p);assert.equal(h.requests.length,1);h.requests[0].resolve({marker:'fresh'});await tick();assert.equal(h.render(p).ready,true);h.cleanup();
});
test('notified epochs reject pending page successes and failures before React commits',async()=>{
 for(const failed of [false,true]){const h=setup(),p=props();h.render(p);h.notifyEpoch();if(failed)h.requests[0].reject(Error('obsolete'));else h.requests[0].resolve({marker:'obsolete'});await tick();const hidden=h.render(p);assert.equal(hidden.data,null);assert.equal(hidden.ready,false);assert.equal(hidden.error,false);
 h.commitEpoch();h.render(p);assert.equal(h.requests.length,2);h.requests[1].resolve({marker:'fresh'});await tick();assert.equal(h.render(p).data.marker,'fresh');h.cleanup();}
});
test('already visible page data, setters and adjacent handoffs are fenced immediately on notification',async()=>{
 const h=setup(),p={...props(),initialData:{marker:'visible'},validatedInitialData:true};const old=h.render(p);assert.equal(old.ready,true);h.notifyEpoch();assert.equal(old.isCurrent(),false);assert.equal(old.setData({marker:'stale'}),false);assert.equal(old.acceptPage({marker:'stale'},{query:'next'}),false);assert.equal(h.render(p).data,null);
 h.commitEpoch();h.render(p);assert.equal(h.requests.length,1);h.requests[0].resolve({marker:'fresh'});await tick();assert.equal(h.render(p).data.marker,'fresh');h.cleanup();
});
test('queued page reads never dispatch for a notified obsolete epoch',async()=>{
 const h=setup();let p=props();h.render(p);p={...p,query:{query:'queued'}};h.render(p);h.notifyEpoch();h.requests[0].resolve({marker:'obsolete'});await tick();assert.equal(h.requests.length,1);assert.equal(h.render(p).data,null);
 h.commitEpoch();h.render(p);assert.equal(h.requests.length,2);assert.equal(h.requests[1].query.query,'queued');h.requests[1].resolve({marker:'fresh'});await tick();assert.equal(h.render(p).ready,true);h.cleanup();
});
test('page owners fence stale completions/setters and drain rapid query changes to the latest only',async()=>{
 const h=setup();let p=props();const old=h.render(p);for(let i=0;i<20;i++){p={...p,query:{query:String(i)}};assert.equal(h.render(p).ready,false)}assert.equal(h.requests.length,1);h.requests[0].resolve({marker:'obsolete'});await tick();assert.equal(h.requests.length,2);assert.equal(h.requests[1].query.query,'19');assert.equal(h.render(p).data,null);h.requests[1].resolve({marker:'current'});await tick();let value=h.render(p);assert.equal(value.ready,true);assert.equal(value.data.marker,'current');assert.equal(old.setData({marker:'stale'}),false);
 const previous=value;p={...p,query:{query:'different'}};value=h.render(p);assert.equal(value.data.marker,'current','only prior metadata is retained to keep controls editable');assert.equal(value.ready,false,'prior rows cannot render for the changed query');p={...p,query:{query:'19'}};h.render(p);assert.equal(previous.isCurrent(),false,'returning to a query must create a fresh owner');h.cleanup();
});
test('validated initial pages avoid duplication; invalid filters keep controls editable and never dispatch',async()=>{
 const h=setup();let p={...props(),initialData:{marker:'validated'},validatedInitialData:true};let v=h.render(p);assert.equal(v.ready,true);assert.equal(h.requests.length,0);h.replay();assert.equal(h.render(p).ready,true);p={...p,query:{gpa:5}};v=h.render(p);assert.equal(v.invalid,true);assert.equal(v.data.marker,'validated');assert.equal(v.ready,false);assert.equal(h.requests.length,0);p={...p,query:{gpa:3}};h.render(p);assert.equal(h.requests.length,1);h.requests[0].reject(Error('revoked'));await tick();v=h.render(p);assert.equal(v.error,true);assert.equal(v.loading,false);assert.equal(v.data,null);h.cleanup();
});
test('authority and refresh changes hide all earlier pages; queued disabled scopes never dispatch',async()=>{
 const h=setup();let p={...props(),initialData:{marker:'initial'},validatedInitialData:true};const old=h.render(p);p={...p,revision:1};assert.equal(h.render(p).data,null);assert.equal(old.setData({marker:'stale'}),false);assert.equal(h.requests.length,1);p={...p,authority:{}};h.render(p);p={...p,enabled:false};assert.equal(h.render(p).data,null);h.requests[0].resolve({marker:'obsolete'});await tick();assert.equal(h.requests.length,1);p={...p,enabled:true};h.render(p);assert.equal(h.requests.length,2);h.requests[1].resolve({marker:'fresh'});await tick();assert.equal(h.render(p).ready,true);h.cleanup();
});
test('an adjacent freshly authorized page is adopted once, while obsolete handoffs cannot replace a newer owner',async()=>{
 const h=setup();let p={...props(),initialData:{marker:'first'},validatedInitialData:true};const old=h.render(p);const next={query:'next'};assert.equal(old.acceptPage({marker:'second'},next),true);p={...p,query:next};let value=h.render(p);assert.equal(value.ready,true);assert.equal(value.data.marker,'second');assert.equal(h.requests.length,0,'handing off the fetched boundary must not dispatch it again');assert.equal(old.acceptPage({marker:'stale'},{query:'wrong'}),false);p={...p,revision:1};assert.equal(h.render(p).data,null);assert.equal(h.requests.length,1);h.cleanup();
});

test('an invalid filter after queued reads retains editable metadata without dispatching or releasing obsolete rows',async()=>{
 const h=setup();let p={...props(),initialData:{marker:'initial'},validatedInitialData:true};h.render(p);p={...p,query:{query:'pending'}};h.render(p);p={...p,query:{query:'queued'}};h.render(p);p={...p,query:{gpa:5}};h.render(p);h.requests[0].resolve({marker:'obsolete'});await tick();const value=h.render(p);assert.equal(value.invalid,true);assert.equal(value.ready,false);assert.equal(value.data?.marker,'initial','controls must retain only prior metadata while invalid');assert.equal(value.loading,false);assert.equal(h.requests.length,1);h.cleanup();
});
test('an authority change while filters are invalid reacquires safe metadata before showing editable controls',async()=>{
 const h=setup();let p={...props(),initialData:{marker:'initial'},validatedInitialData:true};h.render(p);p={...p,query:{gpa:5}};h.render(p);p={...p,authority:{}};assert.equal(h.render(p).data,null);assert.equal(h.requests.length,1,'new authority must validate rather than remaining stuck behind invalid input');assert.deepEqual(h.requests[0].query,{});h.requests[0].resolve({marker:'fresh-controls'});await tick();const value=h.render(p);assert.equal(value.data.marker,'fresh-controls');assert.equal(value.invalid,true);assert.equal(value.ready,false);assert.equal(value.loading,false);h.cleanup();
});

test('an adopted adjacent page cannot resurrect an old owner when the query is left and revisited',async()=>{
 const h=setup();let p={...props(),initialData:{marker:'first'},validatedInitialData:true};const first=h.render(p);const next={query:'adopted'};first.acceptPage({marker:'adopted'},next);p={...p,query:next};const adopted=h.render(p);assert.equal(adopted.ready,true);p={...p,query:{query:'different'}};h.render(p);p={...p,query:next};const revisit=h.render(p);assert.equal(revisit.ready,false,'revisiting must validate again rather than resurrecting the handoff');assert.equal(adopted.isCurrent(),false);h.requests[0].resolve({marker:'obsolete'});await tick();assert.equal(h.requests.length,2);h.requests[1].resolve({marker:'fresh-revisit'});await tick();assert.equal(h.render(p).data.marker,'fresh-revisit');h.cleanup();
});

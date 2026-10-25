const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {load}=require('./helpers/voting-harness.cjs');
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
function setup(){
 const slots=[],effects=[],setups=new Map(),cleanups=new Map(),requests=[];let index=0,changed=false;
 const react={useState(value){const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],next=>{const v=typeof next==='function'?next(slots[i]):next;changed||=!Object.is(v,slots[i]);slots[i]=v}]},useRef(value){return slots[index++]??={current:value}},useMemo(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,value:fn()};return slots[i].value},useCallback(fn,deps){return react.useMemo(()=>fn,deps)},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;setups.set(i,fn);effects.push([i,fn])}}};
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('hooks/use-resident-pipeline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='react'?react:name==='@/lib/workspace-api'?{getClubPipelineList:(club,filter)=>new Promise((resolve,reject)=>requests.push({club,filter,resolve,reject}))}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);
 return{requests,render(props){let result;for(let step=0;step<20;step++){index=0;changed=false;result=mod.exports.useResidentPipeline(props);for(const[i,fn]of effects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn())}if(!changed)return result}throw Error('Hook failed to settle')},replay(){for(const fn of cleanups.values())fn?.();cleanups.clear();for(const[i,fn]of setups)cleanups.set(i,fn())},cleanup(){for(const fn of cleanups.values())fn?.()}};
}
const props=()=>({clubId:'club',filter:{genderCounts:false},revision:0,authority:{},enabled:true,initialData:null,validatedInitialData:false});
test('one mounted complete summary set is retained; every refresh and owner/scope change starts fresh authority',async()=>{
 const h=setup();let p=props();assert.equal(h.render(p).data,null);assert.equal(h.requests.length,1);h.requests[0].resolve({marker:'first'});await tick();let value=h.render(p);assert.equal(value.data.marker,'first');for(let i=0;i<10;i++)h.render({...p,filter:{genderCounts:false}});assert.equal(h.requests.length,1);
 const oldSetter=value.setData;for(const change of [{revision:1},{clubId:'other'},{filter:{roundId:'new-round',genderCounts:true}},{authority:{}},{enabled:false},{enabled:true}]){p={...p,...change};assert.equal(h.render(p).data,null);assert.equal(oldSetter({marker:'stale'}),false);const pending=h.requests.at(-1);if(p.enabled){pending.resolve({marker:'fresh'});await tick();assert.equal(h.render(p).data.marker,'fresh')}}
 assert.equal(h.requests.length,6);h.cleanup();assert.equal(value.isCurrent(),false);
});
test('pending scopes drain once and dispatch only the latest; stale completions and setters cannot replace a newer result',async()=>{
 const h=setup();let p=props();const original=h.render(p);for(let i=1;i<21;i++){p={...p,filter:{roundId:String(i),genderCounts:false}};assert.equal(h.render(p).data,null)}assert.equal(h.requests.length,1);h.requests[0].resolve({marker:'obsolete'});await tick();assert.equal(h.requests.length,2);assert.equal(h.requests[1].filter.roundId,'20');assert.equal(h.render(p).data,null);h.requests[1].resolve({marker:'current'});await tick();assert.equal(h.render(p).data.marker,'current');assert.equal(original.setData({marker:'stale'}),false);assert.equal(h.render(p).data.marker,'current');h.cleanup();
});
test('validated initial summaries avoid a duplicate read, while unvalidated data stays hidden; replay and denial retain fresh-read behavior',async()=>{
 const h=setup();let p={...props(),initialData:{marker:'validated'},validatedInitialData:true};assert.equal(h.render(p).data.marker,'validated');assert.equal(h.requests.length,0);h.replay();assert.equal(h.render(p).data.marker,'validated');assert.equal(h.requests.length,0);p={...p,revision:1};assert.equal(h.render(p).data,null);assert.equal(h.requests.length,1);h.requests[0].reject(Error('revoked'));await tick();assert.equal(h.render(p).error,true);assert.equal(h.render(p).data,null);h.cleanup();
 const untrusted=setup(),q={...props(),initialData:{marker:'unvalidated'}};assert.equal(untrusted.render(q).data,null);assert.equal(untrusted.requests.length,1);untrusted.cleanup();untrusted.requests[0].resolve({marker:'late'});await tick();
});

test('a queued read never dispatches while the current scope is disabled',async()=>{
 const h=setup();let p=props();h.render(p);p={...p,revision:1};h.render(p);p={...p,enabled:false};h.render(p);h.requests[0].resolve({marker:'obsolete'});await tick();assert.equal(h.requests.length,1);assert.equal(h.render(p).data,null);p={...p,enabled:true};h.render(p);assert.equal(h.requests.length,2);h.requests[1].resolve({marker:'fresh'});await tick();assert.equal(h.render(p).data.marker,'fresh');h.cleanup();
});

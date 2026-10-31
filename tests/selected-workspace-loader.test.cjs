const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const tick=async()=>{for(let n=0;n<30;n++)await Promise.resolve()};
function setup(){
 const state=[],effects=[],cleanups=new Map();let cursor=0,user={id:'one'},epoch={},currentEpoch=epoch,support=false,demo={ready:true,isDemoEnabled:false};const requests=[],modules=[];
 const hooks={useRef(initial){return state[cursor++]??={current:initial}},useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useMemo(fn,deps){const i=cursor++;if(!state[i]||deps.some((d,j)=>d!==state[i].deps[j]))state[i]={deps,value:fn()};return state[i].value},useEffect(fn,deps){const i=cursor++;if(!state[i]||deps.some((d,j)=>d!==state[i][j])){state[i]=deps;effects.push([i,fn])}}};
 const readWorkspace=(kind,args)=>new Promise((resolve,reject)=>requests.push({kind,args,resolve,reject}));
 const isReadAuthorityCurrent=value=>value===currentEpoch;
 const mocks={react:hooks,'@/lib/workspace-read-diagnostics':{recordWorkspaceRead(){}},'@/contexts/auth-context':{useAuth:()=>({user,readAuthority:epoch,isReadAuthorityCurrent,isImpersonating:support,loading:false})},'@/contexts/demo-context':{useDemoMode:()=>demo},'@/lib/workspace-read':{readWorkspace},'@/components/ui/button':{Button:'Button'},'@/components/workspace-loading':{WorkspaceLoading:'WorkspaceLoading'}};
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('components/selected-club-workspace.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>{if(name in mocks)return mocks[name];if(name.startsWith('@/components/')){modules.push(name);return{ClubMembers:'Members',ClubTasks:'Tasks',ClubAnnouncements:'Announcements',LiveLeaderWorkspace:'Pipeline'}}return require(name)},mod,mod.exports);
 return{...mod.exports,requests,modules,render(props){cursor=0;return mod.exports.SelectedClubWorkspace(props)},async flush(){for(const[i,fn]of effects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn())}await tick()},setUser(v){user=v},rotate(){epoch={};currentEpoch=epoch},rotateBeforeCommit(){currentEpoch={}},commitEpoch(){epoch=currentEpoch},setDemo(v){demo=v},setSupport(v){support=v},cleanup(){for(const fn of cleanups.values())fn?.()}};
}
test('all four selected resources start their guarded read alongside code loading and never reuse another visit',async()=>{
 const f=setup();for(const kind of ['members','pipeline','tasks','announcements']){const pending=f.loadSelectedClubWorkspace(kind,'club');await tick();assert.equal(f.requests.length,f.modules.length);const r=f.requests.at(-1);assert.equal(r.kind,kind==='pipeline'?'pipelinePage':kind);assert.deepEqual(r.args,kind==='pipeline'?['club',{mode:'applicants',genderCounts:false}]:['club']);r.resolve({fixture:true});assert.equal((await pending).kind,kind)}
 const pending=f.loadSelectedClubWorkspace('members','club');await tick();assert.equal(f.requests.length,5);f.requests.at(-1).reject(Error('revoked'));await assert.rejects(pending,/revoked/);
});
test('late navigation/session/account results cannot reveal a previous projection; retry makes a fresh request',async()=>{
 const f=setup();let props={kind:'members',clubId:'club',privacyScope:'scope'};f.render(props);await f.flush();const old=f.requests[0];
 props={...props,kind:'tasks'};f.render(props);await f.flush();old.resolve({private:'old'});await tick();assert.equal(f.render(props).type,'WorkspaceLoading');f.requests[1].resolve({clubId:'club'});await tick();assert.equal(f.render(props).type,'Tasks');
 f.rotate();assert.equal(f.render(props).type,'WorkspaceLoading');await f.flush();f.requests[2].reject(Error('revoked'));await tick();let tree=f.render(props);assert.equal(tree.props.role,'alert');tree.props.children[1].props.onClick();assert.equal(f.render(props).type,'WorkspaceLoading');await f.flush();assert.equal(f.requests.length,4);
 f.setUser({id:'two'});f.render(props);await f.flush();f.requests[3].resolve({private:'previous session'});await tick();assert.equal(f.render(props).type,'WorkspaceLoading');f.requests[4].resolve({clubId:'club'});await tick();assert.equal(f.render(props).type,'Tasks');f.cleanup();
});
test('Demo and unresolved Demo initialization never dispatch a live selected-tab request',async()=>{
 const f=setup(),props={kind:'tasks',clubId:'club',privacyScope:'scope'};f.setDemo({ready:false,isDemoEnabled:false});f.render(props);await f.flush();assert.equal(f.requests.length,0);f.setDemo({ready:true,isDemoEnabled:true});f.render(props);await f.flush();assert.equal(f.requests.length,0);f.setDemo({ready:true,isDemoEnabled:false});f.render(props);await f.flush();assert.equal(f.requests.length,1);f.requests[0].resolve({clubId:'club'});await tick();assert.equal(f.render(props).type,'Tasks');f.setDemo({ready:true,isDemoEnabled:true});assert.equal(f.render(props).type,'WorkspaceLoading');f.cleanup();
});

test('club, privacy and support authority changes hide content and fence earlier reads',async()=>{
 const f=setup();let props={kind:'members',clubId:'one',privacyScope:'identified'};f.render(props);await f.flush();f.requests[0].resolve({members:[]});await tick();assert.equal(f.render(props).type,'Members');
 props={...props,clubId:'two'};assert.equal(f.render(props).type,'WorkspaceLoading');await f.flush();f.setSupport(true);assert.equal(f.render(props).type,'WorkspaceLoading');await f.flush();f.requests[1].resolve({members:['wrong club context']});await tick();assert.equal(f.render(props).type,'WorkspaceLoading');
 props={...props,privacyScope:'anonymous-revision'};f.render(props);await f.flush();f.requests[2].resolve({members:['old support projection']});await tick();assert.equal(f.render(props).type,'WorkspaceLoading');f.requests[3].reject(Error('support restricted'));await tick();assert.equal(f.render(props).props.role,'alert');f.cleanup();
});

test('an Auth notification before effect commit defers an obsolete selected read until its current scope renders',async()=>{
 const f=setup(),props={kind:'pipeline',clubId:'club',privacyScope:'scope'};
 f.render(props);f.rotateBeforeCommit();await f.flush();assert.equal(f.requests.length,0,'The old rendered epoch is already obsolete, so no request should be sent');
 f.commitEpoch();f.render(props);await f.flush();assert.equal(f.requests.length,1);f.requests[0].resolve({clubId:'club'});await tick();assert.equal(f.render(props).type,'Pipeline');
 f.cleanup();
});
test('successful and failed reads cannot settle during the gap between Auth notification and React commit',async()=>{
 for(const failure of [false,true]){
  const f=setup(),props={kind:'members',clubId:'club',privacyScope:'scope'};f.render(props);await f.flush();assert.equal(f.requests.length,1);
  f.rotateBeforeCommit();if(failure)f.requests[0].reject(Error('obsolete error'));else f.requests[0].resolve({members:['obsolete projection']});await tick();assert.equal(f.render(props).type,'WorkspaceLoading');
  f.commitEpoch();f.render(props);await f.flush();assert.equal(f.requests.length,2);f.requests[1].resolve({members:[]});await tick();assert.equal(f.render(props).type,'Members');f.cleanup();
 }
});

 test('already visible results stay hidden if rendered before the notified epoch commits',async()=>{
  const f=setup(),props={kind:'members',clubId:'club',privacyScope:'scope'};f.render(props);await f.flush();f.requests[0].resolve({members:[]});await tick();assert.equal(f.render(props).type,'Members');
  f.rotateBeforeCommit();assert.equal(f.render(props).type,'WorkspaceLoading');await f.flush();assert.equal(f.requests.length,1);
  f.commitEpoch();f.render(props);await f.flush();assert.equal(f.requests.length,2);f.requests[1].resolve({members:[]});await tick();assert.equal(f.render(props).type,'Members');f.cleanup();
 });

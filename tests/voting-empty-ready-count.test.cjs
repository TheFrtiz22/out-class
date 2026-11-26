// Voting room with no sessions: someone who can start one sees how many of the round's applicants are ready,
// with a button into setup. Others, pages without a round in view, and failed reads keep the plain empty state.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
globalThis.window??={addEventListener(){},removeEventListener(){}}
const tick=async()=>{for(let n=0;n<40;n++)await Promise.resolve()}
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
function load(file,mocks){const resolved=[file,`${file}.ts`,`${file}.tsx`].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());const mod={exports:{}};new Function('require','module','exports',transpile(resolved))(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(path.join(n.slice(2)),mocks):require(n),mod,mod.exports);return mod.exports}
const ALL=['applications.review','decisions.view','decisions.vote','decisions.start','decisions.manage']
function setup({permissions=ALL,search='cycleId=c1&roundId=r1',setup:setupRead}={}){
 const state=[],effects=[],cleanups=new Map();let cursor=0;const calls=[]
 const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useEffect(fn,deps){const i=cursor++;const prev=state[i];if(!prev||!deps||deps.some((d,k)=>!Object.is(d,prev[k]))){state[i]=deps;effects.push([i,fn])}}}
 const user={id:'u1',memberships:[{clubId:'club',status:'ACTIVE',isOwner:false,accessRole:'MEMBER',permissions}]}
 const mocks={react:hooks,'next/link':{__esModule:true,default:'a'},'next/navigation':{useRouter:()=>({replace(){}}),useSearchParams:()=>new URLSearchParams(search)},
  '@/contexts/auth-context':{useAuth:()=>({user,loading:false})},'@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})},
  '@/lib/voting-room-api':{listLiveVotingRooms:async()=>{calls.push('list');return[]},listVotingSetupDrafts:async()=>[],discardVotingSetupDraft:async()=>{},getLiveVotingSetup:async input=>{calls.push(['setup',input]);return setupRead?setupRead():{rounds:[{id:'r1',name:'First interview'}],applicants:[{id:'a'},{id:'b'},{id:'c'}]}}},
  '@/components/ui/alert-dialog':Object.fromEntries(['AlertDialog','AlertDialogCancel','AlertDialogContent','AlertDialogDescription','AlertDialogFooter','AlertDialogHeader','AlertDialogTitle'].map(n=>[n,n])),
  '@/components/ui/button':{Button:'Button'},'@/components/ui/loading-state':{LoadingState:'LoadingState'}}
 const {VotingRoomLanding}=load('components/live-voting/room-landing.tsx',mocks)
 const render=()=>{cursor=0;return VotingRoomLanding({clubId:'club'})}
 const flush=async()=>{for(let n=0;n<4;n++){for(const[i,fn]of effects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn())}await tick();render()}}
 return {render,flush,calls}
}
const text=node=>node==null||typeof node==='boolean'?'':typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children)
const find=(node,pred)=>{if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const n of node){const r=find(n,pred);if(r)return r}return null}if(pred(node))return node;return find(node.props?.children,pred)}
const empty=tree=>find(tree,n=>n.props&&'data-voting-empty' in n.props)
test('no sessions, a leader and a round in view: the ready count and a button into setup',async()=>{
 const f=setup();f.render();await f.flush();const tree=f.render(),node=empty(tree)
 assert.equal(text(node),'3 applicants in First interview are ready for a vote.Start voting session')
 const link=find(node,n=>n.type==='a');assert.match(link.props.href,/cycleId=c1/);assert.match(link.props.href,/roundId=r1/)
 assert.deepEqual(f.calls.find(c=>c[0]==='setup')[1],{clubId:'club',cycleId:'c1',roundId:'r1'})
})
test('none ready: says so, with no button',async()=>{
 const f=setup({setup:()=>({rounds:[{id:'r1',name:'First interview'}],applicants:[]})});f.render();await f.flush();const node=empty(f.render())
 assert.equal(text(node),'No applicants in First interview are ready for a vote yet.');assert.equal(find(node,n=>n.type==='a'),null)
})
test('voters without setup rights, pages without a round, and failed reads keep the plain empty state with no setup read',async()=>{
 const plain='No voting sessions yet. Start one when applicants are ready for a vote.'
 for(const opts of [{permissions:['applications.review','decisions.vote']},{search:''},{setup:()=>{throw Error('denied')}}]){
  const f=setup(opts);f.render();await f.flush();assert.equal(text(empty(f.render())),plain,JSON.stringify(opts))
  if(!opts.setup)assert.equal(f.calls.filter(c=>c[0]==='setup').length,0,'no setup read')
 }
})

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
// A save that succeeds while both reloads fail shows the saved booking, not the previous one.
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
function hooks(){
 const slots=[],effects=[];let cursor=0
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
 return {react,render:C=>{cursor=0;return C()},async flush(){for(const fn of effects.splice(0))fn();for(let i=0;i<15;i++)await Promise.resolve()}}
}
function load(api){
 const h=hooks(),file=path.resolve('components/interviews/applicant-booking.tsx'),mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
 const jsx=(type,props)=>({type:typeof type==='function'?type.name||'fn':type,props})
 new Function('require','module','exports',code)(n=>n==='react'?h.react:n==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'Fragment'}:n==='@/lib/workspace-api'?api:n==='@/lib/user-message'?{userMessage:(_e,f)=>f}:n==='./booking-picker'?{BookingPicker:'BookingPicker'}:n==='@/contexts/auth-context'?{useAuth:()=>({user:null})}:n==='@/lib/graduation'?{isAlumniProfile:()=>false,ALUMNI_REFUSALS:{}}:{LoadingState:'LoadingState',Button:'Button'},mod,mod.exports)
 return {h,C:mod.exports.ApplicantBooking}
}
const room={id:'room',roundId:'round',name:'A',location:'Rice Hall 120',slots:[{id:'s1',startTime:'2099-01-01T15:00:00Z',endTime:'2099-01-01T15:30:00Z'},{id:'s2',startTime:'2099-01-01T16:00:00Z',endTime:'2099-01-01T16:30:00Z'}]}
const schedule=booking=>({applicationId:'app',clubName:'Club',roundName:'Interviews',rooms:[room],booking,publicationState:'PUBLISHED',allowCancellation:true,allowRescheduling:true})
const held={id:'old',applicationId:'app',slotId:'s1',roomId:'room',roundId:'round',candidate:'You',startTime:room.slots[0].startTime,endTime:room.slots[0].endTime,location:'Rice Hall 120'}
async function setup(){
 let reads=0
 const api={getApplicantSchedule:async()=>{if(reads++>0)throw Error('busy');return schedule(held)},reserveInterview:async()=>({id:'new'}),cancelRoomBooking:async()=>({ok:true})}
 const {h,C}=load(api);const render=()=>h.render(()=>C({applicationId:'app'}));render();await h.flush()
 const picker=()=>nodes(render()).find(n=>n.type==='BookingPicker')
 return {picker}
}
test('a reschedule that saved shows the new time even when the times cannot be reloaded',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const {picker}=await setup();assert.equal(picker().props.booking.slotId,'s1')
 const done=picker().props.onReserve('s2');for(let i=0;i<20;i++)await Promise.resolve();t.mock.timers.tick(1500);await done
 assert.equal(picker().props.booking.slotId,'s2');assert.equal(picker().props.booking.id,'new')
})
test('a cancellation that saved shows no booking even when the times cannot be reloaded',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const {picker}=await setup()
 const done=picker().props.onCancel();for(let i=0;i<20;i++)await Promise.resolve();t.mock.timers.tick(1500);await done
 assert.equal(picker().props.booking,null);assert.equal(picker().props.onCancel,undefined)
})

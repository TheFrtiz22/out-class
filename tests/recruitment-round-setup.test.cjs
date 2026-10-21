const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {harness,id}=require('./helpers/interview-harness.cjs');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function ui(file,name,props,mocks){
 const slots=[],effects=[],cleanups=[];let cursor=0;const cache={};
 const react={useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},useRef(value){const i=cursor++;return slots[i]??=( {current:value})},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 function load(file){if(cache[file])return cache[file];const m={exports:{}};new Function('require','module','exports',compile(file))(n=>n==='react'?react:n==='@/hooks/use-editor-draft'?require('./helpers/autosave-ui-harness.cjs').draftStub:n==='@/hooks/use-autosave'?require('./helpers/autosave-ui-harness.cjs').autosaveHook(react):n in mocks?mocks[n]:n.endsWith('.css')?{}:n==='next/link'?{default:'Link'}:n.startsWith('@/components/')?new Proxy({},{get:(_,k)=>k}):n.startsWith('@/lib/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return cache[file]=m.exports;}
 const component=load(file)[name];return{render(){cursor=0;const result=component(props);effects.splice(0).forEach(fn=>fn());return result},close(){cleanups.forEach(fn=>fn?.())}};
}
function persisted(){
 const h=harness();h.assignments.splice(0);Object.assign(h.round,{name:'Round 2',type:'INTERVIEW',archivedAt:null,order:1,configuration:{duration:20},_count:{applications:0,interviewRooms:0,interviewRecords:0,votingSessions:0,scheduledBookings:0},screeningRule:null});
 const rounds=[{...h.round,id:id(5),name:'Review',type:'APPLICATION_REVIEW',order:0,interviewKit:[]},h.round],club={pipelineVersion:0};let query;
 h.tx.pipelineRound.findMany=async args=>{query=args;return rounds.filter(r=>(!args.where?.clubId||r.clubId===args.where.clubId)&&(!('archivedAt'in(args.where||{}))||r.archivedAt===args.where.archivedAt)&&(!args.where?.type||args.where.type.in.includes(r.type))&&(!args.where?.interviewAssignments||h.assignments.some(a=>a.roundId===r.id&&a.memberId===args.where.interviewAssignments.some.memberId&&!a.revokedAt))).map(r=>({...r,interviewAssignments:h.assignments.filter(a=>a.roundId===r.id&&!a.revokedAt)}));};
 h.tx.pipelineRound.update=async({where,data})=>Object.assign(rounds.find(r=>r.id===where.id),data);
 h.tx.pipelineRound.create=async({data})=>{assert.ok(!rounds.some(r=>r.id===data.id));rounds.push({...data,_count:{},archivedAt:null});};
 h.tx.club={findUniqueOrThrow:async()=>club,update:async()=>{club.pipelineVersion++}};
 const cache={};function load(file){if(cache[file])return cache[file];const m={exports:{}},mocks={'@/utils/prisma':{prisma:{...h.tx,$transaction:fn=>fn(h.tx)}},'@/utils/auth':{requireClubPermission:async()=>({user:{id:id(10)}})},'next/cache':{revalidatePath(){},revalidateTag(){}}};new Function('require','module','exports',compile(file))(n=>n==='@/hooks/use-editor-draft'?require('./helpers/autosave-ui-harness.cjs').draftStub:n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return cache[file]=m.exports;}
 return{h,rounds,club,settings:load('actions/club-settings.ts'),kits:h.load('actions/interview-kits.ts'),get query(){return query}};
}
test('a persisted pipeline interview round is discoverable without applicant assignments, and kit writes preserve its ID',async()=>{
 const p=persisted(),{h,kits}=p;h.members[0].interviewOffices=[];
 await p.settings.savePipelineSettings({clubId:id(1),version:0,rounds:p.rounds.map(r=>({id:r.id,name:r.name,type:r.type,configuration:{duration:20,instructions:'Synthetic instructions'}}))});
 assert.equal(p.rounds.length,2);assert.equal(h.round.configuration.duration,20);
 assert.deepEqual(await kits.getInterviewRounds(id(1)),{status:'ready',rounds:[{id:id(3),name:'Round 2',canReadKit:false}]});
 await assert.rejects(kits.saveInterviewKit(id(1),id(3),0,[{id:id(4),prompt:'Synthetic question',guidance:'Synthetic answer key'}]),/denied/);
 h.members[0].interviewOffices=['BOARD'];const list=await kits.getInterviewRounds(id(1));assert.equal(list.rounds[0].canReadKit,true);
 await kits.saveInterviewKit(id(1),id(3),0,[{id:id(4),prompt:'Synthetic question',guidance:'Synthetic answer key'}]);
 assert.deepEqual(await kits.getInterviewKit(id(1),id(3)),{version:1,questions:[{id:id(4),prompt:'Synthetic question',guidance:'Synthetic answer key'}]});
 assert.equal((await kits.getInterviewRounds(id(1))).rounds[0].id,id(3));assert.equal(p.rounds.length,2);assert.equal(h.state.records.length,0);assert.equal(h.state.evaluations.length,0);
 assert.equal(p.query.where.archivedAt,null);assert.deepEqual(p.query.where.type.in,['INTERVIEW','GROUP_INTERVIEW']);assert.equal(p.query.where.clubId,id(1));
});
test('round discovery distinguishes denial, transport failure, archives and current panel scope without broadening bank access',async()=>{
 const p=persisted(),{h,kits}=p;h.round.archivedAt=new Date();assert.deepEqual((await kits.getInterviewRounds(id(1))).rounds,[]);h.round.archivedAt=null;
 h.as(11);assert.deepEqual((await kits.getInterviewRounds(id(1))).rounds,[]);
 h.assignments.push({id:id(30),applicationId:h.app.id,roundId:h.round.id,memberId:h.members[1].id,revokedAt:null});assert.equal((await kits.getInterviewRounds(id(1))).rounds[0].canReadKit,true);assert.ok(p.query.where.interviewAssignments);
 h.assignments[0].revokedAt=new Date();assert.deepEqual((await kits.getInterviewRounds(id(1))).rounds,[]);
 h.members[1].permissions=[];assert.equal((await kits.getInterviewRounds(id(1))).status,'denied');assert.equal((await kits.getInterviewRounds(id(90))).status,'denied');
 h.as(10);h.tx.pipelineRound.findMany=async()=>{throw Error('Synthetic connection failure')};await assert.rejects(kits.getInterviewRounds(id(1)),/connection failure/);
 h.deny(true);assert.equal((await kits.getInterviewRounds(id(1))).status,'denied');
});
test('round loader reports loading, real empty state, permission denial and failed request distinctly; deep link selects the saved ID',async t=>{
 const before=global.window;global.window={dispatchEvent(){},addEventListener(){},removeEventListener(){},confirm:()=>true,dispatchEvent(){}};t.after(()=>global.window=before);
 const member={clubId:id(1),status:'ACTIVE',isOwner:true,interviewOffices:['BOARD']},auth={'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[member]}})}};
 for(const [result,expected]of [[{status:'ready',rounds:[]},/No active interview rounds/],[{status:'denied',rounds:[]},/access denied/],[Error('Synthetic unavailable'),/Could not load interview rounds/]]){
  const h=ui('components/interview-kit-editor.tsx','ClubInterviewKitSettings',{clubId:id(1)},{...auth,'@/lib/workspace-api':{getInterviewRounds:async()=>{if(result instanceof Error)throw result;return result}}});
  assert.match(text(h.render()),/Loading interview rounds/);await flush();const value=text(h.render());assert.match(value,expected);if(result.status!=='ready')assert.doesNotMatch(value,/No active|Create a recruitment/);h.close();
 }
 const requests=[],list={status:'ready',rounds:[{id:id(2),name:'First interviews',canReadKit:true},{id:id(3),name:'Round 2',canReadKit:true}]},api={getInterviewRounds:async()=>list,getInterviewKit:async(c,r)=>{requests.push([c,r]);return{version:7,questions:[]}}};
 const loader=ui('components/interview-kit-editor.tsx','ClubInterviewKitSettings',{clubId:id(1),initialRoundId:id(3)},{...auth,'@/lib/workspace-api':api});loader.render();await flush();const editor=loader.render();assert.equal(editor.props.initialRoundId,id(3));
 const kit=ui('components/interview-kit-editor.tsx','RoundKitEditor',{clubId:id(1),roundInfo:list.rounds[1],initiallyOpen:true},{...auth,'@/lib/workspace-api':api});kit.render();await flush();assert.deepEqual(requests,[[id(1),id(3)]]);assert.match(text(kit.render()),/Round 2/);loader.close();kit.close();
});
test('an owner lacking an office sees the saved round and access setup rather than issuing an unauthorized kit read',async t=>{
 const before=global.window;global.window={dispatchEvent(){},addEventListener(){},removeEventListener(){}};t.after(()=>global.window=before);let reads=0;
 const h=ui('components/interview-kit-editor.tsx','RoundKitEditor',{clubId:id(1),roundInfo:{id:id(3),name:'Round 2',canReadKit:false}},{'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[{clubId:id(1),status:'ACTIVE',isOwner:true,interviewOffices:[]}]}})},'@/lib/workspace-api':{getInterviewKit:async()=>{reads++}}});
 const tree=h.render();await flush();assert.match(text(tree),/This round is saved/);assert.equal(reads,0);const link=nodes(tree).find(n=>n.type==='Link');const url=new URL(link.props.href,'https://example.test');assert.equal(url.searchParams.get('roundId'),id(3));assert.equal(url.searchParams.get('interviewTab'),'access');assert.equal(nodes(tree).some(n=>n.type==='Textarea'),false);h.close();
});
test('pipeline configuration link targets the exact persisted round and successful saves refresh setup through its existing callback',async t=>{
 const before=global.window;global.window={dispatchEvent(){},addEventListener(){},removeEventListener(){},confirm:()=>true};t.after(()=>global.window=before);let saved=0,payload;
 const props={clubId:id(1),onSaved:()=>saved++},api={getPipelineSettings:async()=>({pipelineVersion:2,pipelineRounds:[{id:id(2),name:'Review',type:'APPLICATION_REVIEW',archivedAt:null,anonymousReview:false,configuration:{}},{id:id(3),name:'Round 2',type:'INTERVIEW',archivedAt:null,anonymousReview:false,configuration:{duration:20}}]}),savePipelineSettings:async input=>{payload=input;return{version:3}}};
 const h=ui('components/views/club-manager/interview-pipeline-builder-view.tsx','InterviewPipelineBuilderView',props,{'@/lib/workspace-api':{getPipelineInterviewStatus:async()=>[],...api},'@/lib/workspace-read':api,'@/actions/club-settings':api,'@/contexts/auth-context':{useAuth:()=>({activeClubId:id(1),user:{memberships:[{clubId:id(1),isOwner:true}]}})},'@/contexts/demo-context':{useDemoMode:()=>({ready:true,isDemoEnabled:false})}});
 h.render();await flush();let tree=h.render();const link=nodes(tree).find(n=>n.type==='PipelineInterviewStatus');const href=ui('components/interviews/pipeline-interview-status.tsx','PipelineInterviewStatus',link.props,{}).render();const url=new URL(nodes(href).find(n=>n.type==='Link').props.href,'https://example.test');assert.equal(url.searchParams.get('roundId'),id(3));assert.equal(url.searchParams.get('interviewTab'),'kits');
 nodes(tree).find(n=>n.type==='Button'&&text(n).startsWith('Manage round')&&text(n).includes('Round 2')).props.onClick();tree=h.render();const composer=nodes(tree).find(n=>n.type?.name==='RoundComposer');await composer.props.onSave({...composer.props.source,configuration:{...composer.props.source.configuration,duration:25}});await flush();assert.equal(saved,1,text(h.render()));assert.equal(payload.rounds[1].id,id(3));assert.equal(payload.rounds[1].configuration.duration,25);h.close();
});
test('Demo fresh and saved fixtures discover by stable type/ID and persist kits with zero live calls',async()=>{
 const {harness}=require('./helpers/demo-harness.cjs'),h=harness(),{demoStore,DEMO_KEY}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts');demoStore.start();const club=demoStore.get().clubs[0];demoStore.mutate(s=>s.perspective={role:'leader',clubId:club.id});
 const round=(await api.getInterviewRounds(club.id)).rounds[0];assert.ok(round);await api.saveInterviewKit(club.id,round.id,0,[{id:id(80),prompt:'Synthetic demo question',guidance:'Synthetic demo key'}]);
 const stored=JSON.parse(localStorage.getItem(DEMO_KEY));for(const c of stored.clubs)for(const r of c.rounds)delete r.type;stored.clubs[0].rounds.find(r=>r.id===round.id).name='Renamed sample stage';localStorage.setItem(DEMO_KEY,JSON.stringify(stored));demoStore.stop();demoStore.start();
 assert.ok((await api.getInterviewRounds(club.id)).rounds.some(r=>r.id===round.id));assert.equal((await api.getInterviewKit(club.id,round.id)).questions[0].guidance,'Synthetic demo key');assert.equal(h.calls(),0);demoStore.stop();
});
test('both setup entry points admit explicit kit editors and pipeline managers without granting scheduling or kit-edit privileges',()=>{
 const h=harness(),{availableSettings}=h.load('lib/club-settings.ts'),{hasPermission}=h.load('lib/permissions.ts'),{interviewCapabilities}=h.load('lib/interview-access.ts');
 const board={status:'ACTIVE',permissions:[],interviewOffices:['BOARD']},manager={status:'ACTIVE',permissions:['recruitment.manage'],interviewOffices:[]};
 for(const m of [board,manager])assert.ok(availableSettings(m).some(s=>s.id==='interviews'));
 assert.equal(hasPermission(board,'interviews.manage'),false);assert.equal(interviewCapabilities(manager).editKit,false);assert.equal(availableSettings({...board,status:'INACTIVE'}).length,0);
});

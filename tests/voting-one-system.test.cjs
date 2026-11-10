// One voting system (FE-27): voting rooms are canonical. Board (LEGACY) sessions stay visible as
// read-only history, the one open LEGACY session can be closed with the existing close transitions and
// capabilities, old /vote, /live-voting and board join links redirect, and the retired modules are gone.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {harness,load,uuid,clubId,ids,sessionId,memberId,otherId}=require('./helpers/voting-harness.cjs');

const removed=['components/live-voting/board-decision-mode.tsx','components/live-voting/legacy-voting-page.tsx','components/live-voting/session-join.tsx','components/live-voting/member-voting-pad.tsx','components/live-voting/mobile-join-screen.tsx','components/live-voting/proctor-presentation-view.tsx','components/live-voting/voting-lobby.tsx','components/live-voting/live-voting-launcher.tsx','components/live-voting/voting-mode.css','lib/use-live-voting.ts','lib/live-voting.ts'];
const sourceFiles=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'||e.name.startsWith('.')?[]:e.isDirectory()?sourceFiles(path.join(dir,e.name)):/\.(tsx?|css|mjs|cjs|js)$/.test(e.name)?[path.join(dir,e.name)]:[]);

test('fs scan: the retired board and BroadcastChannel modules are deleted and nothing imports them',()=>{
 for(const file of removed)assert.equal(fs.existsSync(file),false,file);
 const importer=/(board-decision-mode|legacy-voting-page|live-voting\/session-join|member-voting-pad|mobile-join-screen|proctor-presentation-view|voting-lobby|live-voting-launcher|voting-mode\.css|use-live-voting["']|lib\/live-voting["'])/;
 const offenders=['app','components','lib','utils','actions','hooks','contexts','middleware.ts'].filter(fs.existsSync).flatMap(p=>fs.statSync(p).isDirectory()?sourceFiles(p):[p]).filter(f=>importer.test(fs.readFileSync(f,'utf8')));
 assert.deepEqual(offenders,[]);
 const pipeline=fs.readFileSync('components/views/leader-dashboard/live-leader-workspace.tsx','utf8'),landing=fs.readFileSync('components/live-voting/room-landing.tsx','utf8');
 assert.doesNotMatch(pipeline,/BoardDecisionMode|board-decision-mode|Voting history/,'the pipeline no longer imports or opens the board');
 assert.doesNotMatch(landing,/BoardDecisionMode|board-decision-mode/,'the Voting room no longer opens the board dialog');
 assert.doesNotMatch(fs.readFileSync('components/views/leader-dashboard/local-leader-dashboard.tsx','utf8'),/LiveVotingLauncher/);
 assert.doesNotMatch(fs.readFileSync('lib/workspace-api.ts','utf8'),/createVotingSession|submitVotingBallot|joinVotingSession|getJoinedVotingWorkspace|getVotingJoinInfo|seedVotingDemo/);
 assert.doesNotMatch(fs.readFileSync('app/api/workspace/route.ts','utf8'),/votingJoin|getVotingJoinInfo/);
 const actions=fs.readFileSync('actions/voting.ts','utf8');
 assert.deepEqual([...actions.matchAll(/^export async function (\w+)/gm)].map(m=>m[1]),['getVotingWorkspace','commandVotingSession'],'only the history read and the close command remain');
});

test('every link into a board session opens its read-only history; live rooms are unchanged',()=>{
 const nav=load('lib/voting-navigation.ts');
 assert.equal(nav.votingSessionHref(clubId,{id:sessionId,mode:'LEGACY'}),`/voting/rooms/${sessionId}/history?clubId=${clubId}`);
 assert.equal(nav.votingSessionHref(clubId,{id:sessionId,mode:'LEGACY'},'leader',true),`/voting/rooms/${sessionId}/history?clubId=${clubId}&demo=1`);
 assert.equal(nav.votingSessionHref(clubId,{id:sessionId,mode:'LIVE'},'leader'),`/voting/rooms/${sessionId}?clubId=${clubId}&view=leader`);
 const landing=fs.readFileSync('components/live-voting/room-landing.tsx','utf8');
 assert.match(landing,/legacyVotingHistoryHref\(clubId,legacyId,demo\.isDemoEnabled\)/,'old decisionTab=voting&sessionId links are forwarded to the history');
 assert.match(fs.readFileSync('components/club-home/club-home-model.ts','utf8'),/votingSessionHref\(/,'the recruiting overview deep link uses the shared href');
});

// Resolver: same verified-viewer and ACTIVE-membership gate as before, now mapping both modes.
function resolver({user=memberId,demo=false}={}){
 const sessions={[sessionId]:{clubId,mode:'LEGACY'},[uuid(70)]:{clubId,mode:'LIVE'}};
 const db={user:{findUnique:async({where})=>({id:where.id,disabledAt:null})},votingSession:{findFirst:async({where})=>{const s=sessions[where.id];if(!s||where.mode)return null;return where.club.members.some.userId===memberId?s:null}}};
 return load('utils/legacy-voting-link.ts',{'server-only':{},'next/headers':{cookies:async()=>({get:n=>n==='outclass-demo-session'&&demo?{value:'1'}:undefined,has:()=>false})},'@/lib/demo/access':{DEMO_COOKIE:'outclass-demo-session'},'@/lib/platform-view-as':{PLATFORM_VIEW_COOKIE:'outclass-platform-view'},'@/utils/auth':{getSessionUser:async()=>({data:{user:user?{id:user,email:'member@virginia.edu',email_confirmed_at:'2026-01-01T00:00:00Z'}:null},error:null})},'@/utils/prisma':{prisma:db}}).liveRoomHrefForLegacyLink;
}
function page(file,href){
 const calls=[];const redirect=to=>{calls.push(['redirect',to]);throw Object.assign(Error('NEXT_REDIRECT'),{to})};
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n==='next/navigation'?{redirect}:n==='@/utils/legacy-voting-link'?{liveRoomHrefForLegacyLink:async id=>{calls.push(['resolve',id]);return href(id)}}:n==='@/components/live-voting/voting-link-moved'?{VotingLinkMoved:function VotingLinkMoved(){}}:n==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:require(n),mod,mod.exports);
 return{calls,render:async args=>{try{return await mod.exports.default(args)}catch(e){if(e.message==='NEXT_REDIRECT')return{redirected:e.to};throw e}}};
}

test('/vote and /live-voting redirect a QR-style ?session= link to the voting-room equivalent; unmapped links get one generic page',async()=>{
 const r=resolver();
 assert.equal(await r(sessionId),`/voting/rooms/${sessionId}/history?clubId=${clubId}`,'a board session maps to its history');
 assert.equal(await r(uuid(70)),`/voting/rooms/${uuid(70)}?clubId=${clubId}`,'a live room maps to the room');
 assert.equal(await r(uuid(71)),null);assert.equal(await r('demo-session-1'),null);
 assert.equal(await resolver({user:otherId+'x'})(sessionId),null,'a non-member learns nothing');
 assert.equal(await resolver({demo:true})(sessionId),null,'Demo never resolves production sessions');
 assert.equal(fs.readFileSync('app/(focus)/vote/page.tsx','utf8').trim(),'export { default } from "@/app/(focus)/live-voting/page"');
 const mapped=page('app/(focus)/live-voting/page.tsx',id=>`/voting/rooms/${id}/history?clubId=${clubId}`);
 assert.deepEqual(await mapped.render({searchParams:Promise.resolve({session:sessionId})}),{redirected:`/voting/rooms/${sessionId}/history?clubId=${clubId}`});
 assert.deepEqual(mapped.calls[0],['resolve',sessionId],'the QR query value is what gets resolved');
 const unmapped=page('app/(focus)/live-voting/page.tsx',()=>null);
 const tree=await unmapped.render({searchParams:Promise.resolve({session:'demo-session-1'})});
 assert.equal(tree.type.name,'VotingLinkMoved');assert.equal(tree.props.next,'/live-voting?session=demo-session-1','sign-in returns to the original link');
 assert.equal((await unmapped.render({searchParams:Promise.resolve({})})).props.next,'/live-voting');
 const source=fs.readFileSync('app/(focus)/live-voting/page.tsx','utf8');assert.doesNotMatch(source,/^"use client"|BroadcastChannel|localStorage/m);
});

test('printed board join QR codes and short links redirect; Demo join links never read production',async()=>{
 const join=page('app/(focus)/voting/[sessionId]/join/page.tsx',id=>`/voting/rooms/${id}/history?clubId=${clubId}`);
 assert.deepEqual(await join.render({params:Promise.resolve({sessionId}),searchParams:Promise.resolve({})}),{redirected:`/voting/rooms/${sessionId}/history?clubId=${clubId}`});
 const demo=page('app/(focus)/voting/[sessionId]/join/page.tsx',()=>{throw Error('production read')});
 const tree=await demo.render({params:Promise.resolve({sessionId}),searchParams:Promise.resolve({demo:'1'})});
 assert.equal(tree.type.name,'VotingLinkMoved');assert.equal(demo.calls.length,0);
 assert.ok(fs.readFileSync('lib/short-links.ts','utf8').includes('/join(\\\\?demo=1)?$'),'existing short links to board join paths stay resolvable');
});

// The history view, rendered with the real server read and close command over the fake database.
function historyView(h,{demoScoped=false,api,clubId:club=clubId,sessionId:session=sessionId}={}){
 const slots=[],effects=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useCallback(fn,deps){const i=cursor++,prev=slots[i];if(!prev||deps.some((v,j)=>v!==prev.deps[j]))slots[i]={fn,deps};return slots[i].fn},useEffect(fn,deps){const i=cursor++,prev=slots[i];if(!prev||deps.some((v,j)=>v!==prev[j])){slots[i]=deps;effects.push(fn)}}};
 const named=name=>({[name]:function(){}})[name];
 const ui=names=>Object.fromEntries(names.map(n=>[n,named(n)]));
 const mocks={react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'Fragment'},'next/link':{default:named('Link')},'@/contexts/auth-context':{useAuth:()=>({loading:false,user:{id:'viewer'}})},
  '@/lib/workspace-api':api??{getVotingWorkspace:(c,s)=>h.api.getVotingWorkspace(c,s),commandVotingSession:input=>h.api.commandVotingSession(input)},
  '@/lib/voting-navigation':load('lib/voting-navigation.ts'),'@/lib/voting-presentation':{votingSessionStage:s=>s.state},'@/lib/copy/terms':{formatDateTime:v=>String(v)},
  '@/components/ui/page-header':ui(['PageHeader']),'@/components/ui/button':ui(['Button']),'@/components/ui/loading-state':ui(['LoadingState']),'@/components/ui/alert-dialog':ui(['AlertDialog','AlertDialogCancel','AlertDialogContent','AlertDialogDescription','AlertDialogFooter','AlertDialogHeader','AlertDialogTitle'])};
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('components/live-voting/legacy-voting-history.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:require(n),mod,mod.exports);
 const flush=()=>new Promise(r=>setImmediate(r));
 return{async render(){for(let i=0;i<4;i++){cursor=0;var tree=mod.exports.LegacyVotingHistory({clubId:club,sessionId:session,demoScoped});const run=effects.splice(0);for(const fn of run)fn();await flush();await flush()}cursor=0;return mod.exports.LegacyVotingHistory({clubId:club,sessionId:session,demoScoped})}};
}
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)],text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
const find=(tree,type,label)=>nodes(tree).find(n=>n.type?.name===type&&(!label||text(n).includes(label)));

test('LEGACY history renders outcomes for an authorized leader and is denied for a non-member and a non-participant voter',async()=>{
 const h=harness();h.seed({ballots:[{applicationId:ids[0],memberId,decision:'PASS'}]});
 const data=await h.read();
 assert.equal(data.session.id,sessionId);assert.deepEqual(data.candidateLabels.map(c=>c.label),['Avery Applicant','Avery Applicant','Avery Applicant']);
 assert.ok(data.session.passes[0].candidates.every(c=>c.ballots.every(b=>b.memberId===memberId)),'only the viewer\'s own ballot leaves the server');
 const tree=await historyView(h).render();const page=text(tree);
 assert.match(page,/read-only|Outcomes/);assert.match(page,/Avery Applicant/);assert.match(page,/Pass 1 · 1 of 1 ballots/);
 assert.match(page,/This session was not closed/);assert.ok(find(tree,'Button','Close session'),'a leader with start and finish rights can close it');
 // A member of another club.
 h.members.push({id:uuid(60),userId:uuid(60),clubId:uuid(61),status:'ACTIVE',permissions:['applications.review','decisions.view','decisions.manage','decisions.start','decisions.finish'],user:{email:'other@virginia.edu'}});
 h.as(uuid(60));await assert.rejects(h.read(),/Denied/);
 const denied=text(await historyView(h).render());assert.match(denied,/don’t have access/);assert.doesNotMatch(denied,/Avery|Outcomes/);
 h.as(otherId);await assert.rejects(h.read(),/not a session participant/,'a voter who did not take part sees nothing, as before');
 h.members[1].permissions=['applications.review'];await assert.rejects(h.read(),/Voting access required/);
});

test('names follow identification rules: anonymous rounds, missing applicants.identify or a nameless display use the anonymous label',async()=>{
 const h=harness();h.seed();h.members[0].permissions=h.members[0].permissions.filter(p=>p!=='applicants.identify');
 assert.ok((await h.read()).candidateLabels.every(c=>/^Applicant [0-9A-F]{10}$/.test(c.label)));
 const g=harness();const s=g.seed();s.displayConfig={version:1,fields:['major']};
 assert.ok((await g.read()).candidateLabels.every(c=>c.label.startsWith('Applicant ')));
});

test('the open LEGACY session closes with the existing transitions and authorization; nothing else can change it',async()=>{
 const h=harness();h.seed({participants:[memberId,otherId],ballots:[{applicationId:ids[0],memberId,decision:'PASS'}]});
 // A voter without decisions.start cannot close it, from the UI or by calling the action.
 h.as(otherId);await assert.rejects(h.api.commandVotingSession({clubId,sessionId,revision:3,action:'COMPLETE_PASS'}),/Denied/);
 h.members[1].permissions.push('decisions.view');const voterView=await historyView(h).render();
 assert.equal(find(voterView,'Button','Close session'),undefined);assert.match(text(voterView),/A club leader who can start and finish voting can close it/);
 // decisions.start without decisions.finish: completing the pass is allowed, finishing is not (same split as before).
 h.as(memberId);const leader=h.members[0];leader.permissions=leader.permissions.filter(p=>p!=='decisions.finish');
 for(const action of ['START_PASS','PUBLISH','REOPEN','OVERRIDE','CONFIGURE','OPEN_JOIN','SET_CANDIDATE','PAUSE','RESUME'])
  await assert.rejects(h.api.commandVotingSession({clubId,sessionId,revision:3,action,applicationIds:[ids[0]],applicationId:ids[0],decision:'PASS',reason:'x',targetSize:2}),/read-only|Invalid|invalid|Expected|Required/,action);
 await assert.rejects(h.api.commandVotingSession({clubId,sessionId,revision:2,action:'COMPLETE_PASS'}),/Session changed/,'stale revisions are refused');
 const step=await h.api.commandVotingSession({clubId,sessionId,revision:3,action:'COMPLETE_PASS'});assert.equal(step.revision,4);
 await assert.rejects(h.api.commandVotingSession({clubId,sessionId,revision:4,action:'FINISH'}),/Denied/);
 leader.permissions.push('decisions.finish');
 assert.deepEqual(await h.api.commandVotingSession({clubId,sessionId,revision:4,action:'FINISH'}),{success:true,revision:5});
 const s=h.state().sessions[0];assert.equal(s.state,'COMPLETED');assert.ok(s.endedAt);assert.equal(s.passes[0].state,'COMPLETED');
 assert.equal(s.passes[0].candidates[0].ballots.length,1,'ballots already cast are kept');assert.equal(h.state().apps.every(a=>a.status==='IN_REVIEW'),true,'application statuses do not change');
 assert.deepEqual(h.state().audit.map(a=>a.action),['voting.complete_pass','voting.finish']);
 await assert.rejects(h.api.commandVotingSession({clubId,sessionId,revision:5,action:'FINISH'}),/Complete the pass/,'a closed session stays closed');
});

test('the close button runs complete-pass then finish against the current revision, and a closed session shows no controls',async()=>{
 const h=harness();h.seed();const tree=await historyView(h).render();
 assert.ok(find(tree,'Button','Close session'));
 const source=fs.readFileSync('components/live-voting/legacy-voting-history.tsx','utf8');
 assert.match(source,/action: "COMPLETE_PASS" \}\)\)\.revision/);assert.match(source,/action: "FINISH" \}\)/);
 assert.doesNotMatch(source,/START_PASS|PUBLISH|OVERRIDE|REOPEN|submitVotingBallot|BroadcastChannel|localStorage/);
 const confirm=nodes(tree).find(n=>n.type?.name==='Button'&&String(n.props.onClick).includes('close()'));
 confirm.props.onClick();for(let i=0;i<50&&h.state().sessions[0].state!=='COMPLETED';i++)await new Promise(r=>setImmediate(r));
 assert.equal(h.state().sessions[0].state,'COMPLETED');assert.deepEqual(h.state().audit.map(a=>a.action),['voting.complete_pass','voting.finish']);
 const after=await historyView(h).render();assert.equal(find(after,'Button','Close session'),undefined);assert.doesNotMatch(text(after),/not closed/);
});

test('Demo keeps its own isolated history and the same close-only command',()=>{
 const demo=fs.readFileSync('lib/demo/voting.ts','utf8');
 assert.match(demo,/\["COMPLETE_PASS","FINISH"\]\.includes\(d\.action\)\)throw Error\("Board voting sessions are read-only/);
 assert.doesNotMatch(demo,/export async function (createVotingSession|submitVotingBallot|seedVotingDemo|joinVotingSession|getVotingJoinInfo|getJoinedVotingWorkspace)/);
 assert.doesNotMatch(demo,/^import (?!type )[^\n]*@\/actions\/voting"/m);assert.match(demo,/import type \* as Live from "@\/actions\/voting"/,'Demo imports only types from the server module');
 const history=fs.readFileSync('components/live-voting/legacy-voting-history.tsx','utf8');assert.match(history,/from "@\/lib\/workspace-api"/,'reads and the close command go through the Demo-aware adapter');
});

const anonymousLabel=/^Applicant [0-9A-F]{10}$/;
test('server labels: an anonymous round, a viewer without applicants.identify and a display without names all fall back; only the identified case shows names',async()=>{
 const named=harness();named.seed();assert.deepEqual((await named.read()).candidateLabels.map(c=>c.label),['Avery Applicant','Avery Applicant','Avery Applicant'],'positive case');
 const anon=harness({anonymous:true});anon.seed();assert.ok(anon.members[0].permissions.includes('applicants.identify'),'the viewer can identify applicants elsewhere');
 const anonLabels=(await anon.read()).candidateLabels;assert.ok(anonLabels.every(c=>anonymousLabel.test(c.label)),'an anonymous round never shows names, even to an identifying viewer');
 const page=text(await historyView(anon).render());assert.doesNotMatch(page,/Avery/);for(const c of anonLabels)assert.ok(page.includes(c.label),'the rendered history uses the anonymous labels');
 const noIdentify=harness();noIdentify.seed();noIdentify.members[0].permissions=noIdentify.members[0].permissions.filter(p=>p!=='applicants.identify');
 assert.ok((await noIdentify.read()).candidateLabels.every(c=>anonymousLabel.test(c.label)));
 const hidden=harness();hidden.seed().displayConfig={version:1,fields:['major','gpa']};
 assert.ok((await hidden.read()).candidateLabels.every(c=>anonymousLabel.test(c.label)));
});

test('closing is refused without applications.review, and on an archived round the button is hidden and the server refuses',async()=>{
 const h=harness();h.seed();h.members[0].permissions=h.members[0].permissions.filter(p=>p!=='applications.review');
 for(const action of ['COMPLETE_PASS','FINISH'])await assert.rejects(h.api.commandVotingSession({clubId,sessionId,revision:3,action}),/Denied/,action);
 assert.equal(h.state().sessions[0].state,'OPEN');assert.deepEqual(h.state().audit,[]);
 const archived=harness({archived:true});archived.seed();const tree=await historyView(archived).render();
 assert.equal(find(tree,'Button','Close session'),undefined);assert.match(text(tree),/round is archived/);
 await assert.rejects(archived.api.commandVotingSession({clubId,sessionId,revision:3,action:'COMPLETE_PASS'}),/Archived voting rounds are read-only/);
 assert.equal(archived.state().sessions[0].state,'OPEN');
});

test('if FINISH fails after the pass was completed, the view reloads and a retry sends FINISH only',async()=>{
 const h=harness();h.seed();const sent=[];let failFinish=true;
 const api={getVotingWorkspace:(c,s)=>h.api.getVotingWorkspace(c,s),commandVotingSession:async input=>{sent.push(input.action);if(input.action==='FINISH'&&failFinish){failFinish=false;throw Error('Temporary database error.')}return h.api.commandVotingSession(input)}};
 const view=historyView(h,{api});let tree=await view.render();
 const retry=()=>nodes(tree).find(n=>n.type?.name==='Button'&&String(n.props.onClick).includes('close()'));
 retry().props.onClick();for(let i=0;i<50&&!sent.includes('FINISH');i++)await new Promise(r=>setImmediate(r));
 tree=await view.render();
 assert.deepEqual(sent,['COMPLETE_PASS','FINISH']);assert.equal(h.state().sessions[0].state,'PAUSED');assert.equal(h.state().sessions[0].passes[0].state,'COMPLETED');
 assert.match(text(tree),/open pass was completed, but the session was not closed\. Temporary database error\. Try again\./);
 retry().props.onClick();for(let i=0;i<50&&h.state().sessions[0].state!=='COMPLETED';i++)await new Promise(r=>setImmediate(r));
 assert.deepEqual(sent,['COMPLETE_PASS','FINISH','FINISH'],'the retry sends FINISH only, with the reloaded revision');
 assert.equal(h.state().sessions[0].state,'COMPLETED');assert.deepEqual(h.state().audit.map(a=>a.action),['voting.complete_pass','voting.finish']);
 // A failure before anything changed asks for a reload.
 const g=harness();g.seed();const failing={getVotingWorkspace:(c,s)=>g.api.getVotingWorkspace(c,s),commandVotingSession:async()=>{throw Error('Session changed.')}};
 const other=historyView(g,{api:failing});let t=await other.render();nodes(t).find(n=>n.type?.name==='Button'&&String(n.props.onClick).includes('close()')).props.onClick();
 for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));t=await other.render();assert.match(text(t),/Session changed\. Reload to continue\./);
});

function demoWorkspace(){
 const d=require('./helpers/demo-harness.cjs').harness(),{demoStore}=d.load('lib/demo/store.ts');let fetches=0;const fetch=global.fetch;global.fetch=async()=>{fetches++;throw Error('network used')};
 demoStore.start();const club=demoStore.get().clubs[0].id;demoStore.mutate(s=>{s.perspective={role:'leader',clubId:club}});
 const session=demoStore.get().votingSessions.find(s=>s.clubId===club&&s.mode==='LEGACY'&&s.state==='OPEN');
 return{d,demoStore,club,session,fetches:()=>fetches,restore:()=>{global.fetch=fetch}};
}

test('Demo history labels follow the server rule: identify capability, a non-anonymous round and a name display',async()=>{
 const w=demoWorkspace();try{
  const demo=w.d.load('lib/demo/voting.ts'),{hasPermission}=w.d.load('lib/permissions.ts'),state=w.demoStore.get();
  const leader=(await demo.getVotingWorkspace(w.club,w.session.id)).memberId;
  assert.ok(hasPermission(state.memberships.find(m=>m.id===leader),'applicants.identify'));
  const names=(await demo.getVotingWorkspace(w.club,w.session.id)).candidateLabels;assert.ok(names.every(c=>!anonymousLabel.test(c.label)),'positive case shows names');
  const plain=state.memberships.find(m=>m.clubId===w.club&&m.id!==leader&&!m.isOwner);plain.permissions=plain.permissions.filter(p=>p!=='applicants.identify');assert.equal(hasPermission(plain,'applicants.identify'),false);
  assert.ok((await demo.getVotingWorkspace(w.club,w.session.id,true,plain.id)).candidateLabels.every(c=>anonymousLabel.test(c.label)),'no identify: anonymous');
  w.session.displayConfig={version:1,fields:['major']};
  assert.ok((await demo.getVotingWorkspace(w.club,w.session.id)).candidateLabels.every(c=>anonymousLabel.test(c.label)),'no name display: anonymous');
  w.session.displayConfig={};const round=state.clubs[0].rounds.find(r=>r.id===w.session.roundId);round.anonymousReview=true;
  assert.ok((await demo.getVotingWorkspace(w.club,w.session.id)).candidateLabels.every(c=>anonymousLabel.test(c.label)),'anonymous round: anonymous');
  assert.equal(w.d.calls(),0);assert.equal(w.fetches(),0);
 }finally{w.restore()}
});

test('with demo=1 the history page and its close command never reach the server or the database',async()=>{
 const w=demoWorkspace();try{
  const api=w.d.load('lib/workspace-api.ts');
  // The route page itself only validates the IDs and renders the client view.
  const pageMod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/(focus)/voting/rooms/[sessionId]/history/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n==='@/utils/prisma'?(()=>{throw Error('prisma imported')})():n==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:n.endsWith('.css')?{}:n==='zod'?require('zod'):{PageHeader:function PageHeader(){},LegacyVotingHistory:function LegacyVotingHistory(){}},pageMod,pageMod.exports);
  const element=await pageMod.exports.default({params:Promise.resolve({sessionId:w.session.id}),searchParams:Promise.resolve({clubId:w.club,demo:'1'})});
  assert.equal(element.type.name,'LegacyVotingHistory');assert.equal(element.props.demoScoped,true);
  assert.doesNotMatch(fs.readFileSync('app/(focus)/voting/rooms/[sessionId]/history/page.tsx','utf8'),/utils\/prisma|actions\//);
  const tree=await historyView(null,{api,demoScoped:true,clubId:w.club,sessionId:w.session.id}).render();
  assert.match(text(tree),/This session was not closed/);const button=nodes(tree).find(n=>n.type?.name==='Button'&&String(n.props.onClick).includes('close()'));assert.ok(button);
  button.props.onClick();for(let i=0;i<50&&w.session.state!=='COMPLETED';i++)await new Promise(r=>setImmediate(r));
  assert.equal(w.demoStore.get().votingSessions.find(s=>s.id===w.session.id).state,'COMPLETED','Demo closes in the Demo store');
  assert.equal(w.d.calls(),0,'no server action was invoked');assert.equal(w.fetches(),0,'no workspace read reached the server');
 }finally{w.restore()}
});

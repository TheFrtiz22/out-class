const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function compile(file, mocks = {}, extra = '') {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', code)(name => mocks[name] || (name==='@/hooks/use-editor-draft'?require('./helpers/autosave-ui-harness.cjs').draftStub:name==='@/hooks/use-pipeline-page'?compile('hooks/use-pipeline-page.ts',mocks):name==='@/hooks/use-list-sort'?compile('hooks/use-list-sort.ts',mocks):name.startsWith('@/lib/') ? compile(name.replace('@/', '') + '.ts') : name.startsWith('@/') || name.startsWith('./') ? new Proxy({}, { get: (_, key) => String(key) }) : require(name)), mod, mod.exports, { addEventListener(){}, removeEventListener(){}, confirm(){ return true } }, () => {}, () => {})
  return mod.exports
}
const { applicantLane } = compile('lib/applicant-board.ts')
test('live board lanes are status-based, exclude drafts, and keep waitlists distinct from closed decisions', () => {
  for (const [status, lane] of Object.entries({SUBMITTED:'review',IN_REVIEW:'review',INTERVIEWING:'interview',WAITLISTED:'decision',ACCEPTED:'closed',REJECTED:'closed'})) assert.equal(applicantLane(status), lane)
  assert.equal(applicantLane('DRAFTING'), null)
  assert.equal(applicantLane('Custom final round'), null)
})
function nodes(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : ''
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness(permissions = ['applications.review','applicants.identify','decisions.manage','recruitment.manage'], decisionsOnly = false, rejectedOnly = false) {
  const slots = [], effects = [], calls = [], lookups = [], setups = new Map(), cleanups = new Map()
  let changed = false, index = 0, pipeline = { rounds: [{id:'round',name:'Review',order:0}], applications:[{id:'candidate',canEvaluate:true,studentId:'student',roundId:'round',status:'IN_REVIEW',student:{email:'sample@demo.invalid',studentProfile:null},evaluations:[],answers:[],bookings:[]}] }
  const react = {useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;changed ||= !Object.is(next,slots[i]);slots[i]=next}]},useRef(initial){const i=index++;return slots[i]??=( {current:initial})},useMemo(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,value:fn()};return slots[i].value},useCallback(fn,deps){return react.useMemo(()=>fn,deps)},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;setups.set(i,fn);effects.push([i,fn])}},useLayoutEffect(fn){const i=index++;setups.set(i,fn);effects.push([i,fn])}}
  const api = {getClubPipelineList:async()=>{calls.push(['load']);return structuredClone(pipeline)},setApplicationStatus:async input=>{calls.push(['status',input]);const target=pipeline.applications.find(app=>app.id===input.applicationId);if(input.expectedStatus!==target.status)throw Error('stale');target.status=input.status;if(input.status==='ACCEPTED')target.recruitmentOffer={status:'PENDING',expiresAt:new Date(Date.now()+86400000)};return {success:true}},moveApplicantRound:async input=>{calls.push(['round',input]);if(input.expectedRoundId!==pipeline.applications[0].roundId)throw Error('stale');pipeline.applications[0].roundId=input.newRoundId;pipeline.applications[0].studentId='anonymous-candidate';pipeline.applications[0].student={email:'',studentProfile:{firstName:'Applicant',lastName:'CANDIDATE',experiences:[]}};return {success:true}},submitEvaluation:async input=>{calls.push(['review',input]);const evaluation={id:'evaluation',interviewerId:'member',round:'Review',score:input.score,notes:input.notes};pipeline.applications[0].evaluations=[evaluation];pipeline.applications[0].canEvaluate=false;return {evaluation}}}
  let currentEpoch={};const auth={user:{id:'reviewer'},readAuthority:currentEpoch,isReadAuthorityCurrent:value=>value===currentEpoch};
  api.getClubPipelinePage=async(club,q={})=>{const data=await api.getClubPipelineList();const page=compile('lib/pipeline-page.ts').pagePipeline(data,q,'member','reviewer','fixture');return {...page,coverage:{complete:page.page.baseTotal===page.applications.length,mode:q.mode??'applicants'}}};
  api.getClubPipelineSelection=async(club,q={})=>compile('lib/pipeline-page.ts').completePipelineSelection(await api.getClubPipelineList(),q,'member','reviewer');
  let detailKey='',detail=null,revalidation=null;
  const C = compile('components/views/leader-dashboard/live-leader-workspace.tsx', {react,'next/navigation':{useRouter:()=>({push:url=>calls.push(['navigate',url])}),useSearchParams:()=>null},'@/hooks/use-revalidate':{useRevalidate:(reload,options)=>{revalidation={reload,options}},announceDataChanged(){}},'@/contexts/auth-context':{useAuth:()=>auth},'@/hooks/use-pipeline-applicant':{usePipelineApplicant(club,id,revision){const key=`${club}:${id}:${revision}`;if(key!==detailKey){detailKey=key;detail=id?structuredClone(pipeline.applications.find(app=>app.id===id)):null}return{application:detail,error:false,retry(){}}}},'@/contexts/demo-context':{useDemoMode:()=>({isDemoEnabled:false,ready:true})},'@/lib/reviewer-evaluation':{findReviewerEvaluation(...args){const result=compile('lib/reviewer-evaluation.ts').findReviewerEvaluation(...args);lookups.push({round:args[2],result});return result}},'@/lib/workspace-api':api,'@/lib/application-state':{useApplicationState:()=>({leaderFocus:null,clearLeaderFocus(){}})}}, '\nexports.TestWorkspace = ClubWorkspace;').TestWorkspace
  const membership = {id:'member',clubId:'club',permissions,club:{name:'Test club'}}
  return {calls,api,lookups,revalidation:()=>revalidation,notifyEpoch(){currentEpoch={}},commitEpoch(){auth.readAuthority=currentEpoch},setViewer(id){auth.user={id};membership.id=id;membership.userId=id},replayEffects(){for(const cleanup of cleanups.values())cleanup?.();cleanups.clear();for(const [slot,setup]of setups)cleanups.set(slot,setup())},addCandidate(app){pipeline.applications.push({...structuredClone(pipeline.applications[0]),...app})},setCanEvaluate(value){pipeline.applications[0].canEvaluate=value},addRound(round){pipeline.rounds.push(round)},setEvaluations(evaluations){pipeline.applications[0].evaluations=evaluations},renameRound(name){pipeline.rounds[0].name=name},setServerRound(roundId){pipeline.applications[0].roundId=roundId},setServerStatus(status){pipeline.applications[0].status=status},render(){for(let step=0;step<20;step++){changed=false;index=0;const tree=C({membership,decisionsOnly,rejectedOnly});while(effects.length){const [slot,setup]=effects.shift();cleanups.get(slot)?.();cleanups.set(slot,setup())}if(!changed)return tree}throw Error('Component failed to settle')}}
}
// List/Kanban and the decision groups are SegmentedControl options: return an onClick that chooses the option.
const segment = (tree,group,match) => { const control=nodes(tree).find(n=>n.type==='SegmentedControl'&&n.props.label===group); const option=control?.props.options.find(o=>match(text(o.label))); return option && {props:{onClick:()=>control.props.onChange(option.value)}} }
const button = (tree,label) => label==='List'||label==='Kanban' ? segment(tree,'Applicant view',t=>t===label) : nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
// Dossier actions behind the ⋯ menu are DropdownMenuItems; Move round opens its own dialog.
const menuItem = (tree,label) => nodes(tree).find(n=>n.type==='DropdownMenuItem'&&text(n)===label)
const roundSelect = (h,tree) => { if(!nodes(tree).some(n=>n.props?.id==='move-round')){menuItem(tree,'Move round…').props.onSelect();tree=h.render()} return nodes(tree).find(n=>n.props?.id==='move-round') }
const view = tree => nodes(tree).find(n=>['LiveApplicantList','LiveApplicantKanban'].includes(n.type))
test('complete-selection reads reject a notified obsolete authority before dispatch',async()=>{
  const h=harness();h.render();await flush();const tree=h.render();
  const before=h.calls.length;h.notifyEpoch();await button(tree,'Quick decisions').props.onClick();
  assert.equal(h.calls.length,before);assert.equal(view(h.render()),undefined);
})
test('complete-selection reads reject results during the authority notification-to-commit gap',async()=>{
  const h=harness(),id=n=>`123e4567-e89b-12d3-a456-${String(n).padStart(12,'0')}`;
  for(let i=0;i<101;i++)h.addCandidate({id:id(i)});
  h.render();await flush();let settle;
  h.api.getClubPipelineSelection=()=>new Promise(resolve=>settle=resolve);
  const pending=button(h.render(),'Quick decisions').props.onClick();h.notifyEpoch();settle({applications:[{id:'obsolete',canQuickReview:true}]});await pending;
  assert.equal(nodes(h.render()).some(n=>n.type==='Sheet'&&n.props.open),false);
})
test('List/Kanban toggle preserves the same filtered server data and does not mutate or reload it', async () => {
  const h=harness();h.render();await flush();let tree=h.render()
  const source=view(tree).props.applicants
  button(tree,'Kanban').props.onClick();tree=h.render()
  assert.equal(view(tree).type,'LiveApplicantKanban');assert.deepEqual(view(tree).props.applicants,source);assert.deepEqual(h.calls,[['load']])
  nodes(tree).find(n=>n.props?.['aria-label']==='Search applicants').props.onChange({target:{value:'no match'}})
  tree=h.render();assert.equal(view(tree),undefined)
  button(tree,'List').props.onClick();tree=h.render();assert.equal(view(tree),undefined)
})
test('drawer status writes send expectedStatus, reject stale outcomes, and refresh canonical offer state', async () => {
  const h=harness();h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  button(tree,'Accept').props.onClick();tree=h.render();h.setServerStatus('WAITLISTED');button(tree,'Send now').props.onClick();await flush();tree=h.render();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW');assert.equal(view(tree).props.applicants[0].status,'IN_REVIEW');assert.match(text(tree),/could not be saved/)
  h.setServerStatus('IN_REVIEW');button(tree,'Send now').props.onClick();await flush();tree=h.render();await flush();tree=h.render();assert.equal(view(tree).props.applicants[0].status,'ACCEPTED');assert.equal(h.calls.filter(c=>c[0]==='load').length,2);await flush();tree=h.render();await flush();tree=h.render();assert.ok(menuItem(tree,'Rescind pending offer'))
})
test('read/review access alone never exposes enabled round moves or decision buttons', async () => {
  const h=harness(['applications.review']);h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  assert.equal(button(tree,'Accept'),undefined);assert.equal(menuItem(tree,'Move round…'),undefined,'no round move without recruitment management');assert.equal(button(tree,'Finalize evaluation').props.disabled,false)
})
test('evaluation save updates both presentations and explicit round movement reloads anonymous identity', async () => {
  const h=harness();h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  nodes(tree).find(n=>n.props?.id==='review-score').props.onChange({target:{value:'8'}});tree=h.render()
  nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();tree=h.render();await flush();tree=h.render();assert.equal(view(tree).props.applicants[0].evaluations[0].score,8);assert.equal(view(tree).props.applicants[0].evaluations[0].interviewerId,'member')
  roundSelect(h,tree).props.onChange({target:{value:'anonymous-round'}});tree=h.render();button(tree,'Move round').props.onClick();await flush();h.render();await flush();tree=h.render();await flush();tree=h.render()
  assert.equal(view(tree).props.applicants[0].studentId,'anonymous-candidate');assert.equal(view(tree).props.applicants[0].student.email,'');assert.equal(nodes(tree).find(n=>n.type==='Sheet').props.open,false)
  button(tree,'Kanban').props.onClick();tree=h.render();assert.equal(view(tree).props.applicants[0].studentId,'anonymous-candidate')
})

test('an identified applicant without current panel authority has no review editor or blocking review draft', async () => {
  const h=harness();h.setCanEvaluate(false);h.render();await flush();let tree=h.render()
  view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  assert.equal(button(tree,'Finalize evaluation'),undefined)
  assert.equal(nodes(tree).find(n=>n.props?.id==='review-score').props.disabled,true,'the score is shown read-only')
  assert.match(nodes(tree).find(n=>n.type==='DisabledReason'&&n.props.field).props.reason,/current panel assignment/,'the reason is the control’s tooltip')
  roundSelect(h,tree);tree=h.render()
  assert.equal(button(tree,'Move round').props.disabled,true,'unchanged round is still disabled')
  assert.ok(button(tree,'Accept'),'recruitment actions remain available')
  assert.equal(h.calls.some(c=>c[0]==='review'),false)
})

const { applicationDecisionGroup } = compile('lib/application-decisions.ts')
test('decision groups use persisted status, exclude drafts, and keep waitlists out of Pending', () => {
  for (const status of ['SUBMITTED','IN_REVIEW','INTERVIEWING']) assert.equal(applicationDecisionGroup(status),'pending')
  for (const status of ['ACCEPTED','WAITLISTED','REJECTED']) assert.equal(applicationDecisionGroup(status),status.toLowerCase())
  assert.equal(applicationDecisionGroup('DRAFTING'),null)
  assert.equal(applicationDecisionGroup('Final round'),null)
})
const decisionAction = (tree,label) => nodes(tree).find(n=>n.type==='Button' && text(n)===label && n.props['aria-pressed'] === undefined)
const decisionList = tree => nodes(tree).find(n=>n.type==='LiveDecisionList')
const decisionGroupButton = (tree,label) => segment(tree,'Decision',t=>t.startsWith(label))
test('Decisions reuses expected-status mutations and moves saved outcomes between groups', async () => {
  const h=harness(undefined,true);h.render();await flush();let tree=h.render()
  assert.equal(button(tree,'Kanban'),undefined)
  decisionGroupButton(tree,'Pending').props.onClick();tree=h.render();await flush();tree=h.render()
  decisionList(tree).props.open(decisionList(tree).props.applicants[0]);tree=h.render()
  decisionAction(tree,'Accept').props.onClick();tree=h.render();button(tree,'Send now').props.onClick();await flush();tree=h.render();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW')
  assert.equal(decisionList(tree),undefined)
  decisionGroupButton(tree,'Accepted').props.onClick();tree=h.render();await flush();tree=h.render()
  assert.equal(decisionList(tree).props.applicants[0].status,'ACCEPTED')
})
test('Decisions preserves stale failures and hides mutation controls from anonymous reviewers', async () => {
  const h=harness(undefined,true);h.render();await flush();let tree=h.render();decisionList(tree).props.open(decisionList(tree).props.applicants[0]);tree=h.render()
  decisionAction(tree,'Accept').props.onClick();tree=h.render();h.setServerStatus('REJECTED');button(tree,'Send now').props.onClick();await flush();tree=h.render();await flush();tree=h.render()
  assert.equal(decisionList(tree).props.applicants[0].status,'IN_REVIEW');assert.match(text(tree),/could not be saved/)
  const limited=harness(['applications.review'],true);limited.render();await flush();tree=limited.render();decisionList(tree).props.open(decisionList(tree).props.applicants[0]);tree=limited.render();assert.equal(decisionAction(tree,'Accept'),undefined)
})

test('Kanban round moves reject stale data and share the refreshed anonymous projection with List', async () => {
  const h=harness();h.render();await flush();let tree=h.render()
  button(tree,'Kanban').props.onClick();tree=h.render()
  view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  roundSelect(h,tree).props.onChange({target:{value:'anonymous-round'}});tree=h.render()
  h.setServerRound('concurrent-round')
  button(tree,'Move round').props.onClick();await flush();tree=h.render();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='round')[1].expectedRoundId,'round')
  assert.equal(view(tree).props.applicants[0].roundId,'round')
  assert.match(text(tree),/could not be saved/)
  h.setServerRound('round')
  button(tree,'Move round').props.onClick();await flush();h.render();await flush();tree=h.render();await flush();tree=h.render()
  assert.equal(view(tree).type,'LiveApplicantKanban')
  const refreshed=view(tree).props.applicants
  assert.equal(refreshed[0].roundId,'anonymous-round')
  assert.equal(refreshed[0].student.email,'')
  button(tree,'List').props.onClick();tree=h.render()
  assert.deepEqual(view(tree).props.applicants,refreshed)
})
test('Kanban decisions use expected status and appear in List after server reload', async () => {
  const h=harness();h.render();await flush();let tree=h.render()
  button(tree,'Kanban').props.onClick();tree=h.render()
  view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  button(tree,'Accept').props.onClick();tree=h.render()
  button(tree,'Send now').props.onClick();await flush();tree=h.render();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW')
  assert.equal(applicantLane(view(tree).props.applicants[0].status),'closed')
  button(tree,'List').props.onClick();tree=h.render()
  assert.equal(view(tree).props.applicants[0].status,'ACCEPTED')
})

for(const name of ['Panel','Review'])test(`drawer renders stable-ID review with historical label when current name is ${name}`,async()=>{
 const h=harness();h.renameRound(name);h.setEvaluations([{id:'legacy',interviewerId:'member',roundId:null,round:name,score:2,notes:null},{id:'submitted',interviewerId:'member',roundId:'round',round:'Review',score:8.5,notes:null}]);
 h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();assert.equal(nodes(tree).find(n=>n.props?.id==='review-score').props.value,'8.5');assert.match(text(tree),/Finalized review/);assert.ok(nodes(tree).some(n=>Array.isArray(n.props?.children)&&n.props.children.includes('Review')&&n.props.children.includes(8.5)));
});
for(const roundId of [null,undefined,'different-round'])test(`drawer legacy label compatibility, roundId=${roundId}`,async()=>{
 const h=harness();h.setEvaluations([{id:'evaluation',interviewerId:'member',roundId,round:'Review',score:7,notes:null}]);h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();assert.equal(nodes(tree).find(n=>n.props?.id==='review-score').props.value,roundId==='different-round'?'':'7');
});

test('moving from the drawer locates the target-round review by stable ID despite an old label',async()=>{
 const h=harness();h.addRound({id:'target',name:'Panel',order:1});h.setEvaluations([{id:'submitted',interviewerId:'member',roundId:'target',round:'Interview',score:8.5,notes:null}]);h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();roundSelect(h,tree).props.onChange({target:{value:'target'}});tree=h.render();button(tree,'Move round').props.onClick();await flush();assert.equal(h.lookups.at(-1).round.id,'target');assert.equal(h.lookups.at(-1).result.id,'submitted');
});

test('rejected applicants leave active queues and remain in the deliberate retained-history tab',async()=>{
 const active=harness();active.setServerStatus('REJECTED');active.render();await flush();let activeTree=active.render();decisionGroupButton(activeTree,'Pending').props.onClick();activeTree=active.render();await flush();activeTree=active.render();assert.equal(view(activeTree),undefined);
 const rejected=harness(undefined,false,true);rejected.setServerStatus('REJECTED');rejected.render();await flush();const rejectedTree=rejected.render();assert.equal(view(rejectedTree).props.applicants.length,1);assert.equal(view(rejectedTree).props.applicants[0].status,'REJECTED');assert.equal(text(rejectedTree).match(/keep their reviews and decision history/g).length,1,'the retention explainer shows once');
});

test('recruitment review actions sit in one header row before the toolbar, without a card or Refresh; Decisions keeps only Review applicants', async () => {
 const h=harness();h.render();await flush();const tree=h.render(),all=nodes(tree);
 const actions=all.find(n=>n.props?.['aria-label']==='Recruitment review');
 assert.equal(actions.type,'div');assert.equal(actions.props.role,'group');assert.match(actions.props.className,/justify-end/);
 assert.ok(nodes(actions).some(n=>n.type==='Button'&&text(n)==='Quick decisions'));assert.equal(nodes(actions).some(n=>n.type==='BoardDecisionMode'),false,'the ballot opens from the Voting room');assert.doesNotMatch(text(actions),/Review decisions|Voting history/);
 assert.doesNotMatch(text(tree),/Review together or work through candidates/);assert.equal(all.some(n=>n.type==='section'&&n.props?.['aria-label']==='Recruitment review'),false);
 assert.equal(button(tree,'Refresh'),undefined);
 assert.ok(all.indexOf(actions)<all.findIndex(n=>n.type==='SegmentedControl'&&n.props.label==='Applicant view'));
 const decisions=harness(undefined,true);decisions.render();await flush();const decisionActions=nodes(decisions.render()).find(n=>n.props?.['aria-label']==='Recruitment review');
 assert.doesNotMatch(text(decisionActions??''),/Review applicants|Review decisions/,'no back-and-forth links between Applicants and Decisions');
});
test('quick review saves expected-status decisions and advances only after success', async () => {
 const h=harness();h.addCandidate({id:'second',studentId:'student-two',student:{email:'second@demo.invalid',studentProfile:null}});h.render();await flush();let tree=h.render();
 button(tree,'Quick decisions').props.onClick();await flush();tree=h.render();await flush();tree=h.render();assert.match(text(tree),/publishes the decision immediately/i);
 button(tree,'Accept & next').props.onClick();await flush();tree=h.render();await flush();tree=h.render();assert.deepEqual(h.calls.find(c=>c[0]==='status')[1],{clubId:'club',applicationId:'candidate',status:'ACCEPTED',expectedStatus:'IN_REVIEW'});assert.match(text(nodes(tree).find(n=>n.type==='SheetTitle')),/second@demo.invalid/);
 button(tree,'Deny & next').props.onClick();await flush();tree=h.render();await flush();tree=h.render();assert.equal(h.calls.filter(c=>c[0]==='status').length,2);assert.match(text(tree),/Quick decisions complete/);
});
test('quick review preserves the candidate after a rejected stale write and skips without publishing',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();button(tree,'Quick decisions').props.onClick();await flush();tree=h.render();await flush();tree=h.render();h.setServerStatus('WAITLISTED');button(tree,'Accept & next').props.onClick();await flush();tree=h.render();await flush();tree=h.render();assert.ok(nodes(tree).find(n=>n.type==='Sheet').props.open);assert.match(text(tree),/candidate stays open/);button(tree,'Skip').props.onClick();await flush();tree=h.render();await flush();tree=h.render();assert.equal(nodes(tree).find(n=>n.type==='Sheet').props.open,false);assert.equal(h.calls.filter(c=>c[0]==='status').length,1);
});
test('review-only users cannot start quick review or move board candidates',async()=>{
 const h=harness(['applications.review']);h.render();await flush();let tree=h.render();assert.equal(button(tree,'Quick decisions'),undefined);button(tree,'Kanban').props.onClick();tree=h.render();const props=view(tree).props;for(const lane of ['review','interview','decision','closed'])assert.equal(props.canMove(props.applicants[0],lane),false);
});
test('board drops require an explicit outcome and preserve expected status',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();button(tree,'Kanban').props.onClick();tree=h.render();const props=view(tree).props;
 assert.equal(props.canMove(props.applicants[0],'closed'),true);assert.equal(props.canMove(props.applicants[0],'interview'),false);
 props.move(props.applicants[0],'closed');tree=h.render();assert.equal(h.calls.filter(c=>c[0]==='status').length,0);button(tree,'Accept candidate').props.onClick();await flush();tree=h.render();await flush();tree=h.render();assert.equal(view(tree).props.applicants[0].status,'ACCEPTED');assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW');
});

test('decision status stays unchanged until the server acknowledges publication',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();button(tree,'Accept').props.onClick();tree=h.render()
 const write=h.api.setApplicationStatus;let release;h.api.setApplicationStatus=async input=>{await new Promise(resolve=>{release=resolve});return write(input)}
 button(tree,'Send now').props.onClick();tree=h.render();assert.equal(view(tree).props.applicants[0].status,'IN_REVIEW');assert.equal(h.calls.some(c=>c[0]==='status'),false)
 release();await flush();tree=h.render();await flush();tree=h.render();assert.equal(view(tree).props.applicants[0].status,'ACCEPTED')
})

test('page reader remains usable after React development effect cleanup and setup replay',async()=>{const h=harness();h.render();await flush();let tree=h.render();assert.ok(view(tree));h.replayEffects();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();nodes(tree).find(n=>n.props?.id==='review-score').props.onChange({target:{value:'8'}});tree=h.render();nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();h.render();await flush();tree=h.render();assert.ok(view(tree),'effect setup must create a usable reader after disposal');assert.equal(h.calls.filter(c=>c[0]==='load').length,2,'a post-mutation reload still performs fresh authorization after effect replay')});

test('the list stays current without a Refresh button: revalidation re-reads in place and pauses while an applicant is open',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();
 assert.equal(button(tree,'Refresh'),undefined);
 const {options}=h.revalidation();assert.deepEqual(options.scopes,['applicants','decisions']);assert.ok(options.events.includes('outclass:decision-schedules'));assert.equal(options.enabled,true);
 h.setServerStatus('INTERVIEWING');const pending=h.revalidation().reload();tree=h.render();assert.ok(view(tree),'rows stay visible while revalidating');await pending;await flush();tree=h.render();
 assert.equal(view(tree).props.applicants[0].status,'INTERVIEWING');assert.equal(h.calls.filter(c=>c[0]==='load').length,2);
 view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();assert.equal(h.revalidation().options.enabled,false,'no background reload replaces an open review');
});

test('one sort drives the column headers and the toolbar Sort control at every width; the voting bar appears only with a selection',async()=>{
 const source=fs.readFileSync('components/views/leader-dashboard/live-applicant-views.tsx','utf8');
 for(const key of ['name','year','round','gpa','sat','act','score','status'])assert.match(source,new RegExp(`sortKey: "${key}"`),`column header sorts by ${key}`);
 assert.doesNotMatch(source,/xl:(hidden|block)/,'layout follows the list width (container queries), not viewport breakpoints');
 const h=harness(['applications.review','applicants.identify','decisions.manage','decisions.start']);h.render();await flush();let tree=h.render();
 const control=t=>nodes(t).find(n=>n.type==='SortControl'&&n.props.label==='Sort applicants');
 assert.ok(control(tree),'the toolbar has a Sort control');assert.match(String(control(tree).props.className||''),/^$/,'never hidden by a breakpoint');
 assert.equal(nodes(tree).find(n=>n.type==='FilterPopover'&&nodes(n).some(c=>c.type==='SortControl'||c.type==='PillSelect'&&/^Sort/.test(c.props.label))),undefined,'Filters holds no duplicate sort');
 view(tree).props.sortBy('sat');tree=h.render();assert.equal(view(tree).props.sort,'sat');assert.equal(view(tree).props.descending,true);assert.equal(control(tree).props.value,'sat','headers and the dropdown share one state');assert.equal(control(tree).props.descending,true);
 view(tree).props.sortBy('sat');tree=h.render();assert.equal(view(tree).props.descending,false);
 control(tree).props.onChange('gpa',true);tree=h.render();assert.equal(view(tree).props.sort,'gpa');assert.equal(view(tree).props.descending,true);
 assert.doesNotMatch(text(tree),/\d selected/);assert.equal(button(tree,'Start voting with selected applicants'),undefined);
 view(tree).props.votingSelection.toggle('candidate');tree=h.render();const bar=nodes(tree).find(n=>n.props?.['aria-label']==='Voting selection');assert.match(bar.props.className,/fixed/,'overlay bar does not shift the table');assert.match(text(bar),/selected/);assert.ok(button(tree,'Start voting with selected applicants'));assert.ok(nodes(bar).some(n=>n.type==='span'&&[].concat(n.props.children)[0]===1),'shows the selection count');
 button(tree,'Clear selection').props.onClick();tree=h.render();assert.equal(nodes(tree).find(n=>n.props?.['aria-label']==='Voting selection'),undefined);
 button(tree,'Kanban').props.onClick();tree=h.render();assert.ok(control(tree),'Kanban keeps the Sort control');
});

test('a different membership identity resets the page cursor before fresh summaries render',async()=>{
 const h=harness(),id=n=>`123e4567-e89b-12d3-a456-${String(n).padStart(12,'0')}`;for(let i=0;i<201;i++)h.addCandidate({id:id(i)});h.render();await flush();let tree=h.render();nodes(tree).find(n=>n.props?.['aria-label']==='Next applicant page').props.onClick();h.render();await flush();tree=h.render();assert.equal(nodes(tree).find(n=>n.type==='p'&&Array.isArray(n.props?.children)&&n.props.children[0]==='Page ').props.children[1],2);h.setViewer(id(999));h.render();await flush();assert.doesNotThrow(()=>{tree=h.render()});assert.equal(nodes(tree).find(n=>n.type==='p'&&Array.isArray(n.props?.children)&&n.props.children[0]==='Page ').props.children[1],1);assert.equal(h.calls.filter(c=>c[0]==='load').length,3);
});


test('authorized selected-applicant shortcut retains stable IDs and navigates without a mutation',async()=>{
 const previousStorage=global.sessionStorage,previousDocument=global.document,stored=new Map();
 global.sessionStorage={setItem:(key,value)=>stored.set(key,value)};global.document={querySelector:()=>null,getElementById:()=>null};
 try{
  const h=harness(['applications.review','applicants.identify','decisions.manage','decisions.start']);h.render();await flush();let tree=h.render();
  view(tree).props.votingSelection.toggle('candidate');tree=h.render();button(tree,'Start voting with selected applicants').props.onClick();
  const navigation=h.calls.find(c=>c[0]==='navigate');assert.ok(navigation);const url=new URL(navigation[1],'https://fixture.test');assert.equal(url.pathname,'/voting/rooms/new');assert.equal(url.searchParams.get('clubId'),'club');assert.ok(url.searchParams.get('selection'));assert.ok(!navigation[1].includes('candidate'));
  assert.deepEqual(JSON.parse(stored.values().next().value),{userId:'reviewer',clubId:'club',demo:false,applicationIds:['candidate']});assert.ok(h.calls.every(c=>['load','navigate'].includes(c[0])));
  const denied=harness(['applications.review']);denied.render();await flush();const deniedTree=denied.render();assert.equal(view(deniedTree).props.votingSelection,undefined);assert.equal(button(deniedTree,'Start voting with selected applicants'),undefined);
 }finally{if(previousStorage===undefined)delete global.sessionStorage;else global.sessionStorage=previousStorage;if(previousDocument===undefined)delete global.document;else global.document=previousDocument;}
});

test('a background read that started before a write never lands after it, and repeated failures keep rows with a quiet Try again',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();
 const original=h.api.getClubPipelinePage;let release;
 h.setServerStatus('WAITLISTED');h.api.getClubPipelinePage=async(club,q)=>{const page=await original(club,q);await new Promise(resolve=>release=resolve);return page};
 const pending=h.revalidation().reload();await flush();
 h.api.getClubPipelinePage=original;h.setServerStatus('IN_REVIEW');
 await button(tree,'Quick decisions').props.onClick();release();await pending;await flush();tree=h.render();
 assert.equal(view(tree).props.applicants[0].status,'IN_REVIEW','the stale pre-write page is dropped');
 const older=harness();older.render();await flush();tree=older.render();const base=older.api.getClubPipelinePage;let first;
 older.setServerStatus('WAITLISTED');older.api.getClubPipelinePage=async(club,q)=>{const page=await base(club,q);await new Promise(resolve=>first=resolve);return page};
 const slow=older.revalidation().reload();await flush();older.api.getClubPipelinePage=base;older.setServerStatus('INTERVIEWING');await older.revalidation().reload();first();await slow;await flush();tree=older.render();
 assert.equal(view(tree).props.applicants[0].status,'INTERVIEWING','an older read never overwrites a newer one');
 older.api.getClubPipelinePage=async()=>{throw Error('offline')};
 await older.revalidation().reload();tree=older.render();assert.doesNotMatch(text(tree),/Couldn’t update applicants/,'one transient failure stays quiet');assert.ok(view(tree));
 await older.revalidation().reload();tree=older.render();assert.match(text(tree),/Couldn’t update applicants/);assert.ok(view(tree),'rows stay visible');
 older.api.getClubPipelinePage=base;button(tree,'Try again').props.onClick();await flush();await flush();tree=older.render();assert.doesNotMatch(text(tree),/Couldn’t update applicants/);
});
test('header actions re-resolve a remounted page-header slot instead of portaling into a detached node',async()=>{
 const first={id:'slot-a',nodeType:1,isConnected:true},second={id:'slot-b',nodeType:1,isConnected:true};let slot=first;
 globalThis.document={getElementById:id=>id==='workspace-page-actions'?slot:null};
 try{
  const h=harness();h.render();await flush();let tree=h.render();
  const portal=t=>nodes(t).find(n=>n.containerInfo);
  assert.equal(portal(tree).containerInfo,first);
  first.isConnected=false;slot=second;tree=h.render();assert.equal(portal(tree).containerInfo,second);
 }finally{delete globalThis.document}
});
test('Filters shows its active count, and the voting bar follows the list and pager with clearance below them',async()=>{
 const h=harness(['applications.review','applicants.identify','decisions.manage','decisions.start']);h.render();await flush();let tree=h.render();
 const panel=t=>nodes(t).find(n=>n.type==='FilterPopover');const round=t=>nodes(t).find(n=>n.type==='PillGroup'&&n.props.label==='Filter round');
 assert.equal(panel(tree).props.count,0);assert.ok(nodes(panel(tree)).includes(round(tree)),'round filter sits inside Filters');
 round(tree).props.onChange('round');tree=h.render();
 assert.equal(panel(tree).props.count,1,'the Filters pill counts active menu filters');
 const clear=nodes(panel(tree).props.footer).find(n=>n.type==='Button'&&text(n)==='Clear filters');assert.equal(clear.props.disabled,false);
 clear.props.onClick();tree=h.render();assert.equal(panel(tree).props.count,0,'Clear filters in the panel resets the menu filters');assert.equal(round(tree).props.value,'');
 view(tree).props.votingSelection.toggle('candidate');tree=h.render();const all=nodes(tree);
 const bar=all.find(n=>n.props?.['aria-label']==='Voting selection');assert.ok(all.indexOf(bar)>all.indexOf(view(tree)),'keyboard order reaches Start voting after the rows');
 assert.match(bar.props.className,/oc-voting-bar/);assert.ok(all.find(n=>n.props?.className==='oc-voting-bar-clearance'&&nodes(n).includes(bar)),'list and pager keep clear of the bar');
 const css=fs.readFileSync('components/product/operational-dashboard.css','utf8');assert.match(css,/body:has\(\.oc-voting-bar\) \[data-sonner-toaster\]/,'toasts rise above the bar');
});

test('Pending stage pills replace the Status dropdown: they filter by stage and clear when the decision group has no stages',async()=>{
 const h=harness();h.render();await flush();let tree=h.render();
 const stage=t=>nodes(t).find(n=>n.type==='SegmentedControl'&&n.props.label==='Pending stage');
 assert.equal(nodes(tree).find(n=>n.props?.['aria-label']==='Filter status'),undefined,'no duplicate Status dropdown');
 assert.deepEqual(stage(tree).props.options.map(o=>o.value),['','SUBMITTED','IN_REVIEW','INTERVIEWING']);
 stage(tree).props.onChange('INTERVIEWING');tree=h.render();await flush();tree=h.render();
 assert.equal(stage(tree).props.value,'INTERVIEWING');assert.ok(!view(tree)||view(tree).props.applicants.length===0,'the IN_REVIEW candidate is filtered out by the Interview stage');
 stage(tree).props.onChange('IN_REVIEW');tree=h.render();await flush();tree=h.render();assert.equal(view(tree).props.applicants.length,1,'In review keeps it');
 segment(tree,'Decision',t=>t.startsWith('Pending')).props.onClick();tree=h.render();assert.equal(stage(tree).props.value,'IN_REVIEW','Pending keeps its stage');
 segment(tree,'Decision',t=>t.startsWith('Accepted')).props.onClick();tree=h.render();assert.equal(stage(tree),undefined,'Accepted has no stages');
 segment(tree,'Decision',t=>t.startsWith('All')).props.onClick();tree=h.render();assert.equal(stage(tree).props.value,'','leaving Pending cleared the stage');
});

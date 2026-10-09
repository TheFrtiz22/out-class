const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function compile(file, mocks = {}, extra = '') {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', 'window', 'requestAnimationFrame', code)(name => mocks[name] || (name.startsWith('@/lib/') ? compile(name.replace('@/', '') + '.ts') : name.startsWith('@/') || name.startsWith('./') ? new Proxy({}, { get: (_, key) => String(key) }) : require(name)), mod, mod.exports, { addEventListener(){}, removeEventListener(){}, confirm(){ return true } }, () => {})
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
function harness(permissions = ['applications.review','applicants.identify','decisions.manage','recruitment.manage'], decisionsOnly = false) {
  const slots = [], effects = [], calls = [], lookups = []
  let index = 0, pipeline = { rounds: [{id:'round',name:'Review',order:0}], applications:[{id:'candidate',studentId:'student',roundId:'round',status:'IN_REVIEW',student:{email:'sample@demo.invalid',studentProfile:null},evaluations:[],answers:[],bookings:[]}] }
  const react = {useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){const i=index++;return slots[i]??=( {current:initial})},useMemo(fn){index++;return fn()},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
  const api = {getClubPipeline:async()=>{calls.push(['load']);return structuredClone(pipeline)},setApplicationStatus:async input=>{calls.push(['status',input]);if(input.expectedStatus!==pipeline.applications[0].status)throw Error('stale');pipeline.applications[0].status=input.status;if(input.status==='ACCEPTED')pipeline.applications[0].recruitmentOffer={status:'PENDING',expiresAt:new Date(Date.now()+86400000)};return {success:true}},moveApplicantRound:async input=>{calls.push(['round',input]);if(input.expectedRoundId!==pipeline.applications[0].roundId)throw Error('stale');pipeline.applications[0].roundId=input.newRoundId;pipeline.applications[0].studentId='anonymous-candidate';pipeline.applications[0].student={email:'',studentProfile:{firstName:'Applicant',lastName:'CANDIDATE',experiences:[]}};return {success:true}},submitEvaluation:async input=>{calls.push(['review',input]);return {evaluation:{id:'evaluation',interviewerId:'member',round:'Review',score:input.score,notes:input.notes}}}}
  const C = compile('components/views/leader-dashboard/live-leader-workspace.tsx', {react,'@/lib/reviewer-evaluation':{findReviewerEvaluation(...args){const result=compile('lib/reviewer-evaluation.ts').findReviewerEvaluation(...args);lookups.push({round:args[2],result});return result}},'@/lib/workspace-api':api,'@/lib/application-state':{useApplicationState:()=>({leaderFocus:null,clearLeaderFocus(){}})}}, '\nexports.TestWorkspace = ClubWorkspace;').TestWorkspace
  const membership = {id:'member',clubId:'club',permissions,club:{name:'Test club'}}
  return {calls,api,lookups,addRound(round){pipeline.rounds.push(round)},setEvaluations(evaluations){pipeline.applications[0].evaluations=evaluations},renameRound(name){pipeline.rounds[0].name=name},setServerRound(roundId){pipeline.applications[0].roundId=roundId},setServerStatus(status){pipeline.applications[0].status=status},render(){index=0;const tree=C({membership,decisionsOnly});while(effects.length)effects.shift()();return tree}}
}
const button = (tree,label) => nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
const view = tree => nodes(tree).find(n=>['LiveApplicantList','LiveApplicantKanban'].includes(n.type))
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
  button(tree,'Accepted').props.onClick();tree=h.render();h.setServerStatus('WAITLISTED');button(tree,'Confirm status').props.onClick();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW');assert.equal(view(tree).props.applicants[0].status,'IN_REVIEW');assert.match(text(tree),/could not be saved/)
  h.setServerStatus('IN_REVIEW');button(tree,'Confirm status').props.onClick();await flush();tree=h.render();assert.equal(view(tree).props.applicants[0].status,'ACCEPTED');assert.equal(h.calls.filter(c=>c[0]==='load').length,2);await flush();tree=h.render();assert.ok(button(tree,'Rescind pending offer'))
})
test('read/review access alone never exposes enabled round moves or decision buttons', async () => {
  const h=harness(['applications.review']);h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  assert.equal(button(tree,'Accepted'),undefined);assert.equal(button(tree,'Move round').props.disabled,true);assert.equal(button(tree,'Save evaluation').props.disabled,false)
})
test('evaluation save updates both presentations and explicit round movement reloads anonymous identity', async () => {
  const h=harness();h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  nodes(tree).find(n=>n.props?.id==='review-score').props.onChange({target:{value:'8'}});tree=h.render()
  nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();tree=h.render();assert.equal(view(tree).props.applicants[0].evaluations[0].score,8)
  nodes(tree).find(n=>n.props?.id==='move-round').props.onChange({target:{value:'anonymous-round'}});tree=h.render();button(tree,'Move round').props.onClick();await flush();h.render();await flush();tree=h.render()
  assert.equal(view(tree).props.applicants[0].studentId,'anonymous-candidate');assert.equal(view(tree).props.applicants[0].student.email,'');assert.equal(nodes(tree).find(n=>n.type==='Sheet').props.open,false)
  button(tree,'Kanban').props.onClick();tree=h.render();assert.equal(view(tree).props.applicants[0].studentId,'anonymous-candidate')
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
const decisionGroupButton = (tree,label) => nodes(tree).find(n=>n.type==='Button' && text(n).startsWith(label) && n.props['aria-pressed'] !== undefined)
test('Decisions reuses expected-status mutations and moves saved outcomes between groups', async () => {
  const h=harness(undefined,true);h.render();await flush();let tree=h.render()
  assert.equal(button(tree,'Kanban'),undefined)
  decisionList(tree).props.open(decisionList(tree).props.applicants[0]);tree=h.render()
  decisionAction(tree,'Accepted').props.onClick();tree=h.render();button(tree,'Confirm status').props.onClick();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW')
  assert.equal(decisionList(tree),undefined)
  decisionGroupButton(tree,'Accepted').props.onClick();tree=h.render()
  assert.equal(decisionList(tree).props.applicants[0].status,'ACCEPTED')
})
test('Decisions preserves stale failures and hides mutation controls from anonymous reviewers', async () => {
  const h=harness(undefined,true);h.render();await flush();let tree=h.render();decisionList(tree).props.open(decisionList(tree).props.applicants[0]);tree=h.render()
  decisionAction(tree,'Accepted').props.onClick();tree=h.render();h.setServerStatus('REJECTED');button(tree,'Confirm status').props.onClick();await flush();tree=h.render()
  assert.equal(decisionList(tree).props.applicants[0].status,'IN_REVIEW');assert.match(text(tree),/could not be saved/)
  const limited=harness(['applications.review'],true);limited.render();await flush();tree=limited.render();decisionList(tree).props.open(decisionList(tree).props.applicants[0]);tree=limited.render();assert.equal(decisionAction(tree,'Accepted'),undefined)
})

test('Kanban round moves reject stale data and share the refreshed anonymous projection with List', async () => {
  const h=harness();h.render();await flush();let tree=h.render()
  button(tree,'Kanban').props.onClick();tree=h.render()
  view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  nodes(tree).find(n=>n.props?.id==='move-round').props.onChange({target:{value:'anonymous-round'}});tree=h.render()
  h.setServerRound('concurrent-round')
  button(tree,'Move round').props.onClick();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='round')[1].expectedRoundId,'round')
  assert.equal(view(tree).props.applicants[0].roundId,'round')
  assert.match(text(tree),/could not be saved/)
  h.setServerRound('round')
  button(tree,'Move round').props.onClick();await flush();h.render();await flush();tree=h.render()
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
  button(tree,'Accepted').props.onClick();tree=h.render()
  button(tree,'Confirm status').props.onClick();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW')
  assert.equal(applicantLane(view(tree).props.applicants[0].status),'closed')
  button(tree,'List').props.onClick();tree=h.render()
  assert.equal(view(tree).props.applicants[0].status,'ACCEPTED')
})

for(const name of ['Panel','Review'])test(`drawer renders stable-ID review with historical label when current name is ${name}`,async()=>{
 const h=harness();h.renameRound(name);h.setEvaluations([{id:'legacy',interviewerId:'member',roundId:null,round:name,score:2,notes:null},{id:'submitted',interviewerId:'member',roundId:'round',round:'Review',score:8.5,notes:null}]);
 h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();assert.equal(nodes(tree).find(n=>n.props?.id==='review-score').props.value,'8.5');assert.match(text(tree),/Saved review/);assert.ok(nodes(tree).some(n=>Array.isArray(n.props?.children)&&n.props.children.includes('Review')&&n.props.children.includes(8.5)));
});
for(const roundId of [null,undefined,'different-round'])test(`drawer legacy label compatibility, roundId=${roundId}`,async()=>{
 const h=harness();h.setEvaluations([{id:'evaluation',interviewerId:'member',roundId,round:'Review',score:7,notes:null}]);h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();assert.equal(nodes(tree).find(n=>n.props?.id==='review-score').props.value,roundId==='different-round'?'':'7');
});

test('moving from the drawer locates the target-round review by stable ID despite an old label',async()=>{
 const h=harness();h.addRound({id:'target',name:'Panel',order:1});h.setEvaluations([{id:'submitted',interviewerId:'member',roundId:'target',round:'Interview',score:8.5,notes:null}]);h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render();nodes(tree).find(n=>n.props?.id==='move-round').props.onChange({target:{value:'target'}});tree=h.render();button(tree,'Move round').props.onClick();await flush();assert.equal(h.lookups.at(-1).round.id,'target');assert.equal(h.lookups.at(-1).result.id,'submitted');
});

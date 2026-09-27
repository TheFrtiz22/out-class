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
function harness(permissions = ['applications.review','applicants.identify','decisions.manage','recruitment.manage']) {
  const slots = [], effects = [], calls = []
  let index = 0, pipeline = { rounds: [{id:'round',name:'Review',order:0}], applications:[{id:'candidate',studentId:'student',roundId:'round',status:'IN_REVIEW',student:{email:'sample@demo.invalid',studentProfile:null},evaluations:[],answers:[],bookings:[]}] }
  const react = {useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){const i=index++;return slots[i]??=( {current:initial})},useMemo(fn){index++;return fn()},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
  const api = {getClubPipeline:async()=>{calls.push(['load']);return structuredClone(pipeline)},setApplicationStatus:async input=>{calls.push(['status',input]);if(input.expectedStatus!==pipeline.applications[0].status)throw Error('stale');pipeline.applications[0].status=input.status;return {success:true}},moveApplicantRound:async input=>{calls.push(['round',input]);pipeline.applications[0].roundId=input.newRoundId;pipeline.applications[0].studentId='anonymous-candidate';pipeline.applications[0].student={email:'',studentProfile:{firstName:'Applicant',lastName:'CANDIDATE',experiences:[]}};return {success:true}},submitEvaluation:async input=>{calls.push(['review',input]);return {evaluation:{id:'evaluation',interviewerId:'member',round:'Review',score:input.score,notes:input.notes}}}}
  const C = compile('components/views/leader-dashboard/live-leader-workspace.tsx', {react,'@/lib/workspace-api':api,'@/lib/application-state':{useApplicationState:()=>({leaderFocus:null,clearLeaderFocus(){}})}}, '\nexports.TestWorkspace = ClubWorkspace;').TestWorkspace
  const membership = {id:'member',clubId:'club',permissions,club:{name:'Test club'}}
  return {calls,api,setServerStatus(status){pipeline.applications[0].status=status},render(){index=0;const tree=C({membership});while(effects.length)effects.shift()();return tree}}
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
test('drawer status writes send expectedStatus, reject stale outcomes, and reload the sanitized pipeline on success', async () => {
  const h=harness();h.render();await flush();let tree=h.render();view(tree).props.open(view(tree).props.applicants[0]);tree=h.render()
  button(tree,'Accepted').props.onClick();tree=h.render();h.setServerStatus('WAITLISTED');button(tree,'Confirm status').props.onClick();await flush();tree=h.render()
  assert.equal(h.calls.find(c=>c[0]==='status')[1].expectedStatus,'IN_REVIEW');assert.equal(view(tree).props.applicants[0].status,'IN_REVIEW');assert.match(text(tree),/could not be saved/)
  h.setServerStatus('IN_REVIEW');button(tree,'Confirm status').props.onClick();await flush();tree=h.render();assert.equal(view(tree).props.applicants[0].status,'ACCEPTED');assert.equal(h.calls.filter(c=>c[0]==='load').length,2)
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

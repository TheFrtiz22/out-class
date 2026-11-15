const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return m.exports}
const p=load('lib/panel-proposals.ts')
const slot=(id,hour,required=1,roomId=id,buffer=0)=>({id,roomId,roomName:roomId,timezone:'UTC',startTime:`2030-10-12T${String(hour).padStart(2,'0')}:00:00.000Z`,endTime:`2030-10-12T${String(hour).padStart(2,'0')}:30:00.000Z`,required,buffer,active:true,roomRevision:0,slotRevision:0,existingMemberIds:[]})
const member=(id,allowedSlotIds,extra={})=>({id,name:id,role:'INTERVIEWER',eligible:true,confirmed:true,evidenceAccess:true,allowedSlotIds,blocks:{},...extra})
const doc=(sessions,assignments=[],options={maxConsecutiveMinutes:null,breakMinutes:15})=>({version:1,window:{start:'2030-10-12T00:00:00.000Z',end:'2030-10-13T00:00:00.000Z'},sessions,assignments,options})
const a=(slotId,memberId,locked=false)=>({slotId,memberId,locked,source:'MANUAL'})
test('different room requirements and simultaneous rooms never double book; scarcity has explicit status',()=>{
 const sessions=[slot('a',9,2),slot('b',9,3),slot('c',10,1)],ids=sessions.map(s=>s.id),scene={sessions,members:['a','b','c','d'].map(id=>member(id,ids))}
 const generated=p.generatePanelAssignments(scene,doc(sessions),'REGENERATE');assert.equal(generated.validation.filled,5);assert.equal(generated.validation.required,6);assert.equal(generated.validation.status,'PARTIALLY_STAFFED');assert.ok(generated.validation.sessions.some(s=>s.unfilled===1));assert.deepEqual(generated.validation.issues,[])
 const overlapping=generated.document.assignments.filter(a=>['a','b'].includes(a.slotId));assert.equal(new Set(overlapping.map(a=>a.memberId)).size,4)
 assert.deepEqual(p.generatePanelAssignments(scene,doc(sessions),'REGENERATE'),generated)
})
test('whole-window lookahead reserves a constrained interviewer instead of creating an avoidable gap',()=>{
 const s1=slot('a',9),s2={...slot('b',9),startTime:'2030-10-12T09:15:00.000Z',endTime:'2030-10-12T09:45:00.000Z'},scene={sessions:[s1,s2],members:[member('flex',['a','b']),member('only-a',['a'])]}
 const result=p.generatePanelAssignments(scene,doc(scene.sessions),'REGENERATE');assert.equal(result.validation.filled,2);assert.equal(result.document.assignments.find(a=>a.slotId==='b').memberId,'flex')
})
test('eligibility, participation, unknown availability, access and official conflicts all fail closed',()=>{
 const sessions=[slot('a',9,8)],members=[member('eligible',['a']),member('ineligible',['a'],{eligible:false}),member('unconfirmed',['a'],{confirmed:false}),member('no-access',['a'],{evidenceAccess:false}),member('unknown',[],{blocks:{a:['UNKNOWN_AVAILABILITY']}}),member('busy',[],{blocks:{a:['OFFICIAL_COMMITMENT']}})]
 const result=p.generatePanelAssignments({sessions,members},doc(sessions),'REGENERATE');assert.deepEqual(result.document.assignments.map(a=>a.memberId),['eligible']);assert.equal(result.validation.sessions[0].unfilled,7)
})
test('buffers prevent adjacent bookings and consecutive limits include official commitments',()=>{
 const s1=slot('a',9,1,'room',15),s2={...slot('b',9),startTime:'2030-10-12T09:40:00.000Z',endTime:'2030-10-12T10:10:00.000Z'},scene={sessions:[s1,s2],members:[member('a',['a','b']),member('b',['a','b'])]}
 assert.ok(p.canProposeMember(scene,[a('a','a')],'b','a',doc([]).options).includes('DOUBLE_BOOKED'))
 scene.members[0].commitments=[{startTime:'2030-10-12T08:30:00.000Z',endTime:'2030-10-12T09:00:00.000Z',buffer:0}]
 assert.ok(p.canProposeMember(scene,[],'a','a',{maxConsecutiveMinutes:60,breakMinutes:15}).includes('CONSECUTIVE_LIMIT'))
 const result=p.generatePanelAssignments(scene,doc(scene.sessions,[],{maxConsecutiveMinutes:60,breakMinutes:15}),'REGENERATE');assert.equal(result.validation.filled,2);assert.deepEqual(result.validation.issues,[])
})
test('locks survive regeneration and invalid locks are conflicts; fill missing retains all manual positions',()=>{
 const sessions=[slot('a',9,2),slot('b',10)],scene={sessions,members:[member('a',['a','b']),member('b',['a','b']),member('bad',['a'],{eligible:false})]},document=doc(sessions,[a('a','a',true),a('b','b')])
 const filled=p.generatePanelAssignments(scene,document,'FILL_MISSING');assert.ok(filled.document.assignments.some(v=>v.slotId==='b'&&v.memberId==='b'&&v.source==='MANUAL'));assert.equal(filled.validation.filled,3)
 const result=p.generatePanelAssignments(scene,doc(sessions,[a('a','bad',true)]),'REGENERATE');assert.ok(result.document.assignments.some(v=>v.memberId==='bad'&&v.locked));assert.equal(result.validation.status,'CONFLICT_DETECTED');assert.ok(result.validation.issues.some(i=>i.code==='INELIGIBLE'))
})
test('workloads balance and ties prefer the existing panel; changed times and overstaffing are visible',()=>{
 const sessions=Array.from({length:8},(_,i)=>slot(String(i),i+8,1,'same')),scene={sessions,members:[member('a',sessions.map(s=>s.id)),member('b',sessions.map(s=>s.id))]}
 const result=p.generatePanelAssignments(scene,doc(sessions),'REGENERATE');assert.deepEqual(result.validation.workloads.map(w=>w.sessions),[4,4])
 sessions[0].existingMemberIds=['b'];const one=p.generatePanelAssignments({...scene,sessions:[sessions[0]]},doc([sessions[0]]),'REGENERATE');assert.equal(one.document.assignments[0].memberId,'b')
 const invalid=p.validatePanelDocument(doc([sessions[0]],[a('0','a'),a('0','b')]),{...scene,sessions:[{...sessions[0],buffer:5}]});assert.ok(invalid.issues.some(i=>i.code==='SESSION_CHANGED'));assert.ok(invalid.issues.some(i=>i.code==='OVERSTAFFED'))
})
test('bounded global search improves a duty-limit greedy gap and reports budget exhaustion',()=>{
 const sessions=[slot('a',9),{...slot('b',9),startTime:'2030-10-12T09:30:00.000Z',endTime:'2030-10-12T10:00:00.000Z'},slot('c',10)],scene={sessions,members:[member('a',['a','b','c']),member('b',['a','b'])]},document=doc(sessions,[],{maxConsecutiveMinutes:30,breakMinutes:15})
 const result=p.generatePanelAssignments(scene,document,'REGENERATE');assert.equal(result.validation.filled,3);assert.deepEqual(result.validation.issues,[])
 // Search budgets are deterministic even when a feasible coverage bound is unattainable.
 const impossible={sessions:sessions.slice(0,2),members:[member('a',['a','b'])]},limited=p.generatePanelAssignments(impossible,doc(impossible.sessions,[],document.options),'REGENERATE',0);assert.equal(limited.validation.search.limited,true);assert.equal(limited.validation.warnings.length,1)
})
test('whole-window coverage matches exhaustive feasible solutions across all small eligibility graphs',()=>{
 const sessions=[slot('a',9),{...slot('b',9),startTime:'2030-10-12T09:15:00.000Z',endTime:'2030-10-12T09:45:00.000Z'},slot('c',10)]
 for(let graph=0;graph<512;graph++){
  const members=['x','y','z'].map((id,i)=>member(id,sessions.filter((_,j)=>graph&(1<<(i*3+j))).map(s=>s.id))),scene={sessions,members};let optimum=0
  for(let choices=0;choices<64;choices++) { const assignments=sessions.flatMap((s,j)=>{const m=(choices>>(j*2))&3;return m<3?[a(s.id,members[m].id)]:[]}),validation=p.validatePanelDocument(doc(sessions,assignments),scene);if(!validation.issues.length)optimum=Math.max(optimum,validation.filled) }
  const generated=p.generatePanelAssignments(scene,doc(sessions),'REGENERATE');assert.equal(generated.validation.filled,optimum,`eligibility graph ${graph}`);assert.deepEqual(generated.validation.issues,[])
 }
})
test('closed-room sessions keep only their current interviewers, never count toward coverage or duty, and are never staffed by generation',()=>{
 const open=slot('open',9,1),closed={...slot('closed',9,2),active:false,unstaffOnly:true,existingMemberIds:['kept']},scene={sessions:[open,closed],members:[member('kept',['open'],{blocks:{closed:['UNAVAILABLE']}}),member('new',['open','closed'])]}
 // Retained interviewers stay without availability or overlap issues; the closed session adds no required positions.
 let v=p.validatePanelDocument(doc([open,closed],[a('open','kept'),a('closed','kept')]),scene);assert.deepEqual(v.issues,[]);assert.equal(v.required,1);assert.equal(v.filled,1);assert.equal(v.sessions.find(s=>s.slotId==='closed').unfilled,0);assert.deepEqual(v.workloads,[{memberId:'kept',sessions:1,minutes:30}])
 // Placing anybody new on a closed session is a conflict.
 v=p.validatePanelDocument(doc([open,closed],[a('closed','new')]),scene);assert.deepEqual(v.issues.map(i=>[i.memberId,i.code]),[['new','SESSION_UNAVAILABLE']])
 assert.ok(p.canProposeMember(scene,[],'closed','new',doc([]).options).includes('SESSION_UNAVAILABLE'))
 // A retained interviewer who lost eligibility still blocks, as the publication guard would.
 v=p.validatePanelDocument(doc([open,closed],[a('closed','kept')]),{...scene,members:[member('kept',[],{eligible:false})]});assert.deepEqual(v.issues.map(i=>i.code),['INELIGIBLE'])
 // Emptying a closed session is an un-staffing that needs confirmation, but it is not subtracted from required coverage.
 const unstaffing=p.panelUnstaffing(doc([open,closed],[]),scene,new Set());assert.deepEqual(unstaffing.removedSlotIds,['closed']);assert.equal(unstaffing.exemptRequired,1)
 assert.equal(p.generatePanelAssignments({...scene,sessions:[open,closed]},doc([open,closed]),'REGENERATE').document.assignments.some(x=>x.slotId==='closed'),false)
})

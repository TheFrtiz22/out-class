// Live voting room redesign: light projector tokens, the round tracker counts, the full-slide model, scholar status
// as an authorized slide field (hidden in anonymous rounds), and the room header names.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,load,clubId,roundId,apps,leaderId}=require('./helpers/voting-room-harness.cjs');
const read=f=>fs.readFileSync(f,'utf8');

test('light projector theme restates every token the dark projector overrides, with the :root value',()=>{
 const css=read('styles/tokens.css'),block=start=>{const i=css.indexOf(start);assert.ok(i>=0,start);return css.slice(i,css.indexOf('\n}',i));};
 const vars=text=>Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
 const root=vars(block(':root {')),dark=vars(block('[data-theme="present"], .oc-focus-frame')),light=vars(block('[data-theme="present-light"]'));
 for(const name of Object.keys(dark)){
  if(['--oc-elevation-surface','--oc-content-shadow'].includes(name))continue;
  assert.ok(name in light,`${name} is restated for the light projector`);
  // The slide stays solid (no glass) in both themes; everything else is the :root value.
  if(!['--oc-content-surface','--oc-content-edge'].includes(name))assert.equal(light[name],root[name],name);
 }
 for(const name of ['--oc-vote-pass','--oc-vote-fail','--oc-vote-held','--oc-vote-track','--oc-vote-marker'])assert.equal(light[name],root[name],name);
 assert.match(block('[data-theme="present-light"]'),/color-scheme: light/);
});

test('light and dark projector text meets 4.5:1 on the slide background',()=>{
 const lum=hex=>{const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
 // Dark: foreground, muted text and the accent (scholar status, target reached) on #0f1c2b.
 for(const fg of ['f6f5f1','b0c1cc','f3a274'])assert.ok(ratio(fg,'0f1c2b')>=4.5,`dark ${fg}`);
 // Light: UVA Blue, muted text and the small-text accent on the cream canvas.
 for(const fg of ['232d4b','52606d','a04d00'])assert.ok(ratio(fg,'f6f5f1')>=4.5,`light ${fg}`);
});

test('round tracker counts: the whole round, each applicant once, and the target marker',()=>{
 const t=load('lib/voting-target-summary.ts');
 // Two sessions in the round: the newer session's recorded outcome wins; applicants without one are "to go".
 const summary=t.roundTargetSummary({round:{name:'First Round',final:false},sessions:[
  {id:'a',createdAt:'2026-11-01',revision:3,targetSize:5,outcomes:[{applicationId:'1',outcome:'ACCEPT'},{applicationId:'2',outcome:'HOLD'},{applicationId:'3',outcome:null}]},
  {id:'b',createdAt:'2026-11-02',revision:4,targetSize:5,outcomes:[{applicationId:'2',outcome:'ACCEPT'},{applicationId:'4',outcome:'REJECT'},{applicationId:'5',outcome:null},{applicationId:'6',outcome:'ACCEPT'}]}]});
 const c=t.roundTrackerCounts(summary);
 assert.deepEqual({passed:c.passed,failed:c.failed,held:c.held,toGo:c.toGo,total:c.total},{passed:3,failed:1,held:0,toGo:2,total:6});
 assert.equal(c.target,5);assert.equal(c.reached,false);assert.ok(Math.abs(c.markerPercent-500/6)<1e-9);
 const reached=t.roundTrackerCounts({decisions:{pass:5,notPass:2,hold:1,unreviewed:4,total:12},target:{value:5}});
 assert.equal(reached.reached,true);assert.ok(Math.abs(reached.markerPercent-500/12)<1e-9);
 assert.equal(t.roundTrackerCounts({decisions:{pass:0,notPass:0,hold:0,unreviewed:0,total:0},target:{value:3}}).markerPercent,null,'no marker without applicants');
 assert.equal(t.roundTrackerCounts({decisions:{pass:1,notPass:0,hold:0,unreviewed:1,total:2},target:{value:null}}).markerPercent,null,'no marker without a target');
 // The tracker component reads only this server summary, the same entire-round read as the leader's totals.
 const tracker=read('components/live-voting/round-tracker.tsx');
 assert.match(tracker,/getRoundTargetSummary\(/);assert.match(tracker,/roundTrackerCounts\(summary\)/);
 assert.match(tracker,/Target of \$\{c\.target\} reached · voting can continue/);
});

const model=load('components/live-voting/slide-model.ts');
const longThought='Strengths:\n- Structured answers\n- Took feedback on the case\n'+'She explained the trade-off clearly. '.repeat(40);
const data=(extra={})=>({applicationId:apps[0],roundId,anonymous:false,visible:['photo','name','major','academicYear','sat','gpa'],photo:'/p.png',
 sections:[{field:'name',items:['Maya Rivera']},{field:'major',items:['Systems Engineering']},{field:'academicYear',items:['Second year']},{field:'sat',items:['1490']},{field:'gpa',items:['3.82']}],
 requestedFields:['photo','name','major','academicYear','sat','gpa','interviewScore','finalInterviewThoughts','resumeHighlight','additionalObservations','scholarStatus'],
 interviewScore:{current:{roundId,roundName:'First Round',status:'scored',average:8.4,submitted:3}},earlierInterviewRounds:[],
 interviewFeedback:{roundId,roundName:'First Round',entries:[{id:'1',interviewer:'A',summary:longThought,score:8},{id:'2',interviewer:'B',summary:'Strongest fit answer of the day.',score:9}],pending:1,scoresIncluded:true,average:8.5,scored:2,earlierRounds:[]},
 resumeHighlight:{id:'h',page:2,quote:'Built a scheduling tool used by 40 student groups. '.repeat(20)},
 additionalObservations:[{id:'o',body:'Helped run the check-in table.',interactionContext:'Info session'}],scholarStatus:['Echols Scholars Program','Other program'],...extra});

test('slide model: every enabled field in full, nothing cut, no details button needed',()=>{
 const m=model.slideModel(data());
 assert.equal(m.name,'Maya Rivera');
 assert.deepEqual(m.profile.map(p=>[p.field,p.text,!!p.accent]),[['major','Systems Engineering',false],['academicYear','Second year',false],['scholarStatus','Echols Scholars Program',true],['scholarStatus','Other program',true]]);
 assert.deepEqual(m.facts.map(f=>[f.label,f.value,f.unit??'']),[['Interview score · First Round','8.4','/ 10'],['SAT','1490',''],['GPA','3.82','']]);
 const text=m.notes.flatMap(n=>n.paragraphs.map(p=>p.text));
 assert.ok(text.includes(longThought),'long thoughts are kept whole');
 assert.ok(text.includes(data().resumeHighlight.quote),'the résumé excerpt is kept whole');
 assert.ok(text.includes('Helped run the check-in table.'));
 assert.ok(text.includes('1 review not yet submitted'));
 assert.deepEqual(m.notes.map(n=>n.label),['Interviewer final thoughts','From the résumé','Additional observations']);
 // Two balanced, ordered columns; one note gets the full width.
 const cols=model.balanceColumns(m.notes);assert.equal(cols.length,2);assert.deepEqual(cols.flat().map(n=>n.key),m.notes.map(n=>n.key));
 assert.equal(model.balanceColumns([m.notes[0]]).length,1);
});

test('slide model: scholar status only when the server returned it for a requested field',()=>{
 const off=model.slideModel(data({requestedFields:['name','major'],scholarStatus:undefined}));
 assert.equal(off.profile.some(p=>p.field==='scholarStatus'),false);
 const none=model.slideModel(data({scholarStatus:[]}));
 assert.deepEqual(none.profile.filter(p=>p.field==='scholarStatus').map(p=>p.text),['No scholar program']);
});

test('scholar status: selected, identified rounds only; off by default; in the Profile group',()=>{
 const slides=load('lib/voting-slide-fields.ts'),room=load('lib/voting-room.ts');
 const raw={selections:['ECHOLS','OTHER'],other:'Mellon Fellow'};
 assert.deepEqual(slides.selectedScholarStatus(['name','scholarStatus'],false,raw,true),{scholarStatus:['Echols Scholars Program','Mellon Fellow']});
 assert.deepEqual(slides.selectedScholarStatus(['name'],false,raw,true),{});
 assert.deepEqual(slides.selectedScholarStatus(['name','scholarStatus'],true,raw,true),{},'anonymous (blind) rounds never receive it');
 assert.deepEqual(slides.selectedScholarStatus(['scholarStatus'],false,{selections:['NOT_APPLICABLE'],other:''},true),{scholarStatus:[]});
 assert.deepEqual(slides.slideFieldGroups.find(g=>g[0]==='Profile')[1],['photo','name','major','academicYear','scholarStatus']);
 assert.equal(slides.slideFieldLabel('scholarStatus'),'Scholar status');
 assert.ok(room.liveRoomFields.includes('scholarStatus'));
 assert.equal(room.roomDisplayConfig(['name','scholarStatus']).fields.includes('scholarStatus'),false,'never enters the Applicant Display contract');
 assert.doesNotMatch(read('components/live-voting/room-setup.tsx').match(/useState<LiveRoomField\[\]>\(([^)]*)\)/)[1],/scholarStatus/,'off by default');
 const narrowed=slides.narrowVotingSlide({visible:['name'],sections:[],scholarStatus:['X'],requestedFields:['name','scholarStatus']},['name']);
 assert.equal('scholarStatus'in narrowed,false);
 // Anonymous rounds refuse it at setup (live, setup listing and Demo).
 for(const file of ['utils/voting-room-setup.ts','actions/voting-room-setup.ts','lib/demo/voting-room.ts'])assert.match(read(file),/"major","scholarStatus"/,file);
});

test('scholar status loads only through the authorized slide loaders, and only the scholarStatus column',()=>{
 for(const file of ['actions/voting-room.ts','actions/voting-session-setup.ts']){
  const src=read(file);
  assert.match(src,/student:\{select:\{studentProfile:\{select:\{scholarStatus:true\}\}\}\}/,file);
  assert.match(src,/selectedScholarStatus\([^;]*anonymous\|\|round\.anonymousReview[^;]*allowedByProfileCeiling\(['"]scholarStatus['"]/,file);
 }
});

async function loader(anonymous){
 const h=harness();
 h.state().apps.forEach(a=>a.student={studentProfile:{firstName:'QA',lastName:'Applicant',scholarStatus:{selections:['JEFFERSON'],other:''}}});
 h.mocks['@/actions/applicant-intelligence']={getApplicantDisplay:async d=>({applicationId:d.applicationId,roundId,anonymous,configured:['name'],visible:['name'],withheld:[],sections:[{field:'name',label:'Name',items:['QA Applicant']}],photo:null,links:[],observations:[]})};
 h.tx.interviewResumeAnnotation={findMany:async()=>[]};
 await h.create({presentationOptions:{fields:['name','scholarStatus'],highlights:{}}});await h.command('START');
 h.round.anonymousReview=anonymous;
 const room=load('actions/voting-room.ts',h.mocks);
 return room.getLiveVotingPresentation({...h.scope,applicationId:h.state().sessions[0].activeApplicationId??apps[0]});
}
test('live slide loader: scholar names for an identified round; nothing once the round is anonymous',async()=>{
 const identified=await loader(false);
 assert.deepEqual(identified.scholarStatus,['Jefferson Scholars Program']);assert.ok(identified.requestedFields.includes('scholarStatus'));
 const blind=await loader(true);
 assert.equal('scholarStatus'in blind,false);assert.equal(blind.requestedFields.includes('scholarStatus'),false);
});

test('setup refuses scholar status in an anonymous round',async()=>{
 const h=harness();h.round.anonymousReview=true;
 await assert.rejects(h.create({presentationOptions:{fields:['scholarStatus'],highlights:{}}}),/Identifying fields/);
});

test('room snapshot names the round, cycle and next round for the header and "Advances to"',async()=>{
 const h=harness();h.cycle.name='Fall 2026';h.round.name='First Round';h.rounds.push({...h.round,id:'00000000-0000-4000-8000-0000000000aa',name:'Second Round',order:1});
 await h.create({presentationOptions:{fields:['name'],highlights:{}}});h.as(leaderId);
 const room=await h.read();
 assert.equal(room.roundName,'First Round');assert.equal(room.cycleName,'Fall 2026');assert.equal(room.nextRoundName,'Second Round');
 assert.equal(clubId.length,36);
});

test('audience slide: no details dialog or Read full links, the result only after close, theme stored per device',()=>{
 const audience=read('components/live-voting/audience-slide.tsx'),room=read('components/live-voting/audience-room.tsx'),view=read('components/live-voting/room-view.tsx'),theme=read('components/live-voting/projector-theme.tsx');
 assert.doesNotMatch(audience,/Dialog|Read full|Applicant details/);
 assert.match(room,/entry\.ballotState==="CLOSED"\|\|entry\.ballotState==="CONFIRMED"\)&&room\.status==="OPEN"\?closedResult/);
 // Each view loads only its own screen.
 assert.match(view,/const AudienceView=lazy\(/);assert.match(view,/const LeaderView=lazy\(/);assert.match(view,/const QrCodeCard=lazy\(/);
 assert.doesNotMatch(view,/from "\.\/(audience-room|leader-room|room-meeting)"/);
 assert.match(room,/<OutClassQRCode/);assert.match(room,/useShortLinkUrl\(/);assert.doesNotMatch(room,/qr-code-card/,'the projector does not pull in the QR export card');
 assert.match(room,/aria-live="polite"/);
 assert.match(theme,/try\{const v=window\.localStorage\.getItem/);assert.match(theme,/catch\{\/\* Private mode/);
});

test('scholar status follows the club profile-field ceiling: hidden setting, no scholar status even for a saved session',async()=>{
 const h=harness();
 h.state().apps.forEach(a=>a.student={studentProfile:{firstName:'QA',lastName:'Applicant',scholarStatus:{selections:['ECHOLS'],other:''}}});
 h.mocks['@/actions/applicant-intelligence']={getApplicantDisplay:async d=>({applicationId:d.applicationId,roundId,anonymous:false,configured:['name'],visible:['name'],withheld:[],sections:[{field:'name',label:'Name',items:['QA Applicant']}],photo:null,links:[],observations:[]})};
 h.tx.interviewResumeAnnotation={findMany:async()=>[]};
 await h.create({presentationOptions:{fields:['name','scholarStatus'],highlights:{}}});await h.command('START');
 // The club turns scholar status off after the session was saved with the field.
 h.state().apps.forEach(a=>a.club={profileFieldVisibility:{scholarStatus:false}});
 const room=load('actions/voting-room.ts',h.mocks);
 const shown=await room.getLiveVotingPresentation({...h.scope,applicationId:h.state().sessions[0].activeApplicationId??apps[0]});
 assert.equal('scholarStatus'in shown,false);assert.equal(shown.requestedFields.includes('scholarStatus'),false);
 // Setup lists it as hidden by the club setting and refuses a new session with it.
 h.round.club={profileFieldVisibility:{scholarStatus:false}};
 const setup=load('actions/voting-room-setup.ts',h.mocks),info=await setup.getLiveVotingSetup({clubId,roundId,cycleId:h.cycle.id});
 assert.equal(info.allowedFields.includes('scholarStatus'),false);assert.ok(info.hiddenProfileFields.includes('scholarStatus'));
 const pf=load('lib/profile-field-visibility.ts');
 assert.equal(pf.allowedByProfileCeiling('scholarStatus',pf.normalizeProfileFieldVisibility({scholarStatus:false})),false);
 assert.equal(pf.allowedByProfileCeiling('scholarStatus',pf.normalizeProfileFieldVisibility(null)),true,'on by default, as in #385');
 const slides=load('lib/voting-slide-fields.ts');
 assert.deepEqual(slides.selectedScholarStatus(['scholarStatus'],false,{selections:['ECHOLS'],other:''},false),{});
 for(const file of ['actions/voting-room.ts','actions/voting-session-setup.ts','lib/demo/voting-room.ts'])assert.match(read(file),/allowedByProfileCeiling\(['"]scholarStatus['"]/,file);
});

test('one assembly for every voting slide payload: requestedFields lists only the parts present',()=>{
 const slides=load('lib/voting-slide-fields.ts');
 const p=slides.assembleVotingPresentation({display:{visible:['name'],sections:[]},evidence:{interviewScore:{current:{}}},highlight:{},observations:{},scholar:{scholarStatus:['Echols Scholars Program']},prepared:{preparedHighlights:[]}});
 assert.deepEqual(p.requestedFields,['name','scholarStatus','interviewScore']);assert.deepEqual(p.preparedHighlights,[]);
 assert.deepEqual(slides.assembleVotingPresentation({display:{visible:[]},evidence:{},highlight:{resumeHighlight:null},observations:{additionalObservations:[]},scholar:{}}).requestedFields,['resumeHighlight','additionalObservations']);
 for(const file of ['actions/voting-room.ts','actions/voting-session-setup.ts','lib/demo/voting-room.ts'])assert.match(read(file),/assembleVotingPresentation\(\{display:/,file);
});

test('projector: "next" names the applicant in identified rounds and keeps anonymous labels in anonymous rounds',async()=>{
 const names=load('components/live-voting/room-names.ts');
 const room={passNumber:1,currentApplicantId:'a',history:[{number:1,candidates:[{applicationId:'a',position:0},{applicationId:'b',position:1}]}]};
 assert.equal(names.nextName(room,[{id:'b',label:'Jordan Ellis'}]),'Jordan Ellis');
 assert.equal(names.nextName(room,undefined),'Applicant 2','a presenter without leader labels sees the number');
 // The labels come from the leader summary, which uses anonymous labels in an anonymous round.
 const h=harness();h.state().apps.forEach(a=>a.student={studentProfile:{firstName:'Secret',lastName:'Name'}});
 await h.create({presentationOptions:{fields:[],highlights:{}}});h.round.anonymousReview=true;
 const final=load('actions/voting-room-finalization.ts',h.mocks),summary=await final.getLiveVotingSummary(h.scope);
 assert.ok(summary.labels.length>0);for(const l of summary.labels){assert.match(l.label,/^Applicant [0-9A-F]{10}$/);assert.doesNotMatch(l.label,/Secret|Name/);}
 h.round.anonymousReview=false;const identified=await final.getLiveVotingSummary(h.scope);assert.ok(identified.labels.every(l=>l.label==='Secret Name'));
});

test('own application (#392): no slide, scholar, totals or result; the projector keeps round counts without the access note',()=>{
 const presentation=read('components/live-voting/room-presentation.tsx'),audience=read('components/live-voting/audience-room.tsx'),tracker=read('components/live-voting/round-tracker.tsx');
 assert.match(presentation,/if\(isOwnApplication\(data\)\)return <p role="status" className="vr-own-application">/);
 assert.ok(presentation.indexOf('isOwnApplication(data)')<presentation.indexOf('<ApplicantSlide'),'checked before any slide renders');
 assert.match(audience,/const aside=!own&&entry/);
 assert.match(tracker,/variant==="panel"&&summary\.partial&&/);
});

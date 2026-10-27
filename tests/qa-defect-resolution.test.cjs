const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,id}=require('./helpers/interview-harness.cjs');

test('D8 JSONB key order is not a pipeline edit; real value and array-order edits remain dirty',()=>{
 const {editorValue,sameEditorBase}=harness().load('lib/editor-value.ts');
 const a=[{id:id(1),name:'Round',type:'INTERVIEW',configuration:{instructions:'Keep',duration:20}}],b=[{configuration:{duration:20,instructions:'Keep'},type:'INTERVIEW',name:'Round',id:id(1)}];
 assert.notEqual(JSON.stringify(a),JSON.stringify(b),'negative control reproduces original dirty comparison');assert.equal(editorValue(a),editorValue(b));assert.equal(sameEditorBase(JSON.stringify(a),JSON.stringify(b)),true);
 assert.notEqual(editorValue(a),editorValue([{...b[0],configuration:{duration:25,instructions:'Keep'}}]));assert.notEqual(editorValue([a[0],{...a[0],id:id(2)}]),editorValue([{...a[0],id:id(2)},a[0]]));assert.equal(sameEditorBase('corrupt',JSON.stringify(a)),false);
});
test('D3 scheduled-day boundaries use Eastern DST rather than UTC or a fixed 24 hours',()=>{
 const {interviewHistoryWindow}=harness().load('lib/interview-score-history.ts');
 const spring=interviewHistoryWindow('2026-03-08T23:30:00Z');assert.equal(spring.start.toISOString(),'2026-03-08T05:00:00.000Z');assert.equal(+spring.end-+spring.start,23*3600000);
 const fall=interviewHistoryWindow('2026-11-01T22:30:00Z');assert.equal(+fall.end-+fall.start,25*3600000);
 assert.equal(interviewHistoryWindow('2026-10-02T02:00:00Z').start.toISOString(),'2026-10-01T04:00:00.000Z');
});
test('D3 history averages finalized reviewers once, preserves fractions, takes five applicants with deterministic ties',()=>{
 const {previousApplicantScores}=harness().load('lib/interview-score-history.ts');
 const reviews=[{id:'one',interviewerId:'one',score:8.25,submittedAt:'2026-10-01T12:00:00Z'},{id:'two',interviewerId:'two',score:9,submittedAt:'2026-10-01T12:00:00Z'},{id:'duplicate',interviewerId:'one',score:1,submittedAt:'2026-10-01T12:00:00Z'},{id:'draft',interviewerId:'three',score:10,submittedAt:null}];
 const rows=previousApplicantScores(Array.from({length:7},(_,i)=>({id:'app-'+i,name:'Synthetic '+i,reviews})));
 assert.deepEqual(rows.map(r=>r.id),['app-6','app-5','app-4','app-3','app-2']);assert.equal(rows[0].score,8.625);assert.deepEqual(previousApplicantScores([{id:'a',name:'Synthetic',reviews:[]}]),[]);
});
test('D3 server limits room/day/round/club and selects no private notes; reviewer must finish before peer averages',async()=>{
 const h=harness(),api=h.load('actions/interview-kits.ts');let query;
 h.tx.interviewBooking.findUnique=async()=>({slot:{startTime:new Date('2026-10-02T02:00:00Z'),room:{id:'room',clubId:h.scope.clubId,roundId:h.scope.roundId}}});
 h.tx.interviewBooking.findMany=async q=>{query=q;return[{applicationId:id(70),application:{roundId:h.scope.roundId,interviewAssignments:[{id:'grant'}],student:{studentProfile:{firstName:'Synthetic',lastName:'Previous'}}}}]};
 h.tx.interviewRecord.findMany=async()=>[{id:'mine',applicationId:id(70),interviewerId:h.members[0].id,anonymousReview:false,evaluation:{score:8,submittedAt:new Date('2026-10-01T20:00:00Z')}},{id:'peer',applicationId:id(70),interviewerId:h.members[1].id,anonymousReview:false,evaluation:{score:9,submittedAt:new Date('2026-10-01T20:01:00Z')}}];
 assert.equal((await api.getPreviousInterviewScores(h.scope))[0].score,8.5);assert.equal(query.where.roundId,h.scope.roundId);assert.equal(query.where.slot.roomId,'room');assert.equal(query.where.slot.clubId,h.scope.clubId);assert.equal(query.where.slot.startTime.gte.toISOString(),'2026-10-01T04:00:00.000Z');assert.deepEqual(query.where.applicationId,{not:h.scope.applicationId});assert.doesNotMatch(JSON.stringify(query.select),/draft|questionNotes|additionalNotes/);
 h.as(12);assert.deepEqual(await api.getPreviousInterviewScores(h.scope),[],'unfinished reviewer cannot see peers');h.deny(true);await assert.rejects(api.getPreviousInterviewScores(h.scope),/unavailable/);
});
test('D9 options are the union of authorized rows and known rounds without adding access capabilities',()=>{
 const {interviewRoomRoundOptions}=harness().load('lib/interview-entry.ts');
 const out=interviewRoomRoundOptions([{id:'a',name:'Known'}],[{roundId:'b',roundName:'Awaiting booking'},{roundId:'b',roundName:'Awaiting booking'}]);assert.deepEqual(out,[{id:'a',name:'Known'},{id:'b',name:'Awaiting booking'}]);assert.deepEqual(interviewRoomRoundOptions([],[]),[]);
});
test('D7 no global phase shortcut or implicit form submission; field handlers remain deliberate',()=>{
 const workspace=fs.readFileSync('components/views/interview-workspace-view.tsx','utf8'),session=fs.readFileSync('components/interview-kit-session.tsx','utf8');assert.doesNotMatch(workspace,/requestSubmit\(/);assert.match(session,/onSubmit=\{e => \{ e.preventDefault\(\); \}\}/);assert.match(session,/onClick=\{\(\) => void endInterview\(\)\}/);
});
test('D6 expected invitation unavailability is typed; unexpected errors never return private diagnostics',async()=>{
 const h=harness(),api=h.load('actions/interview-rooms.ts');
 assert.deepEqual(await api.getBookingApplication('malformed',h.scope.roundId),{status:'unavailable'});
 assert.deepEqual(await api.getBookingApplication(id(99),h.scope.roundId),{status:'unavailable'});
 h.tx.application.findFirst=async()=>({id:h.scope.applicationId});assert.deepEqual(await api.getBookingApplication(h.scope.clubId,h.scope.roundId),{status:'ready',applicationId:h.scope.applicationId});
 h.tx.application.findFirst=async()=>{throw Error('PRIVATE CONNECTION DETAILS')};const error=console.error,logs=[];try{console.error=(...args)=>logs.push(args);assert.deepEqual(await api.getBookingApplication(h.scope.clubId,h.scope.roundId),{status:'error'});}finally{console.error=error}assert.doesNotMatch(JSON.stringify(logs),/PRIVATE CONNECTION/);
});

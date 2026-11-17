// Voting setup polish: the plain-language rule sentence, instant preview narrowing, and the setup page's structure.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./helpers/voting-harness.cjs');
const rules=load('lib/voting-rules.ts'),slides=load('lib/voting-slide-fields.ts');
const threshold=(extra={})=>({mode:'THRESHOLD',threshold:{numerator:2,denominator:3},denominator:'BALLOTS_CAST',minimumParticipation:{numerator:1,denominator:2},belowThreshold:'HOLD',reviewed:true,...extra});
const read=f=>fs.readFileSync(f,'utf8');

test('describeVotingRule: both counting bases and both below-threshold outcomes',()=>{
 assert.equal(rules.describeVotingRule(threshold()),'An applicant passes if at least 2/3 of ballots cast are Pass and at least 1/2 of eligible voters took part. Otherwise they’re held for another vote.');
 assert.equal(rules.describeVotingRule(threshold({denominator:'ELIGIBLE_VOTERS'})),'An applicant passes if at least 2/3 of all eligible voters vote Pass and at least 1/2 of eligible voters took part. Otherwise they’re held for another vote.');
 const reject=rules.describeVotingRule(threshold({belowThreshold:'REJECT'}));
 assert.match(reject,/Below the threshold they don’t pass; if too few vote, nobody is rejected automatically\.$/);
 // Unanimous fractions read as "all", not "at least 3/3".
 assert.equal(rules.describeVotingRule(threshold({threshold:{numerator:3,denominator:3},minimumParticipation:{numerator:1,denominator:1}})),'An applicant passes if all of ballots cast are Pass and every eligible voter took part. Otherwise they’re held for another vote.');
 // The saved shape and the parsed shape describe identically.
 assert.equal(rules.describeVotingRule(rules.votingRulesSchema.parse(threshold())),rules.describeVotingRule(threshold()));
});

test('describeVotingRule: leader-confirmed, unknown and missing configuration read as leader-confirmed',()=>{
 for(const value of [{mode:'LEADER_CONFIRMS'},null,undefined,{},{mode:'SOMETHING_ELSE'}])assert.equal(rules.describeVotingRule(value),'Leader confirms each outcome.');
});

test('describeVotingRule: missing or partial threshold values never render undefined, null or NaN',()=>{
 const partials=[{mode:'THRESHOLD'},{mode:'THRESHOLD',threshold:{numerator:2}},{mode:'THRESHOLD',threshold:{numerator:null,denominator:3},denominator:null},
  {mode:'THRESHOLD',threshold:{numerator:NaN,denominator:3},minimumParticipation:{numerator:4,denominator:3}},{mode:'THRESHOLD',threshold:{numerator:2,denominator:3},minimumParticipation:null,belowThreshold:null},
  {mode:'THRESHOLD',threshold:{numerator:0,denominator:0},denominator:'ELIGIBLE_VOTERS',belowThreshold:'REJECT'}];
 for(const value of partials){const text=rules.describeVotingRule(value);assert.doesNotMatch(text,/undefined|null|NaN|\?/,JSON.stringify(value));assert.match(text,/^An applicant passes if .+\./);}
 assert.equal(rules.describeVotingRule({mode:'THRESHOLD'}),'An applicant passes if enough of the votes are Pass.');
 assert.equal(rules.describeVotingRule({mode:'THRESHOLD',threshold:{numerator:3,denominator:5},denominator:'BALLOTS_CAST'}),'An applicant passes if at least 3/5 of ballots cast are Pass.');
});

test('narrowVotingSlide keeps only the selected fields and never adds content',()=>{
 const full={applicationId:'a',anonymous:false,visible:['photo','name','major','gpa'],configured:['photo','name','major','gpa'],sections:[{field:'name',items:['QA 1']},{field:'major',items:['Physics']},{field:'gpa',items:['3.9']}],photo:'p.png',links:[],
  requestedFields:['photo','name','major','gpa','interviewScore','finalInterviewThoughts','resumeHighlight','additionalObservations'],interviewScore:{scope:'x'},finalInterviewThoughts:[],interviewFeedback:{roundId:'r'},earlierInterviewRounds:[{roundName:'R1'}],resumeHighlight:null,additionalObservations:[]};
 const some=slides.narrowVotingSlide(full,['name','major','interviewScore']);
 assert.deepEqual(some.visible,['name','major']);assert.deepEqual(some.sections.map(s=>s.field),['name','major']);assert.equal(some.photo,null);
 assert.deepEqual(some.requestedFields,['name','major','interviewScore']);
 // Score without thoughts (or the reverse) is projected differently on the server, so no evidence is shown until the exact read.
 assert.equal(slides.narrowsExactly(['name','interviewScore']),false);assert.equal(slides.narrowsExactly(['name','finalInterviewThoughts']),false);
 for(const gone of ['interviewScore','finalInterviewThoughts','interviewFeedback','earlierInterviewRounds','resumeHighlight','additionalObservations'])assert.equal(gone in some,false,gone);
 const both=slides.narrowVotingSlide(full,['interviewScore','finalInterviewThoughts']);assert.equal(slides.narrowsExactly(['interviewScore','finalInterviewThoughts']),true);
 for(const kept of ['interviewScore','finalInterviewThoughts','interviewFeedback','earlierInterviewRounds'])assert.ok(kept in both,kept);
 const none=slides.narrowVotingSlide(full,[]);assert.deepEqual(none.sections,[]);assert.equal('earlierInterviewRounds'in none,false);assert.equal(none.photo,null);
 assert.deepEqual(slides.narrowVotingSlide(full,['photo']).photo,'p.png');
 assert.deepEqual(full.visible,['photo','name','major','gpa'],'the full read is not mutated');
});

test('setup has one way out: no Back to Voting room links; Exit returns to the Voting room and shows save status',()=>{
 const src=read('components/live-voting/room-setup.tsx');
 assert.doesNotMatch(src,/Back to Voting room|VotingBackLink|Return to Applicants/);
 assert.match(src,/useFocusFrame\(\{exitHref:selectionKey\?`\/club\/\$\{encodeURIComponent\(clubId\)\}\/workspace\?section=recruitment&tool=applicants`:decisionsHref\(clubId,'voting',exitSearch\),status:/);
 // Exit is a link, so pending draft edits are saved before it navigates.
 assert.match(read('lib/autosave-navigation.ts'),/closest<HTMLElement>\("nav a, nav button, \[data-shell-navigation\], a\[href\]"\)/);
 assert.match(read('components/shell/focus-frame.tsx'),/className="oc-focus-status" role="status" aria-live="polite"/);
});

test('steps are buttons in a labelled nav; going forward runs the same validation as Continue',()=>{
 const src=read('components/live-voting/room-setup.tsx');
 assert.match(src,/<nav aria-label="Setup steps" className="vr-steps">/);
 assert.match(src,/<button type="button" className="vr-step" aria-current=\{step===n\?'step':undefined\}[^>]*onClick=\{\(\)=>goTo\(n\)\}>/);
 assert.match(src,/function goTo\(next:number\)\{if\(next===step\)return;if\(next<step\)return move\(next\);for\(let at=step;at<next;at\+\+\)\{try\{validate\(at\);\}catch\(e\)\{if\(e instanceof SetupError&&stepOf\(e\.field\)!==step\)move\(stepOf\(e\.field\)\)/);
 assert.match(src,/step<3\?<Button disabled=\{busy\|\|!!pending\.current\} onClick=\{\(\)=>goTo\(step\+1\)\}>Continue<\/Button>/);
 // Start session still re-validates everything and the server re-validates the payload; a step click cannot skip either.
 assert.match(src,/if\(!pending\.current\)\{try\{validate\(2\);\}catch/);
 // Server side: create and update both re-run the full setup validation, whatever step the browser was on.
 assert.match(read('actions/voting-room.ts'),/export async function createLiveVotingRoom[\s\S]*?validateVotingSetup\(tx,d,user,\{rejectHiddenProfileFields:true\}\)/);
 assert.match(read('actions/voting-session-setup.ts'),/validateVotingSetup\(tx,d,user,\{rejectHiddenProfileFields:true\}\)/);
 // Errors sit next to their control and are linked to it.
 assert.match(src,/const show=\(field:SetupField\)=>problem\?\.field===field\?<p id=\{`\$\{uid\}-problem`\} role="alert"/);
 assert.match(src,/aria-describedby=\{`\$\{uid\}-target-help \$\{describe\('target'\)/);
});

test('every presentation field has a group, the old disclosures are gone, and both titles are set',()=>{
 const src=read('components/live-voting/room-setup.tsx'),room=load('lib/voting-room.ts');
 const grouped=[...src.match(/const fieldGroups[^\n]*/)[0].matchAll(/"(\w+)"/g)].map(m=>m[1]).filter(f=>room.liveRoomFields.includes(f));
 assert.deepEqual([...grouped].sort(),[...room.liveRoomFields].sort());
 assert.doesNotMatch(src,/Duration and repeated-hour options|Location and participant instructions · Optional|<details/);
 assert.match(src,/Only matters on the night daylight saving time ends\./);
 const page=read('app/(focus)/voting/rooms/new/page.tsx');
 assert.match(page,/title: z\.string\(\)\.uuid\(\)\.safeParse\(q\.session\)\.success\?"Edit voting":"Set up voting"/);
 // The live summary and the preview are announced politely.
 assert.match(read('components/live-voting/voting-rule-editor.tsx'),/<p className="vr-setup-summary" aria-live="polite">In plain terms: /);
 assert.match(src,/<div className="vr-setup-preview-frame" aria-live="polite">/);
});

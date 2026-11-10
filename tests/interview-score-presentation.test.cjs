// One canonical interview score calculation and presentation across review lists, details and voting.
const {test}=require('node:test'),assert=require('node:assert/strict');
const load=file=>require('./helpers/interview-harness.cjs').harness().load(file);
const summary=load('lib/interview-review-summary.ts'),voting=load('lib/voting-interview-evidence.ts'),feedback=load('lib/interview-feedback.ts');
const at='2026-11-01T12:00:00Z',sub=(interviewerId,score,roundId='r2',submittedAt=at)=>({interviewerId,score,roundId,submittedAt});

test('no qualifying scores is "Not scored", never 0',()=>{
 const s=summary.submittedScoreSummary([],['a','b']);assert.equal(s.average,null);assert.equal(s.submitted,0);assert.equal(summary.formatAverage(s.average),'Not scored');
 const drafts=summary.submittedScoreSummary([sub('a',7,'r2',null),sub('b',NaN),sub('c',0),sub('d',11)],['a','b','c','d']);
 assert.equal(drafts.average,null,'drafts, missing and out-of-range scores do not count');assert.equal(drafts.submitted,0);assert.equal(drafts.provisional,true);
});
test('one score and multiple scores: equal-weight mean with full precision, displayed to one decimal',()=>{
 assert.equal(summary.submittedScoreSummary([sub('a',8.5)],[]).average,8.5);assert.equal(summary.formatAverage(8.5),'8.5');
 const many=summary.submittedScoreSummary([sub('a',9),sub('b',7.5),sub('c',8)],[]);assert.equal(many.average,24.5/3);assert.equal(many.submitted,3);
 assert.equal(summary.formatAverage(many.average),'8.2');assert.equal(summary.formatAverage(9),'9.0');assert.equal(summary.formatAverage(8.25),'8.3');
 assert.equal(summary.formatScore(9),'9');assert.equal(summary.formatScore(8.5),'8.5');assert.equal(summary.scoredEvaluationsLabel(1),'1 scored evaluation');assert.equal(summary.scoredEvaluationsLabel(3),'3 scored evaluations');
});
test('partial submissions: only submitted scores count; pending interviewers are not zeros',()=>{
 const s=summary.submittedScoreSummary([sub('a',9),sub('b',3,'r2',null)],['a','b','c']);
 assert.equal(s.average,9,'unsubmitted 3 is excluded, pending c is not 0');assert.equal(s.submitted,1);assert.equal(s.required,3);assert.equal(s.provisional,true);
});
test('duplicate or retried submissions count once per interviewer (canonical first = latest when ordered newest first)',()=>{
 const s=summary.submittedScoreSummary([sub('a',6),sub('a',10),sub('b',8)],[]);assert.equal(s.submitted,2);assert.equal(s.average,7);
});
test('round isolation: each round averages only its own evaluations; cross-round totals are labelled separately',()=>{
 const rounds=[{id:'r1',name:'First interview'},{id:'r2',name:'Final interview'}];
 const v=voting.votingScoreEvidence(rounds,[sub('a',4,'r1'),sub('a',9,'r2'),sub('b',8,'r2'),sub('z',1,'other')]);
 assert.deepEqual(v.byRound.map(r=>[r.roundId,r.average,r.submitted]),[['r1',4,1],['r2',8.5,2]]);
 assert.equal(v.submitted,3,'the same interviewer in two rounds counts once per round; foreign rounds are ignored');
});
test('feedback section average uses the same calculation for its labelled round only, and is withheld with scores',()=>{
 const allowed=[{id:'r1',name:'First interview'},{id:'r2',name:'Final interview'}];
 const reviews=[{id:'e1',roundId:'r1',interviewerId:'a',score:2,submittedAt:at,interviewer:'Avery'},{id:'e2',roundId:'r2',interviewerId:'a',score:9,submittedAt:at,interviewer:'Avery'},{id:'e3',roundId:'r2',interviewerId:'b',score:7.5,submittedAt:at,interviewer:'Blake'},{id:'e4',roundId:'r2',interviewerId:'c',score:6,submittedAt:null,interviewer:'Casey'}];
 const f=feedback.buildInterviewFeedback({allowed,requestedRoundId:'r2',reviews,summaries:[],pendingMemberIds:['a','b','c'],includeScores:true});
 assert.equal(f.average,8.25);assert.equal(f.scored,2);assert.equal(f.pending,1);assert.equal(summary.formatAverage(f.average),'8.3');
 assert.deepEqual(f.entries.map(e=>[e.interviewer,e.score]),[['Avery',9],['Blake',7.5]]);
 const hidden=feedback.buildInterviewFeedback({allowed,requestedRoundId:'r2',reviews,summaries:[],pendingMemberIds:[],includeScores:false});
 assert.equal(hidden.average,null);assert.equal(hidden.scored,0);assert.ok(hidden.entries.every(e=>e.score===null));
});

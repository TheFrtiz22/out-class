const {test}=require('node:test'),assert=require('node:assert/strict'),{loader}=require('./helpers/communications-loader.cjs');
const {panelIssueSummary:summarize}=loader({})('lib/panel-issue-summary.ts');
test('staffing summary counts distinct vacant slots, separates full-panel conflicts and uses correct grammar',()=>{
 const validation={sessions:[{slotId:'a',proposed:0,required:2,unfilled:2},{slotId:'b',proposed:1,required:3,unfilled:2},{slotId:'b',proposed:1,required:3,unfilled:2},{slotId:'c',proposed:2,required:2,unfilled:1}],issues:[{slotId:'c',code:'UNAVAILABLE'},{slotId:'c',code:'DOUBLE_BOOKED'},{slotId:'b',code:'UNCONFIRMED'}]};
 let s=summarize(validation);assert.equal(s.staffingText,'2 slots need interviewers');assert.equal(s.conflictText,'2 slots have assignment conflicts');assert.deepEqual(s.missingSlots,['a','b']);assert.deepEqual(s.conflictSlots,['c','b']);
 s=summarize({sessions:[validation.sessions[0]],issues:[validation.issues[0],validation.issues[1]]});assert.equal(s.staffingText,'1 slot needs interviewers');assert.equal(s.conflictText,'1 slot has assignment conflicts');
 s=summarize({sessions:[validation.sessions[3]],issues:validation.issues.slice(0,2)});assert.equal(s.staffingText,'');assert.equal(s.conflictSlots.length,1);
 assert.equal(summarize({sessions:[{slotId:'a',required:2,proposed:2,unfilled:0}],issues:[]}).staffingText,'All slots are staffed.');assert.equal(summarize({sessions:[],issues:[]}).staffingText,'No interview slots to check.');
});

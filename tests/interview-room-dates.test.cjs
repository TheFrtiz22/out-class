const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/interview-harness.cjs');
const api=harness().load('lib/interview-room-dates.ts');
const row=(id,start,extra={})=>({id,startTime:start,endTime:start,timezone:'America/New_York',...extra});
test('date groups and slots stay chronological regardless of interview status, with stable tie ordering',()=>{
 const g=api.groupInterviewDates([row('b','2026-10-21T15:00:00Z',{started:true}),row('z','2026-10-20T17:00:00Z'),row('a','2026-10-20T17:00:00Z',{completed:true}),row('x','2026-10-20T16:00:00Z')]);
 assert.deepEqual(g.map(v=>v.day),['2026-10-20','2026-10-21']);assert.deepEqual(g[0].entries.map(r=>r.id),['x','a','z']);assert.match(g[0].label,/Tuesday, October 20, 2026/);
});
test('today uses the schedule timezone; absent today opens only nearest upcoming day; past-only dates stay collapsed',()=>{
 const g=api.groupInterviewDates([row('old','2026-10-18T17:00:00Z'),row('first','2026-10-20T17:00:00Z'),row('later','2026-10-21T17:00:00Z')]);
 assert.equal(api.defaultInterviewDate(g,new Date('2026-10-20T22:00:00Z')),'2026-10-20');assert.equal(api.defaultInterviewDate(g,new Date('2026-10-19T12:00:00Z')),'2026-10-20');assert.equal(api.defaultInterviewDate(g,new Date('2026-10-21T02:00:00Z')),'2026-10-20');assert.equal(api.defaultInterviewDate(g,new Date('2026-11-01T12:00:00Z')),undefined);assert.equal(api.defaultInterviewDate([],new Date()),undefined);
});
test('URL choices distinguish never initialized from deliberately all collapsed and retain multiple days safely',()=>{
 assert.equal(api.readExpandedInterviewDates('roundId=round'),null);assert.deepEqual(api.readExpandedInterviewDates('interviewDays='),[]);assert.deepEqual(api.readExpandedInterviewDates('interviewDays=2026-10-20,2026-10-21,2026-10-20,nope'),['2026-10-20','2026-10-21']);
});

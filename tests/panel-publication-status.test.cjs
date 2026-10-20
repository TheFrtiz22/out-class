const {test}=require('node:test'),assert=require('node:assert/strict'),{loader}=require('./helpers/communications-loader.cjs');
const {panelPublicationStatus:status}=loader({})('lib/panel-publication-status.ts');
const published={version:1,window:{start:'2099-12-01T05:00:00.000Z',end:'2099-12-02T05:00:00.000Z'},options:{maxConsecutiveMinutes:null,breakMinutes:15},sessions:[{id:'slot',roomId:'room',roomName:'Hall',timezone:'America/New_York',startTime:'2099-12-01T15:00:00.000Z',endTime:'2099-12-01T15:20:00.000Z',buffer:0,required:1,active:true,roomRevision:0,slotRevision:0,existingMemberIds:[]}],assignments:[{slotId:'slot',memberId:'member',locked:false,source:'AUTO'}]};
test('publication labels distinguish actual booking, draft and approval state without bookkeeping false positives',()=>{
 const live={bookingPublishedAt:'2026-10-19T00:00:00Z',bookingPaused:false};
 assert.equal(status(undefined).label,'Booking is unpublished');assert.equal(status(undefined,undefined,published).label,'Booking is unpublished · Awaiting interviewer approval');
 assert.equal(status(live,published).label,'Booking is live');assert.equal(status(live,published,structuredClone(published)).changed,false);
 const unchanged=structuredClone(published);unchanged.sessions[0].roomRevision++;unchanged.sessions[0].existingMemberIds=['member'];unchanged.assignments[0].source='EXISTING';unchanged.assignments[0].locked=true;assert.equal(status(live,published,unchanged).changed,false);
 const changed=structuredClone(published);changed.assignments=[];assert.equal(status(live,published,changed).label,'Booking is live · Unpublished changes');assert.equal(status(live,published,changed).detail,'Your changes take effect after approval.');
 assert.equal(status({...live,bookingPaused:true},published,changed).label,'Booking is paused · Unpublished changes');assert.equal(status(undefined,published,changed).label,'Booking is unpublished · Unpublished changes');
 const subset=structuredClone(published);subset.sessions=[];subset.assignments=[];assert.equal(status(live,published,subset).changed,false,'outside-window assignments remain published');
 for(const alter of [d=>d.options.breakMinutes=30,d=>d.sessions[0].required=2,d=>d.sessions[0].active=false,d=>d.sessions[0].roomName='New hall']){const d=structuredClone(published);alter(d);assert.equal(status(live,published,d).changed,true)}
});

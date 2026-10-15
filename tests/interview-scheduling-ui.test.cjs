const {test}=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./helpers/demo-harness.cjs')
const {schedulingEntry,bookingState}=harness().load('lib/interview-scheduling-ui.ts')
const settings={bookingPublishedAt:null,bookingPaused:false,bookingRevision:0,bookingCycleId:null,bookingAllowCancellation:true,bookingAllowRescheduling:true}
const data={rounds:[{id:'one',booking:{...settings}},{id:'two',booking:{...settings}}],rooms:[]}
test('new, configured and published rounds open their appropriate screen within the selected round',()=>{
 assert.equal(schedulingEntry(data,'one'),'rooms');data.rooms.push({roundId:'two'});assert.equal(schedulingEntry(data,'one'),'rooms');assert.equal(schedulingEntry(data,'two'),'review');data.rounds[1].booking.bookingPublishedAt='2026-01-01';assert.equal(schedulingEntry(data,'two'),'bookings');assert.equal(schedulingEntry(data,'one'),'rooms')
 assert.equal(schedulingEntry(data,'two','rooms'),'rooms');assert.equal(schedulingEntry(data,'two','fill'),'review');assert.equal(schedulingEntry(data,'two','nonsense'),'bookings')
})
test('booking presentation distinguishes draft, paused, full and published without changing server eligibility',()=>{
 const rooms=[{isOpen:true,slots:[{startTime:'2099-01-01',capacity:1,booked:1}]}],live={...settings,bookingPublishedAt:'2026-01-01'}
 assert.equal(bookingState(settings,rooms),'Draft');assert.equal(bookingState({...live,bookingPaused:true},rooms),'Paused');assert.equal(bookingState(live,rooms),'Full');rooms[0].slots[0].booked=0;assert.equal(bookingState(live,rooms),'Published');rooms[0].isOpen=false;assert.equal(bookingState(live,rooms),'Published')
})

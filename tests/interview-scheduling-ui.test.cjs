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
test('Demo scheduling exposes saved per-round duration just like the live room workspace',async()=>{
 const h=harness(),store=h.load('lib/demo/store.ts').demoStore;store.start(h.load('lib/demo/seed.ts').createDemoSeed('2099-09-07'));const club=store.get().clubs[0];store.mutate(s=>s.perspective={role:'leader',clubId:club.id});const workspace=await h.load('lib/workspace-api.ts').getRoomWorkspace(club.id),round=workspace.rounds.find(r=>r.name==='Round 2');assert.equal(round.configuration.duration,35);assert.equal(h.calls(),0);store.stop()
})
test('booking progress counts distinct booked applicants against those invited, and future open times',()=>{
 const {bookingProgress}=harness().load('lib/interview-scheduling-ui.ts')
 const rooms=[{isOpen:true,slots:[{startTime:'2099-01-01T15:00:00Z',capacity:2,booked:1},{startTime:'2000-01-01T15:00:00Z',capacity:3,booked:0}]},{isOpen:false,slots:[{startTime:'2099-01-02T15:00:00Z',capacity:4,booked:0}]}]
 const bookings=[{applicationId:'a'},{applicationId:'a'}]
 assert.equal(bookingProgress(12,rooms,bookings),'1 of 12 invited applicants have booked. 1 open time left.')
 assert.equal(bookingProgress(1,rooms,bookings),'Every invited applicant has booked. 1 open time left.')
 assert.equal(bookingProgress(0,rooms,[]),'No applicants are invited to this round yet. 1 open time left.')
 assert.equal(bookingProgress(undefined,rooms,bookings),'1 applicant booked. 1 open time left.')
})

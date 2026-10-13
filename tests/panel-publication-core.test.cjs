const {test}=require('node:test'),assert=require('node:assert/strict'),{loader}=require('./helpers/communications-loader.cjs')
const load=loader({}),p=load('lib/panel-proposals.ts'),email=load('lib/notification-email.ts'),uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const session=(id,room,time)=>({id,roomId:room,roomName:room,timezone:'UTC',startTime:`2030-10-12T${time}:00:00.000Z`,endTime:`2030-10-12T${time}:30:00.000Z`,buffer:0,required:1,active:true,roomRevision:0,slotRevision:0,existingMemberIds:[]})
const doc=(sessions,assignments)=>({version:1,window:{start:'2030-10-12T00:00:00.000Z',end:'2030-10-13T00:00:00.000Z'},options:{maxConsecutiveMinutes:null,breakMinutes:15},sessions,assignments})
test('publication differences identify room/time reassignment and preserve unaffected scope in recoverable history',()=>{
 const a=session('a','A','09'),b=session('b','B','09'),c=session('c','C','10'),before=doc([a,b,c],[{slotId:'a',memberId:'x',locked:false,source:'AUTO'},{slotId:'c',memberId:'y',locked:true,source:'MANUAL'}]),proposal=doc([a,b],[{slotId:'b',memberId:'x',locked:false,source:'MANUAL'}]),merged=p.mergePanelPublication(before,proposal)
 assert.ok(merged.assignments.some(a=>a.slotId==='c'&&a.locked));assert.equal(merged.sessions.length,3);const changes=p.panelScheduleChanges(before,merged);assert.equal(changes.length,1);assert.equal(changes[0].kind,'ROOM_CHANGED')
 const later={...proposal,sessions:[{...b,startTime:'2030-10-12T11:00:00.000Z'}]};assert.ok(p.panelScheduleChanges(proposal,later).some(c=>c.kind==='TIME_CHANGED'))
})
test('approved panel email details are escaped and linked canonically; mixed digests preserve decision links and private-message privacy',()=>{
 const panel={type:'INTERVIEW',title:'Panel assigned',club:{name:'Test Club'},panelSchedule:{notificationId:uuid(1),href:`/settings/interviews?clubId=${uuid(2)}&roundId=${uuid(3)}`,details:['Mon · Hall <script>alert(1)</script> · 9:00–9:30 (UTC)'],signature:'a'.repeat(64)}}
 const payload=email.buildNotificationEmail({from:'updates@out-class.net',to:'person@virginia.edu',siteUrl:'https://out-class.net',digest:true,items:[panel,{type:'MESSAGE',title:'Secret applicant message',club:{name:'Test Club'}},{type:'DECISION',title:'Private outcome',club:{name:'Test Club'},href:`/applications/${uuid(4)}/decision?letterId=${uuid(5)}`}]})
 assert.ok(payload.text.includes('9:00–9:30'));assert.ok(payload.text.includes('/settings/interviews?'));assert.ok(payload.text.includes(`/applications/${uuid(4)}/decision?letterId=${uuid(5)}`));assert.equal(payload.text.includes('Secret applicant message'),false);assert.equal(payload.html.includes('<script>'),false);assert.ok(payload.html.includes('&lt;script&gt;'));assert.equal(payload.panelSchedules.length,1)
 assert.throws(()=>email.buildNotificationEmail({from:'updates@out-class.net',to:'person@virginia.edu',siteUrl:'https://out-class.net',digest:false,items:[{...panel,panelSchedule:{...panel.panelSchedule,href:'https://attacker.test'}}]}))
})
test('official panel calendar events preserve exact instants and do not synthesize applicant bookings',()=>{
 const calendar=load('lib/student-calendar-data.ts'),events=calendar.studentCalendarEvents({panelAssignments:[{id:'s',clubId:'c',clubName:'Club',roundName:'Interview',roomName:'Hall',startTime:'2030-10-12T14:00:00.000Z',endTime:'2030-10-12T14:30:00.000Z',location:'Hall'}]})
 assert.equal(events.length,1);assert.equal(events[0].id,'panel-s');assert.equal(events[0].durationMinutes,30);assert.equal(events[0].readOnly,true);assert.equal(events[0].response,'confirmed')
 assert.equal(load('lib/calendar.ts').eventStart(events[0]).toISOString(),'2030-10-12T14:00:00.000Z')
})
test('official panels and existing applicant bookings retain the second repeated DST hour in calendar exports',()=>{
 const original=process.env.TZ;process.env.TZ='America/New_York'
 try{
  const startTime='2026-11-01T06:30:00.000Z',endTime='2026-11-01T07:00:00.000Z',events=load('lib/student-calendar-data.ts').studentCalendarEvents({panelAssignments:[{id:'s',clubId:'c',clubName:'Club',roundName:'Interview',roomName:'Hall',startTime,endTime,location:'Hall'}],applications:[{clubId:'c',club:{name:'Club'},bookings:[{id:'b',slot:{startTime,endTime,location:'Hall'}}]}]}),calendar=load('lib/calendar.ts')
  for(const event of events){assert.equal(event.time,'01:30');assert.equal(calendar.eventStart(event).toISOString(),startTime);const ics=calendar.calendarFile(event);assert.ok(ics.includes('DTSTART:20261101T063000Z'));assert.ok(ics.includes('DTEND:20261101T070000Z'))}
 }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original}
})

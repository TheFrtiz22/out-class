const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function load(file) { const m = { exports: {} }; new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),m,m.exports); return m.exports; }
const lib = load('lib/campus-events.ts'), { calendarEventFile } = load('lib/ical.ts');
test('every duration recalculates elapsed time across midnight and DST', () => {
  for (const start of ['2026-10-16T23:45','2026-03-08T01:45','2026-11-01T01:45']) {
    for (const duration of lib.eventDurations) {
      const s = lib.eventSchedule(start,'',String(duration),false,'');
      assert.equal(+s.endDate-+s.date,duration*60000);
    }
  }
  const s = lib.eventSchedule('2026-10-16T23:45','','60',false,'');
  assert.equal(lib.newYorkInput(s.endDate.toISOString()),'2026-10-17T00:45');
  assert.throws(()=>lib.eventSchedule('2026-03-08T02:15','','60',false,''),/does not exist/);
  assert.throws(()=>lib.eventSchedule('2026-10-16T12:00','2026-10-16T11:00','custom',false,''),/after/);
  assert.throws(()=>lib.eventSchedule('2026-10-16T12:00','','-1',false,''),/duration/);
});
test('single/multi-day all-day dates and calendar export use exclusive local dates across DST', () => {
  for (const [start,last,hours] of [['2026-03-08','2026-03-08',23],['2026-11-01','2026-11-01',25],['2026-03-07','2026-03-09',71]]) {
    const s=lib.eventSchedule(start+'T09:00','','60',true,last);
    assert.equal((s.endDate-s.date)/3600000,hours);
    const event={date:s.date.toISOString(),endDate:s.endDate.toISOString(),allDay:true};
    const label=lib.eventScheduleLabel(event); assert.match(label,/All day/); assert.doesNotMatch(label,/AM|PM|midnight/);
    const ics=calendarEventFile({id:'day',title:'Event',description:'',location:'',start:s.date,end:s.endDate,allDay:true});
    assert.ok(ics.includes('DTSTART;VALUE=DATE:'+start.replaceAll('-','')));
    assert.ok(ics.includes('DTEND;VALUE=DATE:'+lib.eventDay(last,1).replaceAll('-','')));
  }
  assert.throws(()=>lib.eventSchedule('2026-10-16T09:00','','60',true,'2026-10-15'),/on or after/);
});
test('editing existing fall-fold times preserves exact instants and off-quarter minutes',()=>{
 const existing={date:'2026-11-01T06:07:00.000Z',endDate:'2026-11-01T06:52:00.000Z'};
 const s=lib.eventSchedule(lib.newYorkInput(existing.date),lib.newYorkInput(existing.endDate),'custom',false,'',existing);
 assert.equal(s.date.toISOString(),existing.date);assert.equal(s.endDate.toISOString(),existing.endDate);
});
test('server validates actual image signatures and 10 MB limit without changing profile limits',()=>{
 const {validateProfileFile}=load('lib/student-profile.ts');
 const bytes=new Uint8Array(10*1024*1024);bytes.set([137,80,78,71,13,10,26,10]);
 assert.equal(validateProfileFile(bytes,'image/png','flyer'),'image/png');
 assert.throws(()=>validateProfileFile(bytes,'image/png','headshot'),/5 MB/);
 assert.throws(()=>validateProfileFile(new Uint8Array(bytes.length+1),'image/png','flyer'),/10 MB/);
 assert.throws(()=>validateProfileFile(bytes,'image/jpeg','flyer'),/JPEG/);
 assert.throws(()=>validateProfileFile(new TextEncoder().encode('<svg/>'),'image/png','flyer'),/JPEG/);
});

test('student calendar preserves canonical ends and all-day export/overlap instead of defaulting to one hour',()=>{
 const {studentCalendarEvents}=load('lib/student-calendar-data.ts'), calendar=load('lib/calendar.ts');
 const [event]=studentCalendarEvents({meetings:[{id:'day',clubId:'club',title:'Festival',club:{name:'Club'},location:'Lawn',audience:'RECRUITMENT',allDay:true,date:'2026-03-07T05:00:00Z',endDate:'2026-03-10T04:00:00Z'}]});
 assert.equal(event.allDay,true);assert.equal(event.endTime,'2026-03-10T04:00:00.000Z');
 assert.match(calendar.calendarFile(event),/DTEND;VALUE=DATE:20260310/);
 assert.equal(calendar.eventOccursOn(event,'2026-03-09'),true);assert.equal(calendar.eventOccursOn(event,'2026-03-10'),false);
 const {agendaGroups}=load('lib/student-agenda.ts');assert.equal(agendaGroups([event],new Date('2026-03-09T16:00Z'))[0].label,'Today');
});

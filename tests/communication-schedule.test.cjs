const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader}=require('./helpers/communications-loader.cjs');
const {resolveScheduleTime,requireFutureSchedule,scheduleInput}=loader({})('lib/communication-schedule.ts');
test('explicit timezone and calendar validation',()=>{
 assert.equal(resolveScheduleTime('2026-10-20T12:30','America/New_York','EARLIER').toISOString(),'2026-10-20T16:30:00.000Z');
 assert.equal(resolveScheduleTime('2026-10-20T12:30','Asia/Kolkata','EARLIER').toISOString(),'2026-10-20T07:00:00.000Z');
 assert.throws(()=>resolveScheduleTime('2026-02-30T12:30','UTC','EARLIER'),/calendar/);
 assert.throws(()=>resolveScheduleTime('2026-10-20T12:30','Invalid/Zone','EARLIER'));
});
test('spring gap rejected and autumn repeated hour explicitly resolved',()=>{
 assert.throws(()=>resolveScheduleTime('2026-03-08T02:30','America/New_York','EARLIER'),/does not exist/);
 assert.equal(resolveScheduleTime('2026-11-01T01:30','America/New_York','EARLIER').toISOString(),'2026-11-01T05:30:00.000Z');
 assert.equal(resolveScheduleTime('2026-11-01T01:30','America/New_York','LATER').toISOString(),'2026-11-01T06:30:00.000Z');
 assert.throws(()=>resolveScheduleTime('2026-10-04T02:15','Australia/Lord_Howe','EARLIER'),/does not exist/);
 assert.equal(resolveScheduleTime('2026-04-05T01:45','Australia/Lord_Howe','LATER')-resolveScheduleTime('2026-04-05T01:45','Australia/Lord_Howe','EARLIER'),1800000);
});
test('future bounds and untrusted fields fail closed',()=>{
 const now=Date.now();assert.throws(()=>requireFutureSchedule(new Date(now+59999),now));requireFutureSchedule(new Date(now+60000),now);assert.throws(()=>requireFutureSchedule(new Date(now+367*86400000),now));
 assert.throws(()=>scheduleInput.parse({snapshot:{userIds:['injected']}}));
});
test('scheduled cron requires the existing secret and never gates on email',async()=>{
 const prior=process.env.CRON_SECRET;process.env.CRON_SECRET='synthetic-cron';let calls=0;
 try{const route=loader({'@/utils/scheduled-communications':{processScheduledCommunications:async n=>{assert.equal(n,undefined);calls++;return{published:1};}}})('app/api/internal/scheduled-communications/route.ts');
 assert.equal((await route.GET(new Request('http://localhost/api/internal/scheduled-communications'))).status,401);
 assert.equal(calls,0);assert.equal((await route.GET(new Request('http://localhost/api/internal/scheduled-communications',{headers:{authorization:'Bearer synthetic-cron'}}))).status,200);assert.equal(calls,1);
 }finally{if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}
});

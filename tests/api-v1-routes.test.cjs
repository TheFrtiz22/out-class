const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;}return load;}

class BearerAuthError extends Error{constructor(status,message){super(message);this.name='BearerAuthError';this.status=status;}}
const json=(body,init)=>({body,status:init.status,headers:init.headers});
function routes(state){
 const mocks={
  'next/server':{NextResponse:{json}},
  '@/utils/bearer-context':{withBearerIdentity:async(_r,run)=>run()},
  '@/utils/bearer-auth':{BearerAuthError,requireBearerAuth:async()=>{state.events.push('auth');if(state.auth)throw state.auth;return{user:{id:'u1'}};}},
  '@/lib/account-data':{accountUserInclude:{}},
  '@/lib/permissions':{hasWorkspace:m=>m.role==='OWNER'},
  '@/utils/prisma':{prisma:{user:{findUnique:async()=>state.account}}},
  '@/actions/club-directory':{getClubDirectory:async()=>{state.events.push('directory');return state.directory;}},
 };
 const load=loader(mocks);
 return {me:load('app/api/v1/me/route.ts'),clubs:load('app/api/v1/clubs/route.ts')};
}
const req=new Request('https://out-class.net/api/v1/x');

test('unauthenticated requests get 401 and never reach data',async()=>{
 const state={events:[],auth:new BearerAuthError(401,'Sign-in required.')};
 const {me,clubs}=routes(state);
 for(const route of [me,clubs]){const res=await route.GET(req);assert.equal(res.status,401);assert.equal(res.headers['Cache-Control'],'private, no-store');}
 assert.deepEqual(state.events,['auth','auth']);
});

test('me returns the account with workspace roles; disabled accounts are refused',async()=>{
 const state={events:[],account:{id:'u1',disabledAt:null,studentProfile:{gpa:3.9},memberships:[{role:'OWNER'},{role:'MEMBER'}]}};
 const {me}=routes(state);
 const res=await me.GET(req);
 assert.equal(res.status,200);assert.deepEqual(res.body.profile,{gpa:3.9});assert.equal(res.body.adminRoles.length,1);
 state.account={...state.account,disabledAt:new Date()};
 assert.equal((await me.GET(req)).status,403);
});

test('clubs returns the directory and maps its failure to 503 without internal detail',async()=>{
 const state={events:[],directory:{clubs:[{id:'c1',name:'TAMID'}]}};
 const {clubs}=routes(state);
 const ok=await clubs.GET(req);assert.equal(ok.status,200);assert.equal(ok.body.clubs[0].name,'TAMID');
 state.directory={clubs:[],error:'We couldn’t load the club directory. Please try again.'};
 assert.equal((await clubs.GET(req)).status,503);
});

test('unexpected errors return a generic 500',async()=>{
 const state={events:[],auth:Error('db password=secret')};
 const {clubs}=routes(state);
 const res=await clubs.GET(req);
 assert.equal(res.status,500);assert.ok(!JSON.stringify(res.body).includes('secret'));
});

test('every v1 route authenticates through the bearer helper (directly or via v1Route)',()=>{
 const dir='app/api/v1';
 const files=fs.readdirSync(dir,{recursive:true}).filter(f=>String(f).endsWith('route.ts'));
 assert.ok(files.length>=2);
 for(const f of files){const src=fs.readFileSync(path.join(dir,String(f)),'utf8');assert.match(src,/requireBearerAuth\(request\)|v1Route\(request,|withBearerIdentity\(request,/,String(f));assert.ok(!src.includes('next/headers'),String(f));}
});

// Routes built on v1Route run existing actions inside the verified bearer scope.
function v1Routes(state){
 const actionCalls=state.calls=[];
 const rec=(name,result)=>async(...args)=>{actionCalls.push([name,...args]);if(state.fail===name)throw Error('internal secret detail');return typeof result==='function'?result(...args):result;};
 const ctx={withBearerIdentity:async(_r,run)=>{if(state.auth)throw state.auth;state.inScope=true;try{return await run();}finally{state.inScope=false;}}};
 const mocks={
  'next/server':{NextResponse:{json}},
  '@/utils/bearer-auth':{BearerAuthError},
  '@/utils/bearer-context':ctx,
  'zod':require('zod'),
  '@/actions/communications':{getDurableNotifications:rec('getDurableNotifications',{unread:1,nextCursor:null,items:[{id:'n1',type:'decision',title:'T',body:'B',href:'/x',readAt:null,createdAt:'2026-11-01',eventKey:'secret-key',clubId:'c1',club:{name:'CCG',color:'#123',logoUrl:null,marketing:{private:true}}}]}),setDurableNotificationsRead:rec('setDurableNotificationsRead',{updated:1})},
  '@/actions/tasks':{getTaskNotifications:rec('getTaskNotifications',[{id:'t1',title:'Read the case',preview:'p',club:'CCG',clubId:'c1',color:'#123',urgent:true,taskActivity:{assignmentId:'a',dueAt:'2026-11-10',needsSubmission:true},taskHref:'/clubs/tasks?x',body:['secret']}])},
  '@/actions/applications':{getStudentDashboardData:rec('getStudentDashboardData',{applications:[{clubId:'c1',club:{name:'CCG'},answers:[{text:'private essay'}],bookings:[]}],attendances:[],meetings:[],panelAssignments:[]})},
  '@/lib/student-calendar-data':{studentCalendarEvents:src=>[{id:'e1',title:'Interview',club:'CCG',color:'#123',type:'interview',date:'2026-11-12',day:12,startTime:'x',answers:src.applications[0].answers}]},
  '@/actions/campus-events':{getPublicCorkboard:rec('getPublicCorkboard',{events:[],total:0,hasMore:false,clubs:[]}),getSavedCampusEventIds:rec('getSavedCampusEventIds',['e2']),getMyCampusEventRsvps:rec('getMyCampusEventRsvps',[{eventId:'e3'}]),setCampusEventRsvp:rec('setCampusEventRsvp',{ok:true,going:true,count:4}),setSavedCampusEvent:rec('setSavedCampusEvent',{saved:true})},
  '@/actions/club-directory':{getPublicClub:rec('getPublicClub',id=>id==='missing'?{club:null}:{club:{id,name:'CCG'}}),getCorkboard:rec('getCorkboard',{items:[]}),setCorkboardClub:rec('setCorkboardClub',{saved:true,savedAt:'x'})},
 };
 mocks['@/lib/api-v1']=loader(mocks)('lib/api-v1.ts');
 const load=loader(mocks);
 const r=p=>load(`app/api/v1/${p}/route.ts`);
 return {inbox:r('inbox'),todo:r('todo'),calendar:r('calendar'),cork:r('corkboard'),rsvp:r('corkboard/[eventId]/rsvp'),save:r('corkboard/[eventId]/save'),club:r('clubs/[clubId]'),following:r('following')};
}
const post=(body)=>new Request('https://out-class.net/api/v1/x',{method:'POST',headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});
const get=(qs='')=>new Request('https://out-class.net/api/v1/x'+qs);
const ev={params:Promise.resolve({eventId:'00000000-0000-4000-8000-0000000000e1'})};

test('v1Route: rejected tokens get 401 and no action runs',async()=>{
 const state={auth:new BearerAuthError(401,'Sign-in required.')};
 const rs=v1Routes(state);
 for(const res of [await rs.inbox.GET(get()),await rs.todo.GET(get()),await rs.calendar.GET(get()),await rs.cork.GET(get()),await rs.rsvp.POST(post({going:true}),ev),await rs.following.POST(post({clubId:'x',saved:true}))])assert.equal(res.status,401);
 assert.deepEqual(state.calls,[]);
});

test('inbox projects notifications without internal keys and validates writes',async()=>{
 const state={};const rs=v1Routes(state);
 const res=await rs.inbox.GET(get());
 assert.equal(res.status,200);assert.equal(res.body.items[0].read,false);
 assert.ok(!JSON.stringify(res.body).includes('secret-key'));assert.ok(!JSON.stringify(res.body).includes('private'));
 assert.equal((await rs.inbox.GET(get('?cursor=not-a-uuid'))).status,400);
 assert.equal((await rs.inbox.POST(post({ids:['00000000-0000-4000-8000-000000000001'],read:true}))).status,200);
 for(const bad of [{ids:[],read:true},{ids:['x'],read:true},{ids:['00000000-0000-4000-8000-000000000001'],read:'yes'},{ids:['00000000-0000-4000-8000-000000000001'],read:true,userId:'someone'},'not json',[]])
  assert.equal((await rs.inbox.POST(post(bad))).status,400,JSON.stringify(bad));
 assert.equal(state.calls.filter(c=>c[0]==='setDurableNotificationsRead').length,1);
});

test('calendar returns only the projected events, never application answers',async()=>{
 const state={};const rs=v1Routes(state);
 const res=await rs.calendar.GET(get());
 assert.equal(res.status,200);assert.equal(res.body.events[0].title,'Interview');
 assert.ok(!JSON.stringify(res.body).includes('private essay'));
});

test('to-do returns task items without the full task body',async()=>{
 const state={};const rs=v1Routes(state);
 const res=await rs.todo.GET(get());
 assert.equal(res.body.items[0].dueAt,'2026-11-10');assert.ok(!JSON.stringify(res.body).includes('secret'));
});

test('corkboard filters are validated; RSVP and save pass only the path event id and a boolean',async()=>{
 const state={};const rs=v1Routes(state);
 assert.equal((await rs.cork.GET(get('?period=This%20Week'))).status,200);
 assert.deepEqual(state.calls.find(c=>c[0]==='getPublicCorkboard')[1],{period:'This Week',page:0});
 assert.equal((await rs.cork.GET(get('?period=Forever'))).status,400);
 await rs.cork.GET(get('?page=2'));
 assert.equal(state.calls.filter(c=>c[0]==='getPublicCorkboard').at(-1)[1].page,1,'app page 2 is the action\'s page 1 (0-based)');
 assert.equal((await rs.rsvp.POST(post({going:true}),ev)).status,200);
 assert.deepEqual(state.calls.find(c=>c[0]==='setCampusEventRsvp')[1],{eventId:'00000000-0000-4000-8000-0000000000e1',going:true});
 assert.equal((await rs.rsvp.POST(post({going:true,eventId:'other'}),ev)).status,400);
 assert.equal((await rs.save.POST(post({saved:'true'}),ev)).status,400);
});

test('club profile rejects malformed ids and maps a missing club to 404',async()=>{
 const state={};const rs=v1Routes(state);
 assert.equal((await rs.club.GET(get(),{params:Promise.resolve({clubId:'../../etc'})})).status,404);
 assert.ok(!state.calls.some(c=>c[0]==='getPublicClub'));
 const ok=await rs.club.GET(get(),{params:Promise.resolve({clubId:'ccg'})});
 assert.equal(ok.status,200);assert.equal(ok.body.club.name,'CCG');
 assert.equal((await rs.club.GET(get(),{params:Promise.resolve({clubId:'missing'})})).status,404);
 state.auth=new BearerAuthError(401,'Sign-in required.');
 assert.equal((await rs.club.GET(get(),{params:Promise.resolve({clubId:'ccg'})})).status,401);
});

test('action failures return a generic 500',async()=>{
 const state={fail:'getTaskNotifications'};const rs=v1Routes(state);
 const res=await rs.todo.GET(get());
 assert.equal(res.status,500);assert.ok(!JSON.stringify(res.body).includes('secret'));
});

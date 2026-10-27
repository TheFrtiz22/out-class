const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs');
const id='00000000-0000-4000-8000-000000000001';
test('GET allowlist forwards only validated read arguments, preserves wire dates/no-store and reauthorizes every request',async()=>{
 let demo=false,allowed=true;const seen=[];
 const reader=name=>async(...args)=>{seen.push([name,...args]);if(!allowed)throw Error('Revoked');return {at:new Date('2026-10-21')}};
 const modules=['club-overview','crm','club-onboarding','club-directory','tasks','tutorials','club-settings','applicant-intelligence','meetings','applications','organization-members','voting','interview-entry','interview-kits','interview-rooms','interview-booking-publication','communications'];
 const mocks=Object.fromEntries(modules.map(name=>['@/actions/'+name,new Proxy({},{get:(_,key)=>key==='then'?undefined:key==='__esModule'?true:reader(key)})]));
 mocks['next/headers']={cookies:async()=>({get:()=>demo?{value:'1'}:undefined})};
 const {GET}=load('app/api/workspace/route.ts',mocks),{decodeWorkspaceData}=load('lib/workspace-wire.ts');
 const get=(kind,args)=>GET(new Request('https://outclass.test/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify(args)})));
 for(const kind of ['assignedRooms','interviewWorkspace','interviewRounds','roomWorkspace','tasks','meetings','announcements']){
   const response=await get(kind,[id]);assert.equal(response.status,200,kind);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/(?:^|,\s*)Cookie(?:,|$)/);assert.ok(decodeWorkspaceData(await response.json()).at instanceof Date);assert.match(response.headers.get('x-outclass-trace-id'),/^[\da-f-]{36}$/);
   assert.equal((await get(kind,[id,{userId:'forged'}])).status,400);assert.equal((await get(kind,['invalid-id'])).status,400);
 }
 assert.equal((await get('bookingPublication',[{clubId:id,roundId:id}])).status,200);
 assert.equal((await get('bookingPublication',[{clubId:id,roundId:id,userId:id}])).status,400);
 for(const kind of ['meetings','notifications']){assert.equal((await get(kind,[])).status,200);assert.equal((await get(kind,[null])).status,200)}
 const before=seen.length;await get('assignedRooms',[id]);await get('assignedRooms',[id]);assert.equal(seen.length,before+2);
 allowed=false;assert.equal((await get('assignedRooms',[id])).status,403);allowed=true;
 for(const name of ['setInterviewRoomOpen','saveInterviewSession','publishClubAnnouncement','arbitraryAction'])assert.equal((await get(name,[id])).status,400);
 demo=true;const count=seen.length;assert.equal((await get('assignedRooms',[id])).status,403);assert.equal(seen.length,count);
});
test('read transport uses explicit credential-sensitive GET requests and releases slots after errors',async()=>{
 const source=require('node:fs').readFileSync('lib/workspace-read.ts','utf8'),ts=require('typescript');let calls=[];
 const loaded={exports:{}};const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','fetch',code)(name=>load(name.slice(2)+'.ts'),loaded,loaded.exports,async(url,options)=>{calls.push({url,options});return Response.json({$workspace:'value',value:null},{status:403})});
 await assert.rejects(loaded.exports.readWorkspace('assignedRooms',[id]),/access changed/);
 assert.equal(calls.length,1);assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.method,undefined);assert.equal(new URL(calls[0].url,'https://outclass.test').searchParams.get('kind'),'assignedRooms');
});

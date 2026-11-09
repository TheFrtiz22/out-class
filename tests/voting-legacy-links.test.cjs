const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const clubId=uuid(1),liveId=uuid(2),boardId=uuid(3),suspendedLiveId=uuid(5),memberUser=uuid(9),outsiderUser=uuid(10),disabledUser=uuid(11),formerUser=uuid(12);
const sessions={[liveId]:{clubId,mode:'LIVE'},[boardId]:{clubId,mode:'LEGACY'},[suspendedLiveId]:{clubId:uuid(6),mode:'LIVE'}};
const clubs={[clubId]:{suspendedAt:null},[uuid(6)]:{suspendedAt:new Date()}};
const memberships=[{userId:memberUser,clubId,status:'ACTIVE'},{userId:disabledUser,clubId,status:'ACTIVE'},{userId:formerUser,clubId,status:'REMOVED'},{userId:memberUser,clubId:uuid(6),status:'ACTIVE'}];
const accounts={[memberUser]:{disabledAt:null},[outsiderUser]:{disabledAt:null},[disabledUser]:{disabledAt:new Date()},[formerUser]:{disabledAt:null}};
function resolver({user=memberUser,email='member@virginia.edu',confirmed=true,demo=false,support=false,fail=false}={}){
 const reads=[];
 const db={
  user:{findUnique:async({where})=>accounts[where.id]??null},
  votingSession:{findFirst:async({where,select})=>{reads.push({where,select});const s=sessions[where.id];const m=where.club.members.some;if(!s||s.mode!==where.mode||clubs[s.clubId].suspendedAt!==where.club.suspendedAt)return null;return memberships.some(r=>r.clubId===s.clubId&&r.userId===m.userId&&r.status===m.status)?{clubId:s.clubId}:null}},
 };
 const mocks={
  'server-only':{},
  'next/headers':{cookies:async()=>({get:n=>n==='outclass-demo-session'&&demo?{value:'1'}:undefined,has:n=>n==='outclass-platform-view'&&support})},
  '@/lib/demo/access':{DEMO_COOKIE:'outclass-demo-session'},
  '@/lib/platform-view-as':{PLATFORM_VIEW_COOKIE:'outclass-platform-view'},
  '@/utils/auth':{getSessionUser:async()=>{if(fail)throw Error('Auth provider unavailable');return {data:{user:user?{id:user,email,email_confirmed_at:confirmed?'2026-01-01T00:00:00Z':null}:null},error:null}}},
  '@/utils/prisma':{prisma:db},
 };
 const mod=load('utils/legacy-voting-link.ts',mocks);
 return {href:mod.liveRoomHrefForLegacyLink,reads};
}

test('old links open a real live room only for a verified ACTIVE member of its operational club',async()=>{
 const r=resolver();
 assert.equal(await r.href(liveId),`/voting/rooms/${liveId}?clubId=${clubId}`);
 assert.equal(await r.href(boardId),null,'board-mode sessions keep their join flow');
 assert.equal(await r.href(uuid(4)),null,'unknown sessions keep the existing page');
 assert.equal(await r.href(suspendedLiveId),null,'a suspended club keeps the existing page');
 for(const bad of [undefined,null,'','demo-session-1','../x',`${liveId}?x`])assert.equal(await r.href(bad),null,String(bad));
 assert.ok(r.reads.every(q=>JSON.stringify(q.select)===JSON.stringify({clubId:true})),'only the club id is read, and only after membership matches');
});

test('outsiders, disabled, unconfirmed, non-school, former, signed-out, Demo, support-view and degraded viewers learn nothing',async()=>{
 assert.equal(await resolver({user:outsiderUser}).href(liveId),null,'an outsider gets today\'s page');
 const disabled=resolver({user:disabledUser});assert.equal(await disabled.href(liveId),null,'a disabled account gets today\'s page');assert.equal(disabled.reads.length,0);
 const unconfirmed=resolver({confirmed:false});assert.equal(await unconfirmed.href(liveId),null,'an unconfirmed email gets today\'s page');assert.equal(unconfirmed.reads.length,0);
 assert.equal(await resolver({email:'someone@gmail.com'}).href(liveId),null,'a non-school email gets today\'s page');
 assert.equal(await resolver({user:formerUser}).href(liveId),null,'a removed member gets today\'s page');
 assert.equal(await resolver({user:null}).href(liveId),null,'signed-out viewers keep the sign-in or preview page');
 const demo=resolver({demo:true});assert.equal(await demo.href(liveId),null,'Demo Mode never resolves production rooms');assert.equal(demo.reads.length,0);
 assert.equal(await resolver({support:true}).href(liveId),null,'support view-as never redirects on the administrator identity');
 assert.equal(await resolver({fail:true}).href(liveId),null,'a degraded lookup keeps the existing page');
});

test('legacy voting pages redirect only through the shared resolver and keep Demo join links isolated',()=>{
 const live=fs.readFileSync('app/(focus)/live-voting/page.tsx','utf8'),join=fs.readFileSync('app/(focus)/voting/[sessionId]/join/page.tsx','utf8');
 assert.doesNotMatch(live,/^"use client"/);assert.match(live,/liveRoomHrefForLegacyLink\(/);assert.match(live,/redirect\(href\)/);assert.match(live,/<LegacyVotingPage \/>/);
 assert.equal(fs.readFileSync('app/(focus)/vote/page.tsx','utf8').trim(),'export { default } from "@/app/(focus)/live-voting/page"');
 assert.match(join,/query\.demo==="1"\?null:await liveRoomHrefForLegacyLink\(sessionId\)/);
 assert.doesNotMatch(fs.readFileSync('components/live-voting/legacy-voting-page.tsx','utf8'),/from ["']@\/lib\/demo\//);
});

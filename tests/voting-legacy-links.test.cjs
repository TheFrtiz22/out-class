const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const clubId=uuid(1),liveId=uuid(2),boardId=uuid(3);
function resolver({user=true,demo=false,fail=false}={}){
 const reads=[];
 const sessions={[liveId]:{clubId,mode:'LIVE'},[boardId]:{clubId,mode:'LEGACY'}};
 const mod=load('utils/legacy-voting-link.ts',{
  'server-only':{},
  'next/headers':{cookies:async()=>({get:name=>name==='outclass-demo-session'&&demo?{value:'1'}:undefined})},
  '@/lib/demo/access':{DEMO_COOKIE:'outclass-demo-session'},
  '@/utils/auth':{getSessionUser:async()=>{if(fail)throw Error('Auth provider unavailable');return {data:{user:user?{id:uuid(9)}:null}}}},
  '@/utils/prisma':{prisma:{votingSession:{findUnique:async({where,select})=>{reads.push({where,select});return sessions[where.id]??null}}}},
 });
 return {href:mod.liveRoomHrefForLegacyLink,reads};
}

test('old links to a real live room resolve to the room, which enforces access; everything else keeps the existing page',async()=>{
 const r=resolver();
 assert.equal(await r.href(liveId),`/voting/rooms/${liveId}?clubId=${clubId}`);
 assert.equal(await r.href(boardId),null,'board-mode sessions keep their join flow');
 assert.equal(await r.href(uuid(4)),null,'unknown sessions keep the existing page');
 for(const bad of [undefined,null,'','demo-session-1','../x',`${liveId}?x`])assert.equal(await r.href(bad),null,String(bad));
 assert.ok(r.reads.every(q=>JSON.stringify(q.select)===JSON.stringify({clubId:true,mode:true})),'only the club id and mode are read');
 assert.equal(await resolver({user:false}).href(liveId),null,'signed-out viewers keep the sign-in or preview page');
 const demo=resolver({demo:true});assert.equal(await demo.href(liveId),null,'Demo Mode never resolves production rooms');assert.equal(demo.reads.length,0);
 assert.equal(await resolver({fail:true}).href(liveId),null,'a degraded lookup keeps the existing page');
});

test('legacy voting pages redirect only through the shared resolver and keep Demo join links isolated',()=>{
 const live=fs.readFileSync('app/(focus)/live-voting/page.tsx','utf8'),join=fs.readFileSync('app/(focus)/voting/[sessionId]/join/page.tsx','utf8');
 assert.doesNotMatch(live,/^"use client"/);assert.match(live,/liveRoomHrefForLegacyLink\(/);assert.match(live,/redirect\(href\)/);assert.match(live,/<LegacyVotingPage \/>/);
 assert.equal(fs.readFileSync('app/(focus)/vote/page.tsx','utf8').trim(),'export { default } from "@/app/(focus)/live-voting/page"');
 assert.match(join,/query\.demo==="1"\?null:await liveRoomHrefForLegacyLink\(sessionId\)/);
 assert.doesNotMatch(fs.readFileSync('components/live-voting/legacy-voting-page.tsx','utf8'),/from ["']@\/lib\/demo\//);
});

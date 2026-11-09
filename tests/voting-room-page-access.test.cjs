const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const clubId=uuid(1),sessionId=uuid(2),leaderUser=uuid(10),boardUser=uuid(11),voterUser=uuid(12),outsiderUser=uuid(13),observerUser=uuid(14),disabledUser=uuid(15);
const member=(userId,id,permissions,status='ACTIVE')=>({id,userId,clubId,status,permissions,accessRole:'MEMBER',isOwner:false});
const members=[member(leaderUser,uuid(20),['applications.review','applicants.identify','decisions.start','decisions.manage']),member(boardUser,uuid(21),['applications.review','applicants.identify']),member(voterUser,uuid(22),['applications.review','applicants.identify','decisions.vote']),member(observerUser,uuid(24),['applications.review','applicants.identify','decisions.view']),member(disabledUser,uuid(25),['applications.review','applicants.identify','decisions.start'])];
function access({user,email='leader@virginia.edu',confirmed=true,demo=false,support=false,fail=false,anonymous=false,suspended=false}={}){
 const mod=load('utils/voting-room-page-access.ts',{
  'server-only':{},
  'next/headers':{cookies:async()=>({get:n=>n==='outclass-demo-session'&&demo?{value:'1'}:undefined,has:n=>n==='outclass-platform-view'&&support})},
  '@/lib/demo/access':{DEMO_COOKIE:'outclass-demo-session'},
  '@/lib/platform-view-as':{PLATFORM_VIEW_COOKIE:'outclass-platform-view'},
  '@/utils/auth':{getSessionUser:async()=>({data:{user:user?{id:user,email,email_confirmed_at:confirmed?'2026-01-01T00:00:00Z':null}:null},error:null})},
  '@/utils/prisma':{prisma:{
   $queryRaw:async strings=>strings.join('?').includes('suspendedAt')&&suspended?[{id:clubId}]:[],
   user:{findUnique:async({where})=>({disabledAt:where.id===disabledUser?new Date():null})},
   clubMember:{findUnique:async({where})=>{if(fail)throw Error('Database unavailable');return members.find(m=>m.userId===where.userId_clubId.userId&&m.clubId===where.userId_clubId.clubId)??null}},
   votingSession:{findFirst:async({where,select})=>{assert.deepEqual(Object.keys(select).sort(),['leaderMemberIds','participants','round']);return where.id===sessionId&&where.clubId===clubId&&where.mode==='LIVE'?{leaderMemberIds:[uuid(20)],participants:[{memberId:uuid(22)}],round:{anonymousReview:anonymous}}:null}},
  }},
 });
 return id=>mod.votingRoomPageAccess(clubId,id??sessionId);
}
test('leader and presentation views resolve refused viewers to an access state instead of a thrown room read',async()=>{
 assert.equal(await access({user:leaderUser})(),'CONTINUE');
 assert.equal(await access({user:voterUser})(),'CONTINUE','a roster voter reaches the room, which shows its own leader-controls notice');
 assert.equal(await access({user:observerUser})(),'CONTINUE');
 assert.equal(await access({user:boardUser})(),'DENIED','a board member without a room role is denied, not shown a connection error');
 assert.equal(await access({user:outsiderUser})(),'DENIED','an outsider is denied');
 assert.equal(await access({user:leaderUser})(uuid(99)),'UNAVAILABLE');
 assert.equal(await access({user:null})(),'CONTINUE','signed-out viewers keep the sign-in state');
 assert.equal(await access({user:outsiderUser,demo:true})(),'CONTINUE','Demo Mode is never checked against production');
 assert.equal(await access({user:outsiderUser,support:true})(),'CONTINUE','support view keeps the room read as authority');
 assert.equal(await access({user:outsiderUser,fail:true})(),'CONTINUE','a degraded preflight falls back to the room read');
});
test('requireAuth account rules and the suspended-club check give a clear refusal, not CONTINUE',async()=>{
 assert.equal(await access({user:disabledUser})(),'DENIED','a disabled account is refused even with a leader membership');
 assert.equal(await access({user:leaderUser,confirmed:false})(),'DENIED','an unconfirmed email is refused');
 assert.equal(await access({user:leaderUser,email:'leader@gmail.com'})(),'DENIED','a non-school email is refused');
 assert.equal(await access({user:leaderUser,suspended:true})(),'SUSPENDED','a suspended club shows the suspension state');
 assert.equal(await access({user:outsiderUser,suspended:true})(),'DENIED','an outsider learns nothing about the club being suspended');
});
test('the room page renders the access states with no applicant data and leaves the member view to its join check',()=>{
 const page=fs.readFileSync('app/(focus)/voting/rooms/[sessionId]/page.tsx','utf8');
 assert.match(page,/view!=="member"&&q\.demo!=="1"\?await votingRoomPageAccess\(/);
 assert.match(page,/You don’t have access to this voting session\./);
 assert.match(page,/access==="SUSPENDED"\?<p role="alert">\{CLUB_SUSPENDED_MESSAGE\}<\/p>/);
 assert.ok(page.includes('if(access!=="CONTINUE")return present('),"a refused projector keeps the dark present theme");
 assert.ok(page.includes('return present(entry)'));
 assert.doesNotMatch(page,/applicant|getLiveVotingRoom/i);
});

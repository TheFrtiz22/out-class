const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const clubId=uuid(1), foreignClub=uuid(2), actorId=uuid(3)
function loader(mocks) {
  const cache={}
  function load(file) {
    file=path.resolve(file)
    if(cache[file]) return cache[file].exports
    const mod={exports:{}};cache[file]=mod
    new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{
      if(name in mocks)return mocks[name]
      if(name.startsWith('@/'))return load(name.slice(2)+'.ts')
      if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts')
      return require(name)
    },mod,mod.exports)
    return mod.exports
  }
  return load
}
const personas=[
  ['ordinary student',null],
  ['applicant',null],
  ['club member',{permissions:[]}],
  ['limited manager',{permissions:['meetings.manage']}],
  ['broad manager',{permissions:['applications.review','applicants.identify','leaders.manage','members.manage','tasks.manage','interviews.manage','decisions.manage']}],
  ['MII demo leader',{isOwner:true,permissions:[]},'demo'],
  ['super-admin',{permissions:[]},'admin'],
  ['anonymous reviewer',{permissions:['applications.review']}],
]
for(const [name,access,mode] of personas) test(`${name}: server boundaries ignore forged club IDs and client roles`,async()=>{
  const membership=access?{...access,id:uuid(4),clubId,userId:actorId}:null
  const privateApp={id:uuid(5),clubId,roundId:uuid(6),status:'IN_REVIEW',studentId:'SECRET',submittedAt:new Date(),round:{anonymousReview:true},student:{email:'SECRET@virginia.edu',studentProfile:{firstName:'SECRET',lastName:'PERSON',gradYear:2028}},evaluations:[],answers:[],bookings:[]}
  const prisma={
    user:{upsert:async()=>({id:actorId,email:'actor@virginia.edu',role:'CLUB_ADMIN'})},
    clubMember:{findUnique:async({where})=>where.userId_clubId.clubId===clubId?membership:null,findMany:async()=>[]},
    pipelineRound:{findMany:async({where})=>{assert.equal(where.clubId,clubId);return [privateApp.round]}},
    application:{findMany:async({where})=>{assert.equal(where.clubId,clubId);if(name==='anonymous reviewer')assert.deepEqual(where.round,{anonymousReview:true});return [privateApp]}},
    clubInvitation:{findMany:async({where})=>{assert.equal(where.clubId,clubId);return []}},
    clubTask:{findMany:async({where,include})=>{assert.equal(where.clubId,clubId);if(!access?.permissions.includes('tasks.manage')) {assert.deepEqual(where.assignments,{some:{memberId:membership.id}});assert.deepEqual(include.assignments.where,{memberId:membership.id})}return []}},
  }
  const demoCookie=loader({})('lib/demo/access.ts').DEMO_COOKIE
  const guardLoad=loader({
    '@/utils/prisma':{prisma},'./prisma':{prisma},
    './supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:actorId,email:'actor@virginia.edu'}}})}})},
    'next/headers':{cookies:async()=>({has:()=>false,get:key=>key===demoCookie&&mode==='demo'?{value:'1'}:undefined})},
    'next/navigation':{redirect:()=>{throw Error('Authentication required')}},'next/cache':{revalidatePath(){}},
  })
  const auth=guardLoad('utils/auth.ts'), crm=guardLoad('actions/crm.ts'),tasks=guardLoad('actions/tasks.ts'),sharing=guardLoad('actions/club-access.ts')
  for(const capability of ['applications.review','applicants.identify','leaders.manage','tasks.manage','decisions.manage']){
    await assert.rejects(auth.requireClubPermission(foreignClub,[capability]))
    if(mode!=='demo'&&access?.permissions.includes(capability))await auth.requireClubPermission(clubId,[capability])
    else await assert.rejects(auth.requireClubPermission(clubId,[capability]))
  }
  if(mode!=='demo'&&access?.permissions.some(p=>['applications.review','applicants.identify'].includes(p))){
    const pipeline=await crm.getClubPipeline(clubId)
    assert.equal(JSON.stringify(pipeline).includes('SECRET'),false)
  }else await assert.rejects(crm.getClubPipeline(clubId))
  await assert.rejects(crm.getClubPipeline(foreignClub))
  if(access&&mode!=='demo')await tasks.getTaskWorkspace(clubId)
  else await assert.rejects(tasks.getTaskWorkspace(clubId))
  await assert.rejects(tasks.getTaskWorkspace(foreignClub))
  if(mode!=='demo'&&access?.permissions.includes('leaders.manage'))await sharing.getClubAccess(clubId)
  else await assert.rejects(sharing.getClubAccess(clubId))
  await assert.rejects(sharing.getClubAccess(foreignClub))
})

test('student dashboard queries exclude private manager review text',async()=>{
  const load=loader({'@/utils/auth':{requireAuth:async()=>({user:{id:actorId}})},'@/utils/prisma':{prisma:{
    application:{findMany:async query=>{assert.deepEqual(query.where,{studentId:actorId});assert.deepEqual(query.omit,{anonymousReviewText:true});return []}},
    eventAttendance:{findMany:async()=>[]},meeting:{findMany:async()=>[]},
  }},'next/cache':{revalidatePath(){}}})
  await load('actions/applications.ts').getStudentDashboardData()
})

test('account endpoint independently denies demo and administrator view cookies',async()=>{
  const demoCookie=loader({})('lib/demo/access.ts').DEMO_COOKIE
  const viewCookie=loader({})('lib/platform-view-as.ts').PLATFORM_VIEW_COOKIE
  for(const cookie of [demoCookie,viewCookie]){
    const load=loader({'next/headers':{cookies:async()=>({get:key=>key===cookie?{value:'1'}:undefined,has:key=>key===cookie})},'@/utils/supabase/server':{createClient:()=>{throw Error('Live auth must not be reached')}},'@/utils/prisma':{prisma:{}}})
    assert.equal((await load('app/api/users/me/route.ts').GET()).status,403,cookie)
  }
})

 test('OAuth callback ignores forged forwarded hosts and rejects external return paths',async()=>{
  const load=loader({'next/headers':{cookies:async()=>({})},'@/utils/supabase/server':{createClient:async()=>({auth:{exchangeCodeForSession:async()=>({data:{user:{id:actorId,email:'ACTOR@virginia.edu'}}})}})},'@/utils/prisma':{prisma:{user:{upsert:async query=>{assert.equal(query.update.email,'actor@virginia.edu')}}}}})
  const route=load('app/auth/callback/route.ts')
  for(const [next,expected] of [['/meetings','/meetings'],['//evil.example','/'],['/\\evil.example','/'],['https://evil.example','/']]) {
    const result=await route.GET(new Request(`https://outclass.example/auth/callback?code=test&next=${encodeURIComponent(next)}`,{headers:{'x-forwarded-host':'evil.example'}}))
    assert.equal(result.headers.get('location'),`https://outclass.example${expected}`)
  }
 })

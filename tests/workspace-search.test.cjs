const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function compile(file,req){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,mod,mod.exports);return mod.exports}
const lib=name=>compile(name.slice(2)+'.ts',n=>n.startsWith('@/lib/')?lib(n):require(n))
// An identified reviewer's membership as the database returns it; graduatedAt is the member's StudentProfile date.
const member=(clubId,extra={})=>({clubId,userId:'student',status:'ACTIVE',alumniSince:null,isOwner:false,permissions:['applicants.identify'],...extra})
function setup(memberships=[], school=require('./helpers/school-scope.cjs').UVA, typesense=async()=>null, graduatedAt=null) {
 const calls=[];const mocks={
 '@/utils/school-scope':require('./helpers/school-scope.cjs').schoolScope(school),
 '@/lib/permissions':lib('@/lib/permissions'),
 '@/lib/graduate-access':lib('@/lib/graduate-access'),
 '@/utils/auth':{requireAuth:async()=>({user:{id:'student'}})},
 '@/actions/typesense-search':{searchPublicClubIds:typesense},
 '@/utils/prisma':{prisma:{
 $queryRaw:async()=>[{graduatedAt}],
 clubMember:{findMany:async args=>{calls.push(['memberships',args]);return memberships}},
 club:{findMany:async args=>{calls.push(['clubs',args]);return []}},
 application:{findMany:async args=>{calls.push(['applications',args]);return []}},
 pipelineRound:{findMany:async args=>{calls.push(['rounds',args]);return []}},
 }}}
 const code=ts.transpileModule(fs.readFileSync('actions/workspace-search.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
 const mod={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]||require(name),mod,mod.exports)
 return {calls,...mod.exports}
}
test('short queries never enumerate records',async()=>{const {calls,searchWorkspace}=setup();assert.deepEqual(await searchWorkspace(' a '),[]);assert.equal(calls.length,0)})
test('student search is scoped to own applications with bounded result counts',async()=>{
 const {calls,searchWorkspace}=setup();await searchWorkspace('club')
 // Memberships are always read server-side; with none authorized, no applicant or round query runs.
 assert.deepEqual(calls.map(([name])=>name),['memberships','clubs','applications'])
 const query=calls.find(([name])=>name==='applications')[1];assert.equal(query.where.studentId,'student');assert.equal(query.take,6)
})
test('a client requesting leader search gains no private results without authorized memberships',async()=>{
 const {calls,searchWorkspace}=setup();await searchWorkspace('Alex',true)
 assert.equal(calls.filter(([name])=>name==='applications').length,1)
 assert.equal(calls.some(([name])=>name==='rounds'),false)
 assert.deepEqual(calls[0][1].where,{userId:'student',status:'ACTIVE',alumniSince:null,club:{suspendedAt:null},OR:[{isOwner:true},{permissions:{has:'applicants.identify'}}]})
})
test('applicant and round queries use only server-derived leader clubs and exclude drafts',async()=>{
 const {calls,searchWorkspace}=setup([member('authorized-club')]);await searchWorkspace('Alex',true)
 const applicant=calls.filter(([name])=>name==='applications')[1][1]
 assert.deepEqual(applicant.where.clubId,{in:['authorized-club']});assert.deepEqual(applicant.where.status,{not:'DRAFTING'});assert.equal(applicant.take,8)
 assert.deepEqual(calls.find(([name])=>name==='rounds')[1].where.clubId,{in:['authorized-club']})
})
test('full applicant names match across first and last name fields',async()=>{
 const {calls,searchWorkspace}=setup([member('authorized-club')]);await searchWorkspace('Alex Morgan',true)
 const applicant=calls.filter(([name])=>name==='applications')[1][1]
 const terms=applicant.where.student.OR[1].studentProfile.AND
 assert.deepEqual(terms.map(term=>term.OR[0].firstName.contains),['Alex','Morgan'])
})
test('record search is role-wide: authorized applicants are found without the retired leader flag',async()=>{
 const {calls,searchWorkspace}=setup([member('authorized-club')]);await searchWorkspace('Alex')
 assert.deepEqual(calls.filter(([name])=>name==='applications')[1][1].where.clubId,{in:['authorized-club']})
 assert.deepEqual(calls.find(([name])=>name==='rounds')[1].where.clubId,{in:['authorized-club']})
})
test('a graduate kept as owner is hand-over only and gets no applicant or round results',async()=>{
 const {calls,searchWorkspace}=setup([member('owned-club',{isOwner:true,permissions:[]})],undefined,undefined,new Date('2020-05-20T12:00:00Z'))
 await searchWorkspace('Alex')
 assert.equal(calls.filter(([name])=>name==='applications').length,1)
 assert.equal(calls.some(([name])=>name==='rounds'),false)
})
test('a current owner still searches the applicants of their club',async()=>{
 const {calls,searchWorkspace}=setup([member('owned-club',{isOwner:true,permissions:[]})])
 await searchWorkspace('Alex')
 assert.deepEqual(calls.find(([name])=>name==='rounds')[1].where.clubId,{in:['owned-club']})
})
test('a suspended club grants no applicant or round search to its leaders',async()=>{
 // Suspension closes a club's workspace (actions/availability.ts reads only unsuspended memberships);
 // search must not stay a side door to its applicants on the web or through the app's explore.search.
 const {calls,searchWorkspace}=setup();await searchWorkspace('Alex',true)
 assert.deepEqual(calls.find(([name])=>name==='memberships')[1].where.club,{suspendedAt:null})
})

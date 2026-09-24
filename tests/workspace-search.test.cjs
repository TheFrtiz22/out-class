const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function setup(memberships=[]) {
 const calls=[];const mocks={
 '@/utils/auth':{requireAuth:async()=>({user:{id:'student'}})},
 '@/utils/prisma':{prisma:{
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
 const {calls,searchWorkspace}=setup();await searchWorkspace('club');assert.equal(calls.length,2)
 const query=calls.find(([name])=>name==='applications')[1];assert.equal(query.where.studentId,'student');assert.equal(query.take,6)
})
test('a client requesting leader search gains no private results without authorized memberships',async()=>{
 const {calls,searchWorkspace}=setup();await searchWorkspace('Alex',true)
 assert.equal(calls.filter(([name])=>name==='applications').length,1)
 assert.equal(calls.some(([name])=>name==='rounds'),false)
 assert.deepEqual(calls[0][1].where,{userId:'student',OR:[{isOwner:true},{permissions:{has:'applicants.identify'}}]})
})
test('applicant and round queries use only server-derived leader clubs and exclude drafts',async()=>{
 const {calls,searchWorkspace}=setup([{clubId:'authorized-club'}]);await searchWorkspace('Alex',true)
 const applicant=calls.filter(([name])=>name==='applications')[1][1]
 assert.deepEqual(applicant.where.clubId,{in:['authorized-club']});assert.deepEqual(applicant.where.status,{not:'DRAFTING'});assert.equal(applicant.take,8)
 assert.deepEqual(calls.find(([name])=>name==='rounds')[1].where.clubId,{in:['authorized-club']})
})
test('full applicant names match across first and last name fields',async()=>{
 const {calls,searchWorkspace}=setup([{clubId:'authorized-club'}]);await searchWorkspace('Alex Morgan',true)
 const applicant=calls.filter(([name])=>name==='applications')[1][1]
 const terms=applicant.where.student.OR[1].studentProfile.AND
 assert.deepEqual(terms.map(term=>term.OR[0].firstName.contains),['Alex','Morgan'])
})

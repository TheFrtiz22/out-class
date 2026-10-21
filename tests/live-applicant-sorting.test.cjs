const { test } = require('node:test'), assert = require('node:assert/strict')
const { loader } = require('./helpers/communications-loader.cjs')
const { compareApplicants } = loader({})('lib/live-applicant-sorting.ts')
const candidate = (id, profile = {}, score = null) => ({ id, roundId: 'r', status: 'IN_REVIEW', student: { email: id, studentProfile: { firstName: id, lastName: '', ...profile } }, roundScore: score === null ? null : { average: score } })
test('quantitative applicant sorting compares numbers and leaves missing or hidden values last in both directions', () => {
 for (const [key, field] of [['gpa', 'gpa'], ['sat','satScore'], ['act','actScore']]) {
  const rows = [candidate('missing'),candidate('low',{[field]:2}),candidate('high',{[field]:10})]
  assert.deepEqual([...rows].sort((a,b)=>compareApplicants(a,b,key,false)).map(a=>a.id),['low','high','missing'])
  assert.deepEqual([...rows].sort((a,b)=>compareApplicants(a,b,key,true)).map(a=>a.id),['high','low','missing'])
 }
 const hidden = candidate('hidden');hidden.evaluations=[{score:10}]
 assert.deepEqual([hidden,candidate('rated',{},8.5)].sort((a,b)=>compareApplicants(a,b,'score',true)).map(a=>a.id),['rated','hidden'])
})
test('year and round sorting use academic order and pipeline position, not string order',()=>{
 const rows=[candidate('first',{academicYear:'First Year'}),candidate('fourth',{academicYear:'Fourth Year*'}),candidate('second',{academicYear:'Second Year'}),candidate('unknown')]
 assert.deepEqual(rows.sort((a,b)=>compareApplicants(a,b,'year',true)).map(a=>a.id),['fourth','second','first','unknown'])
 const a=candidate('a'),b=candidate('b');a.roundId='earlier';b.roundId='later'
 assert.ok(compareApplicants(a,b,'round',false,[{id:'earlier',order:2},{id:'later',order:10}])<0)
})

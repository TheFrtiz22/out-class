const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const mod = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('lib/interview-mode.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('module', 'exports', code)(mod, mod.exports)
const { reviewerEvaluation, interviewProgress, elapsedInterviewTime } = mod.exports
const evaluations = [{ interviewerId: 'a', round: 'Round 1', score: 8, notes: 'First' }, { interviewerId: 'b', round: 'Round 2', score: 7, notes: 'Other reviewer' }]
test('loads only this reviewer’s evaluation for the chosen round', () => {
 assert.equal(reviewerEvaluation(evaluations, 'a', 'Round 1').score, 8)
 assert.equal(reviewerEvaluation(evaluations, 'a', 'Round 2'), undefined)
})
test('progress counts saved evaluations for the current reviewer and round only', () => {
 const applicants = [{ evaluations }, { evaluations: [{ interviewerId: 'a', round: 'Round 2', score: 9, notes: null }] }, { evaluations: [] }]
 assert.deepEqual(interviewProgress(applicants, 'a', 'Round 1'), { total: 3, completed: 1 })
 assert.deepEqual(interviewProgress([], 'a', 'Round 1'), { total: 0, completed: 0 })
})
test('elapsed timer formats zero and longer interviews without a fabricated deadline', () => {
 assert.equal(elapsedInterviewTime(0), '00:00')
 assert.equal(elapsedInterviewTime(65), '01:05')
 assert.equal(elapsedInterviewTime(3601), '60:01')
})

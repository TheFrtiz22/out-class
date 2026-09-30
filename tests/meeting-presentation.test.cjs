const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const mod={exports:{}}
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/meeting-presentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports)
const {meetingIsUpcoming}=mod.exports
test('meeting periods preserve ongoing meetings until their actual end, with no inferred duration',()=>{
 const now=Date.parse('2026-09-27T12:00:00Z')
 assert.equal(meetingIsUpcoming({date:'2026-09-27T13:00:00Z'},now),true)
 assert.equal(meetingIsUpcoming({date:'2026-09-27T11:00:00Z',endDate:'2026-09-27T13:00:00Z'},now),true)
 assert.equal(meetingIsUpcoming({date:'2026-09-27T11:00:00Z'},now),false)
 assert.equal(meetingIsUpcoming({date:'2026-09-27T10:00:00Z',endDate:'2026-09-27T11:00:00Z'},now),false)
 assert.equal(meetingIsUpcoming({date:new Date(now)},now),true)
})

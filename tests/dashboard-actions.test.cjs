const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/dashboard-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports)
const {dashboardDeadlineState:state}=mod.exports,now=Date.parse('2026-10-22T12:00:00Z')
test('urgency requires a real deadline or missing prerequisite, never volume',()=>{
 assert.equal(state(null,true,now),'information')
 assert.equal(state('2026-10-22T11:59:00Z',true,now),'urgent')
 assert.equal(state('2026-10-24T12:00:00Z',true,now),'soon')
 assert.equal(state('2026-10-30',true,now),'information')
 assert.equal(state('invalid',true,now),'information')
})
test('unavailable does not become healthy or a zero backlog',()=>{
 assert.equal(state(null,false,now,false),'unavailable')
 assert.equal(state('2026-10-01',false,now),'healthy')
})

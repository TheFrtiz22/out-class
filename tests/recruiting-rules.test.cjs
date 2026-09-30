const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, mocks = {}) {
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/lib/')?load(name.replace('@/','')+'.ts',mocks):name.startsWith('.')?load(path.resolve(path.dirname(file),name)+'.ts',mocks):require(name),mod,mod.exports)
 return mod.exports
}
const rules=load('lib/recruiting-rules.ts')
const clubId='00000000-0000-4000-8000-000000000001',roundId='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003'
const scope={clubId,roundId}, thresholds={minGpa:3.5,minSat:1400,minAct:30}
const candidate={id,status:'IN_REVIEW',gpa:3.5,satScore:1400,actScore:30}
test('rules validate ranges, requirement compatibility, and missing/either/both semantics',()=>{
 for(const invalid of [{minGpa:4.1},{minSat:1399},{minAct:30.5},{minGpa:NaN}]) assert.throws(()=>rules.ruleThresholdSchema.parse({...thresholds,...invalid}))
 assert.throws(()=>rules.validateRuleRequirement(thresholds,'SAT'),/ACT/)
 assert.throws(()=>rules.validateRuleRequirement(thresholds,'ACT'),/SAT/)
 assert.throws(()=>rules.validateRuleRequirement({...thresholds,minAct:null},'SAT_OR_ACT'),/both/)
 assert.equal(rules.evaluateRule(thresholds,'BOTH',candidate).outcome,'clear')
 assert.equal(rules.evaluateRule(thresholds,'BOTH',{...candidate,satScore:1300}).outcome,'flag')
 assert.equal(rules.evaluateRule(thresholds,'SAT_OR_ACT',{...candidate,satScore:1300}).outcome,'clear')
 assert.equal(rules.evaluateRule(thresholds,'SAT_OR_ACT',{...candidate,satScore:1300,actScore:null}).outcome,'manual')
 assert.equal(rules.evaluateRule(thresholds,'OPTIONAL',{...candidate,satScore:null}).outcome,'clear')
 assert.equal(rules.evaluateRule(thresholds,'OPTIONAL',{...candidate,satScore:1300,actScore:29}).outcome,'flag')
 assert.equal(rules.evaluateRule(thresholds,'BOTH',{...candidate,gpa:null,satScore:null,actScore:null}).outcome,'manual')
 assert.equal(rules.evaluateRule(thresholds,'BOTH',{...candidate,gpa:3,actScore:null}).outcome,'flag')
 assert.equal(rules.evaluateRule({...thresholds,minAct:null},'SAT',candidate).outcome,'clear')
 assert.equal(rules.evaluateRule({...thresholds,minSat:null},'ACT',candidate).outcome,'clear')
})
test('preview fingerprint captures scores, rules, requirements and eligible cohort; decisions and drafts excluded',async()=>{
 const build=(revision=1,t=thresholds,requirement='BOTH',apps=[candidate])=>rules.buildRulePreview(scope,revision,t,requirement,apps)
 const initial=await build()
 for(const other of [await build(2),await build(1,{...thresholds,minGpa:3.6}),await build(1,thresholds,'SAT_OR_ACT'),await build(1,thresholds,'BOTH',[{...candidate,gpa:3}]),await build(1,thresholds,'BOTH',[{...candidate,status:'INTERVIEWING'}]),await build(1,thresholds,'BOTH',[])]) assert.notEqual(initial.fingerprint,other.fingerprint)
 assert.equal((await build(1,thresholds,'BOTH',[candidate,...['DRAFTING','ACCEPTED','REJECTED','WAITLISTED'].map((status,i)=>({...candidate,id:String(i),status}))])).results.length,1)
})
function harness(permissions=['recruitment.manage','applications.review','decisions.manage','applicants.identify']) {
 const calls=[], state={rule:{roundId,...thresholds,revision:1},anonymousReview:true,requirement:'BOTH',apps:[{...candidate,gpa:3}],flags:[],foreign:false}
 const prisma={
  pipelineRound:{findFirst:async({where})=>{assert.deepEqual(where,{id:roundId,clubId});return state.foreign?null:{id:roundId,anonymousReview:state.anonymousReview,screeningRule:state.rule,club:{testRequirement:state.requirement}}}},
  application:{findMany:async({where,select})=>{assert.deepEqual(where,{clubId,roundId,status:{in:['SUBMITTED','IN_REVIEW','INTERVIEWING']}});assert.deepEqual(select.student.select.studentProfile.select,{gpa:true,satScore:true,actScore:true});return state.apps.map(app=>({id:app.id,status:app.status,student:{studentProfile:app}}))}},
  recruitingRule:{update:async({data})=>{state.rule={...state.rule,...data};return state.rule},create:async({data})=>{state.rule=data;return data}},
  recruitingRuleFlag:{deleteMany:async()=>{state.flags=[];calls.push('delete')},createMany:async({data})=>{state.flags=data;calls.push('flags')}},
  auditLog:{create:async({data})=>{calls.push(data.action);assert.equal(data.actorId,'actor');assert.equal(data.clubId,clubId)}},
 }
 prisma.$transaction=async(fn,options)=>{calls.push(options?.isolationLevel);return fn(prisma)}
 const api=load('actions/recruiting-rules.ts',{'@/utils/prisma':{prisma},'@/utils/auth':{requireClubPermission:async(club,caps)=>{assert.equal(club,clubId);if(!caps.every(p=>permissions.includes(p)))throw Error('Denied');return {user:{id:'actor'},membership:{permissions}}}},'next/cache':{revalidatePath(){}}})
 return {api,state,calls}
}
test('explicit apply flags only and audits; stale previews cannot delete or create flags',async()=>{
 const h=harness(), preview=await h.api.previewRecruitingRule(scope)
 assert.equal(preview.results[0].outcome,'flag')
 assert.deepEqual(h.state.flags,[])
 h.state.apps[0].gpa=4
 await assert.rejects(h.api.applyRecruitingRuleFlags({...scope,fingerprint:preview.fingerprint}),/changed/)
 assert.ok(!h.calls.includes('delete'))
 h.state.apps[0].gpa=3
 const result=await h.api.applyRecruitingRuleFlags({...scope,fingerprint:preview.fingerprint})
 assert.equal(result.flagged,1);assert.equal(h.state.flags[0].applicationId,id)
 assert.equal(h.state.apps[0].status,'IN_REVIEW')
 assert.ok(h.calls.includes('Serializable'));assert.ok(h.calls.includes('recruiting.rules.flag'))
 await h.api.clearRecruitingRuleFlags(scope);assert.deepEqual(h.state.flags,[]);assert.ok(h.calls.includes('recruiting.rules.clear'))
})
test('save is versioned and audited, clears obsolete flags and never evaluates applicants',async()=>{
 const h=harness()
 await assert.rejects(h.api.saveRecruitingRule({...scope,expectedRevision:0,thresholds}),/changed/)
 assert.ok(!h.calls.includes('delete'))
 const result=await h.api.saveRecruitingRule({...scope,expectedRevision:1,thresholds:{...thresholds,minGpa:3.6}})
 assert.equal(result.revision,2);assert.ok(h.calls.includes('recruiting.rules.save'))
 assert.equal(h.state.apps[0].status,'IN_REVIEW')
})
test('server enforces scope, granular permissions and anonymous-only reviewer restrictions',async()=>{
 const h=harness();h.state.foreign=true
 await assert.rejects(h.api.previewRecruitingRule(scope),/Round/)
 await assert.rejects(h.api.saveRecruitingRule({...scope,expectedRevision:1,thresholds}),/Round/)
 assert.ok(!h.calls.includes('delete'))
 for(const permissions of [[],['applications.review'],['recruitment.manage']]) {
  const limited=harness(permissions)
  await assert.rejects(limited.api.previewRecruitingRule(scope),/Denied/)
  await assert.rejects(limited.api.applyRecruitingRuleFlags({...scope,fingerprint:'a'.repeat(64)}),/Denied/)
  await assert.rejects(limited.api.clearRecruitingRuleFlags(scope),/Denied/)
 }
 const anonymous=harness(['recruitment.manage','applications.review'])
 assert.equal((await anonymous.api.previewRecruitingRule(scope)).results[0].label,rules.ruleLabel(id))
 anonymous.state.anonymousReview=false
 await assert.rejects(anonymous.api.previewRecruitingRule(scope),/identity permission/)
 await assert.rejects(anonymous.api.applyRecruitingRuleFlags({...scope,fingerprint:'a'.repeat(64)}),/Denied/)
})

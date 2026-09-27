const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = {exports:{}}
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','module','exports',code)(name => mocks[name] || require(name),mod,mod.exports)
  return mod.exports
}
const {previewThresholds} = load('lib/review-rule-preview.ts')
test('threshold preview evaluates GPA, SAT and ACT independently without interpreting missing scores as failure', () => {
  assert.deepEqual(previewThresholds({gpa:3.5,sat:1400,act:30},{gpa:3.5,act:29}),[{metric:'gpa',result:'meets'},{metric:'sat',result:'missing'},{metric:'act',result:'below'}])
  assert.deepEqual(previewThresholds({}, {sat:1200}),[])
  for(const [metric,value] of [['gpa',5],['sat',1601],['act',37],['act',29.5],['gpa',NaN]]) assert.equal(previewThresholds({[metric]:value},{})[0].result,'invalid')
})
function nodes(node) {return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)]}
test('limited recruitment managers can change test requirements but cannot toggle anonymous rounds', async () => {
  const calls=[]
  const {RecruitmentReviewSettings} = load('components/recruitment-review-settings.tsx', {
    react:{useState:value=>[value,()=>{}]},
    '@/lib/workspace-api':{setRoundAnonymousReview:async(...args)=>calls.push(['privacy',...args]),setClubTestRequirement:async(...args)=>calls.push(['tests',...args])},
    '@/lib/test-scores':{testRequirements:['ACT'],testRequirementLabels:{ACT:'ACT'}},
    '@/components/ui/button':{Button:'button'},
  })
  const render=canIdentify=>RecruitmentReviewSettings({clubId:'club',rounds:[{id:'round',name:'Round one',anonymousReview:true}],onChanged(){},embedded:true,canIdentify})
  assert.equal(nodes(render(false)).find(n=>n.type==='input').props.disabled,true)
  assert.equal(nodes(render(false)).find(n=>n.type==='select').props.disabled,false)
  const toggle=nodes(render(true)).find(n=>n.type==='input')
  assert.equal(toggle.props.checked,true)
  toggle.props.onChange({target:{checked:false}})
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(calls,[['privacy','club','round',false]])
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = {exports:{}}
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','module','exports',code)(name => mocks[name] || (name === "@/components/product/action-workflow" ? {ActionWorkflow:"ActionWorkflow"} : require(name)),mod,mod.exports)
  return mod.exports
}
function nodes(node) {return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)]}
test('limited recruitment managers can change test requirements but cannot toggle anonymous rounds', async () => {
  const calls=[]
  const {RecruitmentReviewSettings} = load('components/recruitment-review-settings.tsx', {
    react:{useState:value=>[value,()=>{}]},
    '@/lib/workspace-api':{setRoundAnonymousReview:async(...args)=>calls.push(['privacy',...args]),setClubTestRequirement:async(...args)=>calls.push(['tests',...args])},
    '@/lib/test-scores':{testRequirements:['ACT'],testRequirementLabels:{ACT:'ACT'}},
    '@/components/ui/button':{Button:'button'},'@/components/ui/native-select':{NativeSelect:'NativeSelect'},
    '@/components/communications/template-editor':{DecisionTemplateEditor:'DecisionTemplateEditor'},
  })
  const render=canIdentify=>RecruitmentReviewSettings({clubId:'club',rounds:[{id:'round',name:'Round one',anonymousReview:true}],onChanged(){},embedded:true,canIdentify})
  assert.equal(nodes(render(false)).find(n=>n.type==='input').props.disabled,true)
  assert.equal(nodes(render(false)).find(n=>['select','NativeSelect'].includes(n.type?.name??n.type)).props.disabled,false)
  const toggle=nodes(render(true)).find(n=>n.type==='input')
  assert.equal(toggle.props.checked,true)
  toggle.props.onChange({target:{checked:false}})
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(calls,[['privacy','club','round',false]])
})

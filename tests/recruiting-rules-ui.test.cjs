const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function nodes(node){return !node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)]}
const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):''
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&text(n)===label)
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function harness(options={}){
 const slots=[],effects=[],calls=[]
 let index=0, flags=[]
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}}}
 const preview={revision:1,fingerprint:'a'.repeat(64),results:[{id:'candidate',label:'Applicant CANDIDATE',status:'IN_REVIEW',outcome:'flag',reasons:['GPA below 3.5'],missing:[]}]}
 const api={getRecruitingRuleFlags:async()=>flags,previewRecruitingRule:async()=>{calls.push('preview');return preview},applyRecruitingRuleFlags:async(input)=>{calls.push(['apply',input]);if(options.stale)throw Error('Changed');flags=[{applicationId:'candidate',label:'Applicant CANDIDATE',reasons:['GPA below 3.5'],ruleRevision:1,flaggedAt:new Date(0)}];return{flagged:1}},clearRecruitingRuleFlags:async()=>{calls.push('clear');flags=[]},saveRecruitingRule:async(input)=>{calls.push(['save',input]);return input}}
 const mocks={react,'@/components/ui/confirm-dialog':require('./helpers/confirm-stub.cjs'),'@/components/ui/button':{Button:'Button'},'@/components/ui/segmented-control':{PillGroup:'PillGroup'},'@/components/ui/range-slider':{RangeSlider:'RangeSlider'},'@/components/ui/checkbox':{Checkbox:'Checkbox'},'@/lib/scheduling-config':{SCHEDULING_TIMEZONE:'America/New_York'},'@/components/ui/loading-state':{LoadingState:'LoadingState'},'@/lib/workspace-api':api,'@/lib/application-state':{useApplicationState:()=>({focusLeader:value=>calls.push(['focus',value])})},'@/lib/recruiting-rules':{emptyRuleThresholds:{minGpa:null,minSat:null,minAct:null,requiredEventIds:[]}},'@/lib/test-scores':{testRequirementLabels:{OPTIONAL:'Optional'}}}
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync('components/views/screening-dashboard-view.tsx','utf8')+'\nexports.RuleEditor = RuleEditor;',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
 new Function('require','module','exports','window',code)(name=>mocks[name]||require(name),mod,mod.exports,{addEventListener(){},removeEventListener(){}})
 const props={clubId:'club',round:{id:'round',name:'Review',anonymousReview:true,screeningRule:{minGpa:3.5,minSat:null,minAct:null,requiredEventIds:options.requiredEventIds??[],revision:1}},data:{testRequirement:'OPTIONAL',events:options.events??[],canPreview:true,canIdentify:false,canApply:options.canApply??true},onSaved(){calls.push('saved')},onReview(){calls.push('review')}}
 return{calls,render(){index=0;const tree=mod.exports.RuleEditor(props);while(effects.length)effects.shift()();return tree}}
}
test('rule UI saves configuration independently; preview never applies flags without the explicit action',async()=>{
 const h=harness();h.render();await flush();let tree=h.render()
 assert.equal(button(tree,'Apply 1 review flags'),undefined)
 button(tree,'Preview saved rules').props.onClick();await flush();tree=h.render()
 assert.deepEqual(h.calls,['preview'])
 button(tree,'Apply 1 review flags').props.onClick();await flush();tree=h.render()
 assert.equal(h.calls[1][0],'apply');assert.equal(h.calls[1][1].fingerprint,'a'.repeat(64))
 assert.match(text(tree),/1 flags saved. No decisions changed/)
 button(tree,'Review applicant').props.onClick()
 assert.deepEqual(h.calls.at(-2),['focus',{clubId:'club',applicantId:'candidate',roundId:'round'}])
 button(tree,'Clear saved flags').props.onClick();await flush();tree=h.render()
 assert.match(text(tree),/No active flags/)
 nodes(tree).find(n=>n.type==='RangeSlider'&&n.props.label==='Minimum GPA').props.onChange(3.7);tree=h.render()
 assert.equal(button(tree,'Preview saved rules').props.disabled,true)
 nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush()
 const save=h.calls.find(c=>Array.isArray(c)&&c[0]==='save')[1]
 assert.equal(save.expectedRevision,1);assert.equal(save.thresholds.minGpa,3.7)
 assert.equal(h.calls.filter(c=>c==='preview').length,1)
})
test('limited permissions disable apply and stale failures discard the preview for a safe retry',async()=>{
 const limited=harness({canApply:false});limited.render();await flush();let tree=limited.render()
 button(tree,'Preview saved rules').props.onClick();await flush();tree=limited.render()
 assert.equal(button(tree,'Apply 1 review flags').props.disabled,true)
 const stale=harness({stale:true});stale.render();await flush();tree=stale.render()
 button(tree,'Preview saved rules').props.onClick();await flush();tree=stale.render()
 button(tree,'Apply 1 review flags').props.onClick();await flush();tree=stale.render()
 assert.equal(button(tree,'Apply 1 review flags'),undefined)
 assert.ok(nodes(tree).some(n=>n.props?.role==='alert'))
 assert.match(text(tree),/No active flags/)
})

test('attendance picker: choosing an info session marks the rule unsaved and saves the event ids',async()=>{
 const h=harness({events:[{id:'e2',title:'Resume workshop',date:new Date('2026-10-02T22:00:00Z')},{id:'e1',title:'Info session',date:new Date('2026-09-20T22:00:00Z')}]});h.render();await flush();let tree=h.render()
 assert.match(text(tree),/Info session/);assert.match(text(tree),/Resume workshop/)
 const boxes=nodes(tree).filter(n=>n.type==='Checkbox')
 assert.equal(boxes.length,2);assert.ok(boxes.every(box=>box.props.checked===false))
 boxes[1].props.onCheckedChange(true);boxes[0].props.onCheckedChange(true);tree=h.render()
 assert.ok(nodes(tree).filter(n=>n.type==='Checkbox').every(box=>box.props.checked===true))
 const form=nodes(tree).find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});await flush()
 const save=h.calls.find(call=>call[0]==='save')[1]
 assert.deepEqual(save.thresholds.requiredEventIds,['e1','e2'])
})
test('attendance picker: no recruiting events shows a pointer to Events; a deleted saved event can be removed',async()=>{
 const empty=harness();empty.render();await flush()
 assert.match(text(empty.render()),/No recruiting events yet/)
 const stale=harness({events:[{id:'e1',title:'Info session',date:new Date(0)}],requiredEventIds:['e1','gone']});stale.render();await flush();let tree=stale.render()
 assert.match(text(tree),/1 more selected event isn/)
 nodes(tree).find(n=>n.type==='Button'&&text(n)==='Remove').props.onClick();tree=stale.render()
 assert.doesNotMatch(text(tree),/more selected/)
})

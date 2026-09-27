const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
function load(file,mocks={}){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.replace('@/','')+'.ts'):n.startsWith('@/')?new Proxy({},{get:(_,key)=>key}):require(n),mod,mod.exports);return mod.exports}
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)]
test('member and access reads retain separate permission gates and project only a brief profile',async()=>{
 const gates=[],queries=[]
 const api=load('actions/club-access.ts',{'@/utils/auth':{requireClubPermission:async(id,permissions)=>gates.push([id,permissions])},'@/utils/prisma':{prisma:{clubMember:{findMany:async query=>{queries.push(query);return[]}},clubInvitation:{findMany:async()=>[]}}}})
 await api.getClubMembers('club');await api.getClubAccess('club')
 assert.deepEqual(gates,[['club',['members.manage']],['club',['leaders.manage']]])
 for(const query of queries){assert.equal(query.where.clubId,'club');assert.deepEqual(Object.keys(query.include.user.select).sort(),['email','studentProfile']);assert.deepEqual(Object.keys(query.include.user.select.studentProfile.select).sort(),['firstName','gradYear','lastName','major'])}
})
test('member drawer access editor disables higher-authority edits and capabilities outside delegation',()=>{
 const actor={clubId:'club',isOwner:false,permissions:['leaders.manage','applications.review']}
 const C=load('components/club-access-editor.tsx',{react:{useState:v=>[v,()=>{}]},'@/contexts/auth-context':{useAuth:()=>({user:{memberships:[actor]}})}}).ClubAccessEditor
 const target={id:'target',isOwner:true,permissions:[],user:{email:'owner@example.test'}}
 let tree=C({clubId:'club',initial:{members:[target],invitations:[]},selectedMemberId:'target'})
 assert.equal(nodes(tree).find(n=>n.type==='fieldset').props.disabled,true)
 target.isOwner=false;target.permissions=['applications.review'];tree=C({clubId:'club',initial:{members:[target],invitations:[]},selectedMemberId:'target'})
 assert.equal(nodes(tree).find(n=>n.type==='fieldset').props.disabled,false)
 const labels=nodes(tree).filter(n=>n.type==='label')
 const identity=labels.find(n=>nodes(n).some(child=>child.type==='input')&&JSON.stringify(n.props.children).includes('View identified applicants'))
 assert.equal(nodes(identity).find(n=>n.type==='input').props.disabled,true)
 assert.equal(nodes(tree).filter(n=>n.type==='select').length,1)
})

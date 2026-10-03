const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function load(file,mocks={}){
 mocks={"@/utils/support-audit":{auditSupportAction:async()=>{}},...mocks};
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 new Function('require','module','exports',code)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.replace('@/','')+'.ts',mocks):require(n),mod,mod.exports)
 return mod.exports
}
const owner='00000000-0000-4000-8000-000000000001', appId='00000000-0000-4000-8000-000000000002', questionId='00000000-0000-4000-8000-000000000003'
const url='http://localhost/api/application-attachments?applicationId='+appId+'&questionId='+questionId
function setup({answer=true,publicBucket=false,response=owner+'/application.pdf',authError=null,reviewerStatus=null}={}){
 let query, signed
 process.env.SUPABASE_SECRET_KEY='test-only'
 const api=load('app/api/application-attachments/route.ts',{
  '@/utils/auth':{requireAuth:async()=>{if(authError)throw authError;return{user:{id:reviewerStatus?questionId:owner}}}},
  '@/utils/prisma':{prisma:{applicationAnswer:{findFirst:async input=>{query=input;if(reviewerStatus && input.where.application.OR[1].club.members.some.status!==reviewerStatus)return null;return answer?{response,question:{clubId:'club'},application:{clubId:'club',studentId:owner}}:null}}}},
  '@supabase/supabase-js':{createClient:()=>({storage:{getBucket:async()=>({data:{public:publicBucket}}),from:bucket=>({createSignedUrl:async(...args)=>{signed={bucket,args};return{data:{signedUrl:'https://storage.test/signed'}}}})}})},
  'next/server':{NextResponse:class{constructor(body,init){this.body=body;Object.assign(this,init)}static redirect(url,init){return{status:302,url,...init}}}},
 })
 return{api,query:()=>query,signed:()=>signed}
}
test('attachment signer binds authorization to the saved answer and preserves anonymous/draft/club restrictions',async()=>{
 const h=setup(),res=await h.api.GET({url})
 assert.equal(res.status,302)
 assert.deepEqual(h.signed(),{bucket:'resumes',args:[owner+'/application.pdf',300,{download:true}]})
 assert.equal(res.headers['Cache-Control'],'private, no-store')
 const where=h.query().where
 assert.equal(where.applicationId,appId);assert.equal(where.questionId,questionId)
 assert.deepEqual(where.question,{type:'FILE_UPLOAD'})
 assert.equal(where.application.OR[1].club.members.some.status, 'ACTIVE', 'suspended/former reviewers must never receive a signed attachment')
 assert.deepEqual(where.application.OR[0],{studentId:owner})
 assert.deepEqual(where.application.OR[1],{status:{not:'DRAFTING'},round:{anonymousReview:false},club:{members:{some:{userId:owner,status:'ACTIVE',OR:[{isOwner:true},{permissions:{has:'applicants.identify'}}]}}}})
})
test('missing/inaccessible references, foreign paths, external URLs and public buckets never sign',async()=>{
 for(const options of [{answer:false},{response:questionId+'/other.pdf'},{response:owner+'/../secret.pdf'},{response:'https://external.test/file.pdf'},{publicBucket:true}]){
  const h=setup(options),res=await h.api.GET({url})
  assert.equal(res.status,options.publicBucket?503:404);assert.equal(h.signed(),undefined)
 }
 const h=setup();assert.equal((await h.api.GET({url:'http://localhost/api/application-attachments?path='+owner+'/old.pdf'})).status,400);assert.equal(h.query(),undefined)
 const redirect=Object.assign(Error('Auth'),{digest:'NEXT_REDIRECT;/'})
 await assert.rejects(setup({authError:redirect}).api.GET({url}),/Auth/)
})
test('legacy task writer rejects authorized old clients without any task mutation',async()=>{
 let checked=false
 const api=load('actions/club-workspace.ts',{
  '@/utils/auth':{requireClubPermission:async(id,caps)=>{checked=true;assert.equal(id,appId);assert.deepEqual(caps,['tasks.manage']);return{user:{id:owner}}}},
  '@/utils/prisma':{prisma:new Proxy({},{get(){throw Error('Legacy database write attempted')}})},
 })
 await assert.rejects(api.saveClubTask({clubId:appId,id:questionId,title:'Stale overwrite',status:'DONE'}),/Legacy task writes are disabled/)
 assert.ok(checked)
})
test('resume upload refuses public buckets and issues only an owner-scoped private key',async()=>{
 process.env.SUPABASE_SECRET_KEY='test-only'
 for(const isPublic of [true,false]){
  let signed
  const api=load('actions/storage.ts',{
   '@/utils/auth':{requireAuth:async()=>({user:{id:owner}})},
   'next/headers':{cookies:async()=>({})},
   '@/utils/supabase/server':{createClient:async()=>({storage:{from:()=>({createSignedUploadUrl:async path=>{signed=path;return{data:{signedUrl:'https://upload.test',token:'token'}}}})}})},
   '@supabase/supabase-js':{createClient:()=>({storage:{getBucket:async()=>({data:{public:isPublic}})}})},
  })
  if(isPublic){await assert.rejects(api.getSignedUploadUrl({bucket:'resumes',fileName:'application.pdf'}),/unavailable/);assert.equal(signed,undefined)}
  else{
   const result=await api.getSignedUploadUrl({bucket:'resumes',fileName:'application.pdf'})
   assert.match(result.path,new RegExp('^'+owner+'/[0-9]+-application.pdf$'));assert.equal(result.publicUrl,result.path)
   await assert.rejects(api.getSignedUploadUrl({bucket:'resumes',fileName:'%2e%2e.pdf'}))
  }
 }
})

test('only active identified reviewers can obtain application attachment downloads; suspension fails before signing', async () => {
 for (const reviewerStatus of ['ACTIVE', 'SUSPENDED', 'LEFT']) {
  const h = setup({reviewerStatus}), result = await h.api.GET({url})
  assert.equal(result.status, reviewerStatus === 'ACTIVE' ? 302 : 404)
  assert.equal(h.query().where.application.OR[1].club.members.some.userId, questionId)
  assert.equal(!!h.signed(), reviewerStatus === 'ACTIVE')
 }
})

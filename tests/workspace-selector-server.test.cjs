const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')

// Execute the real page → loader → action → platform guard chain. Only external
// identity, provider and database boundaries are controlled by this test.
test('direct Admin page keeps server allowlist, active grant, MFA and elevation authoritative',async()=>{
 const previous=process.env.OUTCLASS_PLATFORM_ADMIN_IDS;process.env.OUTCLASS_PLATFORM_ADMIN_IDS='trusted-admin'
 try{
  for(const scenario of [
   {id:'ordinary-owner',grant:true,aal:'aal2',elevated:true,denied:true},
   {id:'trusted-admin',grant:false,aal:'aal2',elevated:true,denied:true},
   {id:'trusted-admin',grant:true,aal:'aal1',elevated:true,denied:true},
   {id:'trusted-admin',grant:true,aal:'aal2',elevated:false,denied:true},
   {id:'trusted-admin',grant:true,aal:'aal2',elevated:true,denied:false},
  ]){
   const cache={},reads=[],count=async()=>{reads.push('protected metric');return 1}
   const mocks={
    '@/components/icons':{ArrowRight:()=>null,ArrowUpRight:()=>null},
    '@/utils/auth':{requireAuth:async()=>({user:{id:scenario.id,role:'ADMIN',adminRoles:[{isOwner:true}]}})},
    '@/utils/prisma':{prisma:{platformAdmin:{findUnique:async()=>({active:scenario.grant})},...Object.fromEntries(['user','club','eventPublication','clubClaim','platformReport','meeting'].map(name=>[name,{count}])),auditLog:{create:async()=>{}}}},
    '@/utils/supabase/server':{createClient:async()=>({auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:scenario.aal}})}}})},
    'next/headers':{cookies:async()=>({has:()=>false})},
    'next/navigation':{unstable_rethrow(){},redirect:url=>{throw Object.assign(Error('redirect'),{url})}},
    'next/cache':{revalidatePath(){},revalidateTag(){}},
    '@/actions/platform-admin':{},'@/actions/platform-organization-onboarding':{},'@/actions/club-onboarding':{},'@/utils/email':{},'@/utils/invitation-delivery':{},'@/utils/invitation-background':{},'@/utils/club-onboarding':{},
    '@/components/product/page-header':{PageHeader:()=>null},
   }
   function load(file){if(cache[file])return cache[file];const mod={exports:{}};new Function('require','module','exports','console',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(name.slice(2)+(name.startsWith('@/components/')?'.tsx':'.ts')):require(name),mod,mod.exports,{error(){}});return cache[file]=mod.exports}
   const {AdminAccessError}=load('lib/admin-failure.ts')
   mocks['@/utils/admin-elevation']={requireAdminElevation:async()=>{if(!scenario.elevated)throw new AdminAccessError('ADMIN_ELEVATION_REQUIRED','Verification required');return {}}}
   const page=load('app/platform/page.tsx').default
   if(scenario.denied){await assert.rejects(page(),e=>e.url==='/platform/login');assert.deepEqual(reads,[])}
   else{const html=require('react-dom/server').renderToStaticMarkup(await page());assert.match(html,/Platform metrics/);assert.equal(reads.length,7)}
  }
 }finally{if(previous===undefined)delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;else process.env.OUTCLASS_PLATFORM_ADMIN_IDS=previous}
})

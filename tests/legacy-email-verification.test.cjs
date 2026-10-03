const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');
function load(file,mocks={}) {const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports;}
const confirmed='2026-10-01T00:00:00Z';
const receipt={method:'password_recovery_v1',userId:'student-id',email:'student@virginia.edu',emailConfirmedAt:confirmed,verifiedAt:'2026-10-02T00:00:00Z'};
const account={user:{id:'student-id',email:'student@virginia.edu'},supabaseUser:{id:'student-id',email:'student@virginia.edu',email_confirmed_at:confirmed,app_metadata:{outclass_verified_email:receipt}}};
test('legacy mailbox recovery proof accepts only exact trusted provider identity and confirmation',()=>{
 const {hasConfirmedUniversityEmail:check}=load('utils/verified-email-policy.ts');assert.equal(check(account),true);
 for(const change of [{id:'victim'},{email:'victim@virginia.edu'},{email_confirmed_at:null},{email_confirmed_at:'2026-10-02T01:00:00Z'},{app_metadata:{}},{app_metadata:{outclass_verified_email:{...receipt,verifiedAt:'invalid'}}},{app_metadata:{outclass_verified_email:{...receipt,verifiedAt:'2099-01-01'}}},{app_metadata:{outclass_verified_email:{...receipt,userId:'victim'}}},{app_metadata:{outclass_verified_email:{...receipt,method:'browser'}}},{app_metadata:{},user_metadata:{outclass_verified_email:receipt}}])assert.equal(check({...account,supabaseUser:{...account.supabaseUser,...change}}),false);
 assert.equal(check({...account,user:{id:'victim',email:account.user.email}}),false);
});
test('only consumed recovery token and successful password change can record provider-bound proof',async()=>{
 const {NextRequest}=require('next/server');const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret:process.env.SUPABASE_SECRET_KEY};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-fixture';process.env.SUPABASE_SECRET_KEY='server-fixture';
 try {for(const variant of ['success','invalid-token','password-failure','identity-change','timestamp-change','record-failure']){
  const calls=[];const user={id:'student-id',email:receipt.email,email_confirmed_at:confirmed};
  const normal={verifyOtp:async args=>{assert.equal(args.type,'recovery');calls.push('verify');return variant==='invalid-token'?{data:{},error:{}}:{data:{user,session:{}},error:null};},updateUser:async()=>{calls.push('password');return {error:variant==='password-failure'?{}:null};},signOut:async()=>({error:null})};
  const admin={getUserById:async id=>{assert.equal(id,user.id);calls.push('read');return {data:{user:{...user,email:variant==='identity-change'?'victim@virginia.edu':user.email,email_confirmed_at:variant==='timestamp-change'?'2026-10-02T02:00:00Z':confirmed}},error:null};},updateUserById:async(id,value)=>{calls.push('record');assert.equal(id,user.id);assert.deepEqual(Object.keys(value),['app_metadata']);const proof=value.app_metadata.outclass_verified_email;assert.equal(proof.email,user.email);assert.equal(proof.emailConfirmedAt,confirmed);assert.equal(proof.userId,id);assert.equal(proof.method,'password_recovery_v1');assert.equal(value.app_metadata.role,undefined);return {error:variant==='record-failure'?{}:null};}};
  const {POST}=load('app/api/auth/password-recovery/route.ts',{'@supabase/supabase-js':{createClient:(_url,key)=>key==='server-fixture'?{auth:{admin}}:{auth:normal}}});
  const response=await POST(new NextRequest('https://app.example/api/auth/password-recovery',{method:'POST',headers:{origin:'https://app.example'},body:JSON.stringify({action:'reset',tokenHash:'a'.repeat(64),password:'Secure-fixture-only!123',confirmation:'Secure-fixture-only!123',userId:'victim',email:'victim@virginia.edu',app_metadata:{role:'OWNER'}})}));
  assert.equal(response.status,['invalid-token','password-failure'].includes(variant)?400:200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(calls.includes('record'),['success','record-failure'].includes(variant));
 }}finally{for(const [k,v]of [['NEXT_PUBLIC_SUPABASE_URL',saved.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',saved.key],['SUPABASE_SECRET_KEY',saved.secret]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});

test('provider-issued Microsoft identity verifies UVA ownership without signup email OTP',()=>{
 const check=load('utils/verified-email-policy.ts').hasConfirmedUniversityEmail;
 const user={id:'azure-user',email:'azure@virginia.edu'};
 const supabaseUser={...user,email_confirmed_at:'2026-01-01',identities:[{provider:'azure',user_id:user.id,identity_data:{email:user.email}}]};
 assert.equal(check({user,supabaseUser}),true);
 for(const identity of [{provider:'email',user_id:user.id,identity_data:{email:user.email}},{provider:'azure',user_id:'different',identity_data:{email:user.email}},{provider:'azure',user_id:user.id,identity_data:{email:'other@virginia.edu'}}])assert.equal(check({user,supabaseUser:{...supabaseUser,identities:[identity]}}),false);
 assert.equal(check({user,supabaseUser:{...supabaseUser,email_confirmed_at:null}}),false);
});

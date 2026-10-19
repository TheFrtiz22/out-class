const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {loader}=require('./helpers/communications-loader.cjs');
const tokenHash='a'.repeat(64), id='00000000-0000-4000-8000-000000000001', email='invite@virginia.edu';
const fingerprint=loader({})('lib/student-invitation.ts').studentInvitationFingerprint;
const previousSecret=process.env.SUPABASE_SECRET_KEY;
before(()=>{process.env.SUPABASE_SECRET_KEY='mock-only-not-a-provider-secret';});
after(()=>{if(previousSecret===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=previousSecret;});
function harness(patch={}) {
 const calls=[],state={binding:true,disabled:false,current:null,pending:{id,email,invited_at:'2026-01-01',email_confirmed_at:null},verified:{id,email,invited_at:'2026-01-01'},session:{access_token:'fixture-only'},...patch};
 const normal={auth:{getUser:async()=>({data:{user:state.current}}),setSession:async()=>{calls.push('attach');return{error:null};}}};
 const fresh={auth:{verifyOtp:async input=>{calls.push('verify');assert.deepEqual(input,{token_hash:tokenHash,type:'invite'});return{error:state.verifyError||null,data:{user:state.verified,session:state.session}};},updateUser:async input=>{calls.push('password');assert.equal(input.password,'Synthetic-password!2026');return{error:state.passwordError||null};}}};
 const api=loader({'next/headers':{cookies:async()=>({has:()=>!!state.impersonation})},'@/utils/supabase/server':{createClient:async()=>normal},'@/utils/admin-elevation':{freshAuthClient:()=>fresh},'@supabase/supabase-js':{createClient:()=>({auth:{admin:{getUserById:async actual=>{calls.push('provider-status');assert.equal(actual,id);return{data:{user:state.pending},error:state.providerError||null};}}}})},'@/utils/prisma':{prisma:{user:{findFirst:async()=>{calls.push('account');return{id,email,disabledAt:state.disabled?new Date():null};}},auditLog:{findFirst:async({where})=>{calls.push('binding');assert.equal(where.targetId,id);assert.equal(where.action,'platform.student.invitation.binding');assert.equal(where.details.equals,fingerprint(tokenHash));return state.binding?{id:'binding'}:null;},create:async()=>{calls.push('audit');return{};}}}}})('app/api/auth/student-claim/route.ts');
 const request=(body={},origin='https://fixture.invalid')=>{const r=new Request('https://fixture.invalid/api/auth/student-claim',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,tokenHash,password:'Synthetic-password!2026',...body})});r.nextUrl=new URL(r.url);return api.POST(r);};
 return{state,calls,request};
}
test('claim fingerprint is deterministic, domain separated and never the redeemable token hash',()=>{
 const {createHash}=require('node:crypto');assert.match(fingerprint(tokenHash),/^[a-f0-9]{64}$/);assert.notEqual(fingerprint(tokenHash),tokenHash);assert.notEqual(fingerprint(tokenHash),createHash('sha256').update(tokenHash).digest('hex'));
 for(const token of ['bad','g'.repeat(64),'a'.repeat(65)])assert.throws(()=>fingerprint(token));
});
test('bound intended invite verifies at Auth before password, success audit and browser session attachment',async()=>{
 const h=harness();const r=await h.request();assert.equal(r.status,200);assert.deepEqual(await r.json(),{success:true});assert.deepEqual(h.calls,['account','binding','provider-status','verify','password','audit','attach']);
});
test('unbound links, disabled accounts and another signed-in identity do not consume the link',async()=>{
 for(const patch of [{binding:false},{disabled:true},{current:{id:'foreign',email:'foreign@virginia.edu'}}]){const h=harness(patch);assert.equal((await h.request()).status,400);assert.ok(!h.calls.includes('verify'));assert.ok(!h.calls.includes('password'));assert.ok(!h.calls.includes('attach'));}
});
test('confirmed, non-invited, mismatched and unavailable provider identities deny before verification',async()=>{
 for(const patch of [{pending:null},{pending:{id,email}},{pending:{id,email,invited_at:'2026-01-01',email_confirmed_at:'2026-01-02'}},{pending:{id:'foreign',email,invited_at:'2026-01-01'}},{pending:{id,email:'foreign@virginia.edu',invited_at:'2026-01-01'}},{providerError:Error('unavailable')}]){const h=harness(patch);assert.equal((await h.request()).status,400);assert.ok(!h.calls.includes('verify'));}
});
test('expired or mismatched verification cannot set a password or attach a session',async()=>{
 for(const patch of [{verifyError:Error('expired')},{verified:{id:'foreign',email}},{verified:{id,email:'foreign@virginia.edu'}},{session:null}]){const h=harness(patch);assert.equal((await h.request()).status,400);assert.ok(!h.calls.includes('password'));assert.ok(!h.calls.includes('attach'));}
 const h=harness({passwordError:Error('password update failed')});assert.equal((await h.request()).status,400);assert.ok(!h.calls.includes('audit'));assert.ok(!h.calls.includes('attach'));
});
test('origin, support mode and invalid input fail before database/provider access',async()=>{
 for(const [patch,body,origin,status] of [[{}, {}, 'https://foreign.invalid',403],[{impersonation:true},{},undefined,400],[{},{email:'foreign@example.com'},undefined,400],[{},{tokenHash:'invalid'},undefined,400],[{},{password:'short'},undefined,400]]){const h=harness(patch);assert.equal((await h.request(body,origin)).status,status);assert.deepEqual(h.calls,[]);}
});

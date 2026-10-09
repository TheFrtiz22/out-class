const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const { NextRequest } = require('next/server');
function loader(mocks, diagnostics, faults) {
  const cache = {};
  function load(file) {
    file = path.resolve(file);
    if (cache[file]) return cache[file].exports;
    const m = { exports: {} }; cache[file] = m;
    new Function('require','module','exports','console',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2)+'.ts') : require(name),m,m.exports,{error:value=>{if(faults.logger)throw Error('private logger failure');diagnostics.push(JSON.parse(value));}});
    return m.exports;
  }
  return load;
}
const id='00000000-0000-4000-8000-000000000001';
function harness(faults = {}) {
  let identity=id, grant=true, disabled=false, aal='aal2', sessionId='normal-session', passwordOk=true, mfaOk=true, verifiedActor=id, attempts=0, liveSession=true, providerStatus=400, internalSyntax=false;
  const jar = new Map(), logs=[], diagnostics=[], elevations=[], challenges=[];
  const cookieJar={has:k=>jar.has(k),get:k=>jar.has(k)?{value:jar.get(k)}:undefined,set:(k,v,options)=>{assert.equal(options.httpOnly,true);assert.equal(options.sameSite,'strict');if(!v)jar.delete(k);else jar.set(k,v);}};
  function matches(row, where) { return Object.entries(where).every(([key,v])=>v && typeof v==='object' && 'gte' in v ? row[key]>=v.gte : row[key]===v); }
  function model(rows) { return {
    findUnique:async({where})=>rows.find(r=>matches(r,where))||null,
    create:async({data})=>{const row={id:'row-'+rows.length,revokedAt:null,consumedAt:null,attempts:0,...data};rows.push(row);return row;},
    update:async({where,data})=>{const row=rows.find(r=>matches(r,where));for(const [k,v]of Object.entries(data))row[k]=v?.increment?row[k]+v.increment:v;return row;},
    updateMany:async({where,data})=>{const found=rows.filter(r=>matches(r,where));for(const row of found)Object.assign(row,data);return{count:found.length};},
  }; }
  const prisma={
    $queryRaw:async strings=>strings[0].includes('auth.sessions')?(liveSession?[{id:sessionId}]:[]):[], $transaction:async fn=>fn(prisma),
    platformAdmin:{findUnique:async()=>{if(internalSyntax)throw new SyntaxError('private internal parsing failure');return{active:grant};}},
    user:{findUnique:async()=>({id:identity,email:'admin@virginia.edu',disabledAt:disabled?new Date():null})},
    adminElevation:model(elevations),adminElevationChallenge:model(challenges),
    platformViewSession:{updateMany:async()=>({count:0})},
    auditLog:{create:async({data})=>logs.push({...data,createdAt:new Date()}),count:async({where})=>logs.filter(r=>matches(r,where)).length},
  };
  const normal={auth:{getClaims:async()=>({data:{claims:{session_id:sessionId}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal}})},setSession:async()=>{sessionId='fresh-session';return{error:null};},signOut:async()=>({error:null})}};
  const fresh={auth:{
    signInWithPassword:async()=>{attempts++;return passwordOk?{data:{user:{id:identity},session:{access_token:'fresh-access',refresh_token:'fresh-refresh'}}}:{error:Object.assign(Error('bad password'),{status:providerStatus,code:'invalid_credentials'})};},
    setSession:async()=>({error:null}),
    getUser:async()=>({data:{user:{id:verifiedActor}}}),getClaims:async()=>({data:{claims:{session_id:'fresh-session'}}}),
    mfa:{listFactors:async()=>({data:{totp:[{id:'factor',status:'verified'}]}}),challenge:async()=>({data:{id:'provider-challenge'}}),verify:async()=>mfaOk?{data:{access_token:'verified-access',refresh_token:'verified-refresh'}}:{error:Object.assign(Error('bad MFA'),{status:providerStatus,code:'mfa_verification_failed'})},getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})},
  }};
  const load=loader({
    'node:crypto':{...require('node:crypto'),randomUUID:()=>{if(faults.uuid)throw Error('private UUID failure');return require('node:crypto').randomUUID();}},
    '@/utils/prisma':{prisma},'@supabase/supabase-js':{createClient:()=>fresh},
    '@/utils/auth':{requireAuth:async()=>{if(disabled)throw Error('Account disabled.');return{user:{id:identity,email:'admin@virginia.edu',role:identity===id?'STUDENT':'CLUB_ADMIN'}};}},
    '@/utils/supabase/server':{createClient:async()=>normal},'next/headers':{cookies:async()=>cookieJar},
    '@/utils/support-audit':{supportInternal:{run:async(_,fn)=>fn()}},
  }, diagnostics, faults);
  const guard=load('utils/platform-admin.ts'), route=load('app/api/platform/elevation/route.ts'), logout=load('app/api/auth/logout/route.ts');
  const post=(body,origin='http://localhost')=>route.POST(new NextRequest('http://localhost/api/platform/elevation',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
  return{guard,post,logs,diagnostics,rawPost:body=>route.POST(new NextRequest('http://localhost/api/platform/elevation',{method:'POST',headers:{origin:'http://localhost','Content-Type':'application/json'},body})),elevations,challenges,jar,attempts:()=>attempts,
    logout:()=>logout.POST(new NextRequest('http://localhost/api/auth/logout',{method:'POST',headers:{origin:'http://localhost'}})),
    set(p){if('internalSyntax'in p)internalSyntax=p.internalSyntax;if('providerStatus'in p)providerStatus=p.providerStatus;if('liveSession'in p)liveSession=p.liveSession;if('identity'in p)identity=p.identity;if('grant'in p)grant=p.grant;if('disabled'in p)disabled=p.disabled;if('aal'in p)aal=p.aal;if('sessionId'in p)sessionId=p.sessionId;if('passwordOk'in p)passwordOk=p.passwordOk;if('mfaOk'in p)mfaOk=p.mfaOk;if('verifiedActor'in p)verifiedActor=p.verifiedActor;},
    elevate:async()=>{assert.equal((await post({action:'password',password:'fresh-password'})).status,200);assert.equal((await post({action:'verify',code:'123456'})).status,200);},
  };
}
async function configured(fn){const saved={ids:process.env.OUTCLASS_PLATFORM_ADMIN_IDS,secret:process.env.SUPABASE_SECRET_KEY};process.env.OUTCLASS_PLATFORM_ADMIN_IDS=id;process.env.SUPABASE_SECRET_KEY='local-unit-test-secret';try{await fn();}finally{for(const[k,v]of[['OUTCLASS_PLATFORM_ADMIN_IDS',saved.ids],['SUPABASE_SECRET_KEY',saved.secret]])if(v===undefined)delete process.env[k];else process.env[k]=v;}}

test('student, club leader, disabled admin, inactive grant and missing MFA are denied',async()=>configured(async()=>{
 for(const patch of [{identity:'student'},{identity:'leader'},{disabled:true},{grant:false},{aal:'aal1'}]){const h=harness();h.set(patch);await assert.rejects(h.guard.requirePlatformAdmin());}
}));
test('eligibility and an existing aal2 session do not grant elevation; fresh password plus MFA does',async()=>configured(async()=>{
 const h=harness();assert.equal((await h.guard.requirePlatformAdminEligibility()).id,id);await assert.rejects(h.guard.requirePlatformAdmin(),/Fresh Admin/);
 await h.elevate();assert.equal((await h.guard.requirePlatformAdmin()).id,id);
 assert.equal(h.elevations.length,1);assert.equal(h.elevations[0].authSessionId,'fresh-session');assert.ok(h.elevations[0].passwordVerifiedAt<=h.elevations[0].mfaVerifiedAt);
 assert.ok(h.logs.some(r=>r.action==='platform.elevation.create'));assert.ok(!JSON.stringify(h.logs).includes('fresh-password'));
 assert.match(h.elevations[0].tokenHash,/^[a-f0-9]{64}$/);assert.notEqual(h.jar.get('outclass-admin-elevation'),h.elevations[0].tokenHash);
 assert.equal(h.challenges[0].encryptedCredentials,'');
}));
test('expired, revoked, forged, wrong-actor and different Auth-session elevations fail closed',async()=>configured(async()=>{
 for(const change of [h=>h.elevations[0].expiresAt=new Date(0),h=>h.elevations[0].revokedAt=new Date(),h=>h.jar.set('outclass-admin-elevation','f'.repeat(64)),h=>h.elevations[0].actorId='other',h=>h.set({sessionId:'different'}),h=>h.set({liveSession:false})]){const h=harness();await h.elevate();change(h);await assert.rejects(h.guard.requirePlatformAdmin());}
}));
test('wrong passwords, wrong MFA, actor mismatch, origin and expired/reused challenges cannot mint elevation',async()=>configured(async()=>{
 const bad=harness();assert.equal((await bad.post({action:'password',password:'password'},'http://evil.test')).status,403);assert.equal(bad.attempts(),0);
 bad.set({passwordOk:false});assert.equal((await bad.post({action:'password',password:'password'})).status,403);assert.equal(bad.elevations.length,0);
 for(const mode of ['mfa','actor','expired']){const h=harness();await h.post({action:'password',password:'password'});if(mode==='mfa')h.set({mfaOk:false});if(mode==='actor')h.set({verifiedActor:'other'});if(mode==='expired')h.challenges[0].expiresAt=new Date(0);assert.equal((await h.post({action:'verify',code:'123456'})).status,403);assert.equal(h.elevations.length,0);}
 const h=harness();await h.elevate();assert.equal((await h.post({action:'verify',code:'123456'})).status,403);assert.equal(h.elevations.length,1);
}));
test('password attempts and committed MFA failures are limited, and logout revokes elevation and unfinished challenges',async()=>configured(async()=>{
 const h=harness();h.set({passwordOk:false});for(let i=0;i<6;i++)await h.post({action:'password',password:'bad'});assert.equal(h.attempts(),5);
 const otp=harness();await otp.post({action:'password',password:'password'});otp.set({mfaOk:false});for(let i=0;i<6;i++)await otp.post({action:'verify',code:'123456'});assert.equal(otp.challenges[0].attempts,5);
 const active=harness();await active.elevate();assert.equal((await active.logout()).status,200);assert.ok(active.elevations[0].revokedAt);await assert.rejects(active.guard.requirePlatformAdmin());
 const pending=harness();await pending.post({action:'password',password:'password'});await pending.logout();assert.ok(pending.challenges[0].consumedAt);assert.equal(pending.challenges[0].encryptedCredentials,'');
}));
test('direct Admin routes and server actions use the elevated guard; impersonation cannot bypass it',async()=>configured(async()=>{
 const h=harness();h.jar.set('outclass-platform-view','a'.repeat(64));await assert.rejects(h.guard.requirePlatformAdmin(),/Exit impersonation/);await assert.rejects(h.guard.requirePlatformAdmin({allowViewAs:true}),/Fresh Admin/);
 for(const file of ['app/platform/page.tsx','app/platform/[section]/page.tsx','app/platform/events/page.tsx','app/platform/claims/page.tsx','app/platform/view-as/page.tsx'])assert.match(fs.readFileSync(file,'utf8'),/requirePlatformAdmin|getAdminOverview|platformViewSession/);
 for(const file of ['actions/platform-admin.ts','actions/admin-workspace.ts','actions/campus-events.ts'])assert.match(fs.readFileSync(file,'utf8'),/requirePlatformAdmin/);
}));

test('provider server failure is a safe internal error, never elevation or leaked exception',async()=>configured(async()=>{
 const h=harness();h.set({passwordOk:false,providerStatus:503});
 const response=await h.post({action:'password',password:'password'});
 assert.equal(response.status,500);
 const body=await response.json();assert.match(body.supportCode,/^ADMIN_UNKNOWN_SERVER_ERROR:/);
 assert.ok(!JSON.stringify(body).includes('bad password'));assert.equal(h.elevations.length,0);
}));

test('malformed client JSON and invalid input remain safe 403 denials',async()=>configured(async()=>{
 const h=harness();
 for(const response of [await h.rawPost('{'),await h.post({action:'unknown'}),await h.post({action:'verify',code:'not-an-MFA-code'})]){
  assert.equal(response.status,403);const body=await response.json();
  assert.match(body.supportCode,/^ADMIN_ELEVATION_REQUIRED:/);
  assert.equal(body.error,'Admin authentication failed.');
 }
 assert.equal(h.elevations.length,0);assert.equal(h.attempts(),0);
 assert.ok(h.diagnostics.every(log=>log.category==='access'));
}));
test('malformed decrypted server challenge JSON is operational 500 with matching safe diagnostic',async()=>configured(async()=>{
 const h=harness();await h.post({action:'password',password:'password'});
 // Produce an authentic encrypted envelope containing invalid server-side JSON;
 // exercise the real decryptChallenge parser rather than mocking its exception.
 const {createHash,createCipheriv,randomBytes}=require('node:crypto');
 const key=createHash('sha256').update('outclass-admin-challenge-v1\0'+process.env.SUPABASE_SECRET_KEY).digest();
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
 const bytes=Buffer.concat([cipher.update('{private-invalid-server-json','utf8'),cipher.final()]);
 h.challenges[0].encryptedCredentials=Buffer.concat([nonce,cipher.getAuthTag(),bytes]).toString('base64');
 const response=await h.post({action:'verify',code:'123456'}),body=await response.json();
 assert.equal(response.status,500);assert.match(body.supportCode,/^ADMIN_UNKNOWN_SERVER_ERROR:/);
 assert.ok(h.diagnostics.some(log=>log.supportCode===body.supportCode&&log.category==='operational'));
 assert.ok(!JSON.stringify([body,h.diagnostics]).includes('private-invalid-server-json'));
 assert.equal(h.elevations.length,0);assert.ok(!h.jar.has('outclass-admin-elevation'));
}));
test('unrelated internal SyntaxError is operational 500 rather than client/auth denial',async()=>configured(async()=>{
 const h=harness();h.set({internalSyntax:true});
 const response=await h.post({action:'password',password:'password'}),body=await response.json();
 assert.equal(response.status,500);assert.match(body.supportCode,/^ADMIN_UNKNOWN_SERVER_ERROR:/);
 assert.ok(h.diagnostics.some(log=>log.supportCode===body.supportCode&&log.category==='operational'));
 assert.ok(!JSON.stringify([body,h.diagnostics]).includes('private internal'));
 assert.equal(h.elevations.length,0);assert.equal(h.attempts(),0);
}));
for(const faults of [{logger:true},{uuid:true},{logger:true,uuid:true}])test(`elevation API survives diagnostic faults ${JSON.stringify(faults)}`,async()=>configured(async()=>{
 const h=harness(faults);h.set({passwordOk:false,providerStatus:503});
 const response=await h.post({action:'password',password:'password'}),body=await response.json();
 assert.equal(response.status,500);assert.match(body.supportCode,/^ADMIN_UNKNOWN_SERVER_ERROR:/);
 if(faults.uuid)assert.match(body.supportCode,/:fallback-\d+$/);
 assert.ok(!JSON.stringify(body).includes('private'));assert.equal(h.elevations.length,0);
 h.set({providerStatus:400});assert.equal((await h.post({action:'password',password:'password'})).status,403);
}));

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {createClient}=require('@supabase/supabase-js');
const {chromium,devices}=require('playwright');
const {Actor,readConfig,randomUUID,confirmationMessage,actionSourceMatches}=require('./helpers/onboarding-e2e.cjs');
const filename=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;

test('signup privacy on real Next, Auth, SMTP and desktop/mobile browsers',{skip:!filename,timeout:90000},async t=>{
 const c=readConfig(filename),db=new PrismaClient({datasourceUrl:c.status.DB_URL});t.after(()=>db.$disconnect());
 const service=createClient(c.status.API_URL,c.status.SECRET_KEY,{auth:{persistSession:false}});
 const existingEmail=`privacy.existing.${randomUUID()}@virginia.edu`,originalPassword='Original-fixture!'+randomUUID(),attemptedPassword='Untrusted-attempt!'+randomUUID();
 const seeded=await service.auth.admin.createUser({email:existingEmail,password:originalPassword,email_confirm:true,user_metadata:{first_name:'Original',last_name:'Student'}});assert.equal(seeded.error,null);
 const existingId=seeded.data.user.id;
 await db.user.upsert({where:{id:existingId},create:{id:existingId,email:existingEmail},update:{}});
 const before=(await service.auth.admin.getUserById(existingId)).data.user;
 const register=(actor,email)=>actor.action('actions/onboarding.ts','registerStudent',[{firstName:'Attempted',lastName:'Replacement',email,password:attemptedPassword}]);
 const newcomer=new Actor(c),returning=new Actor(c),newEmail=`privacy.new.${randomUUID()}@virginia.edu`;

 await t.test('new and confirmed-existing addresses return exactly the same unauthenticated action result',async()=>{
  assert.deepEqual(await register(newcomer,newEmail),{authenticated:false});
  assert.deepEqual(await register(returning,existingEmail),{authenticated:false});
  for(const actor of [newcomer,returning]){
   assert.equal((await actor.client.auth.getSession()).data.session,null);
   assert.equal((await actor.request('/api/users/me')).status,401);
  }
  const message=await confirmationMessage(c,newEmail),code=message.Text.match(/\b(\d{6})\b/)?.[1];assert.ok(code,'New account retains real confirmation delivery');
  assert.ok((await newcomer.client.auth.signInWithPassword({email:newEmail,password:attemptedPassword})).error,'New account cannot sign in before confirmation');
  const verified=await newcomer.client.auth.verifyOtp({email:newEmail,token:code,type:'email'});assert.equal(verified.error,null);assert.ok(verified.data.session);assert.ok(verified.data.user.email_confirmed_at);
 });
 await t.test('repeat signup creates no duplicate, replaces no verified identity/profile and does not change its password',async()=>{
  const counts=await Promise.all([db.user.count({where:{email:existingEmail}}),db.clubMember.count({where:{userId:existingId}})]);
  assert.deepEqual(await register(new Actor(c),existingEmail),{authenticated:false});
  const after=(await service.auth.admin.getUserById(existingId)).data.user;
  assert.equal(after.id,before.id);assert.equal(after.email_confirmed_at,before.email_confirmed_at);
  assert.equal(after.user_metadata.first_name,before.user_metadata.first_name);assert.equal(after.user_metadata.last_name,before.user_metadata.last_name);
  assert.deepEqual(after.identities.map(i=>i.id).sort(),before.identities.map(i=>i.id).sort());
  assert.deepEqual(await Promise.all([db.user.count({where:{email:existingEmail}}),db.clubMember.count({where:{userId:existingId}})]),counts);
  assert.ok((await new Actor(c).client.auth.signInWithPassword({email:existingEmail,password:attemptedPassword})).error,'A signup attempt cannot replace the password');
  const signedIn=new Actor(c);assert.equal((await signedIn.signIn(existingEmail,originalPassword)).id,existingId);
 });
 await t.test('desktop and mobile keep identical verification UI, no session, email correction and sign-in return path',async()=>{
  const browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  const manifest=JSON.parse(fs.readFileSync(path.join(c.buildDir,'server/server-reference-manifest.json')));
  const registrationId=Object.entries(manifest.node).find(([,value])=>actionSourceMatches(value.filename,'actions/onboarding.ts')&&value.exportedName==='registerStudent')?.[0];assert.ok(registrationId);
  const errors=[];let newScreen;
  try{
   for(const mobile of [false,true])for(const exists of [false,true]){
    const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1365,height:1000}});
    try{
     const page=await context.newPage();page.on('pageerror',e=>errors.push({url:page.url(),message:e.message}));
     const email=exists?existingEmail:`privacy.browser.${randomUUID()}@virginia.edu`;
     await page.goto(c.appUrl+'/signup?next=%2Finvitations%2Fprivacy-fixture');
     await page.getByRole('heading',{name:'Create your account',exact:true}).waitFor();
     await page.getByLabel('First name',{exact:true}).fill('Synthetic');await page.getByLabel('Last name',{exact:true}).fill('Student');
     await page.getByLabel('UVA email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(attemptedPassword);
     const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.request().headers()['next-action']===registrationId);
     await page.getByRole('button',{name:'Continue',exact:true}).click();
     // Exact action results are asserted above through the real HTTP helper.
     // Here verify the actual browser transition without depending on CDP's
     // retention of response bodies across Next's router updates.
     const result=await response;assert.equal(result.status(),200);
     await page.getByRole('heading',{name:'Verify your email',exact:true}).waitFor();
     const main=page.getByRole('main',{name:'Create your OutClass account'});
     assert.equal(await main.getByRole('alert').count(),0);
     const copy=await page.getByText('If this address can be registered,',{exact:false}).innerText();
     assert.match(copy,/Already registered\? Sign in below\./);
     const normalized=copy.replace(email,'[email]');if(newScreen===undefined)newScreen=normalized;else assert.equal(normalized,newScreen);
     assert.equal((await context.request.get(c.appUrl+'/api/users/me')).status(),401);
     assert.ok(await page.getByRole('button',{name:/^Resend in/}).isDisabled());
     assert.ok(await page.getByRole('button',{name:'Verify email',exact:true}).isDisabled());
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
     await page.screenshot({path:path.join(path.dirname(filename),`signup-privacy-${mobile?'mobile':'desktop'}-${exists?'existing':'new'}.png`),fullPage:true});
     await page.getByRole('button',{name:'Use a different email',exact:true}).click();
     await page.getByRole('heading',{name:'Create your account',exact:true}).waitFor();
     assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');
     await page.getByRole('button',{name:'Sign in',exact:true}).click();
     await page.waitForURL(c.appUrl+'/login?next=%2Finvitations%2Fprivacy-fixture');
    }finally{await context.close()}
   }
  }finally{await browser.close()}
  assert.deepEqual(errors,[],'Keep all browser runtime errors visible');
 });
});

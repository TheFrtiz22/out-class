// Run through pnpm test:a11y:authenticated. Configuration is accepted only by
// the existing reserved localhost onboarding guard, never an arbitrary URL.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {expect}=require('playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {PrismaClient}=require('@prisma/client');
const {Actor,readConfig,randomUUID,totp}=require('../helpers/onboarding-e2e.cjs');
const filename=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('authenticated accessibility against isolated real Auth, MFA, Next actions and PostgreSQL',{skip:!filename,timeout:360000},async t=>{
  const config=readConfig(filename),db=new PrismaClient({datasourceUrl:config.status.DB_URL});
  const browser=await chromium.launch();
  const out=path.resolve('test-results/accessibility-authenticated');fs.mkdirSync(out,{recursive:true});
  for(const name of fs.readdirSync(out).filter(name=>name.endsWith('.json')))fs.rmSync(path.join(out,name));
  t.after(async()=>{await browser.close();await db.$disconnect()});
  const suffix=randomUUID().replaceAll('-','').slice(0,8),student=new Actor(config),leader=new Actor(config),admin=new Actor(config);
  await student.signUp('Accessibility Student',`astudent${suffix}`,2028);await student.profile('Accessibility Student',2028);
  await leader.signUp('Accessibility Leader',`aleader${suffix}`,2028);await leader.profile('Accessibility Leader',2028);
  await admin.signIn(config.admin.email,config.admin.password);
  const elevate=body=>admin.request('/api/platform/elevation',{method:'POST',headers:{origin:config.appUrl,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await elevate({action:'password',password:config.admin.password})).status,200);
  assert.equal((await elevate({action:'verify',code:totp(config.admin.totpSecret)})).status,200);
  const club=await db.club.create({data:{slug:`accessibility-${suffix}`,name:`Accessibility Audit ${suffix}`,tagline:'Fictional isolated accessibility fixture',description:'A club created only inside the disposable accessibility test database.',color:'#142d4e',category:'Academic',claimedAt:new Date()}});
  await db.clubMember.create({data:{clubId:club.id,userId:leader.user.id,isOwner:true,accessRole:'OWNER'}});
  await db.pipelineRound.create({data:{clubId:club.id,name:'Application Review',type:'APPLICATION_REVIEW',order:0}});
  const question=await db.applicationQuestion.create({data:{clubId:club.id,prompt:'Why would you like to join this club?',type:'ESSAY',required:true,wordLimit:100,order:0}});
  const draft=await student.action('actions/applications.ts','saveApplicationDraft',[{clubId:club.id,answers:[]}]);assert.ok(draft.applicationId);
  for(const actor of [student,leader])await actor.action('actions/tutorials.ts','saveTutorial',[{experience:'student',action:'skip',step:0}]);
  await leader.action('actions/tutorials.ts','saveTutorial',[{experience:'leader',clubId:club.id,action:'skip',step:0}]);
  async function session(actor){
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
    await context.addCookies([...actor.cookies].map(([name,value])=>({name,value,url:config.appUrl})));
    const page=await context.newPage();page.setDefaultTimeout(20000);
    const identity=await context.request.get(config.appUrl+'/api/users/me');assert.equal(identity.status(),200,'Real session must be authorized');assert.equal((await identity.json()).id,actor.user.id);
    return page;
  }
  const studentPage=await session(student),leaderPage=await session(leader),adminPage=await session(admin);
  async function open(page,route){
    await page.setViewportSize({width:1280,height:900});
    const response=await page.goto(config.appUrl+route,{waitUntil:'networkidle'});assert.ok(response.status()<400,route);
    await expect(page.locator('[data-product-shell]')).toHaveCount(1);await expect(page.locator('main')).toHaveCount(1);
    assert.ok(!new URL(page.url()).pathname.endsWith('/login'),'A login screen is not protected-page coverage');
    assert.equal(new URL(page.url()).pathname,new URL(route,config.appUrl).pathname,'Expected protected destination, not a fallback');
    await page.evaluate(()=>document.fonts.ready);
  }
  async function scan(page,name){
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{}))));
    if(['student-home','leader-overview','admin-users'].includes(name))await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
    const r=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({name,authenticated:true,viewport:page.viewportSize(),browser:browser.version(),violations:r.violations,incomplete:r.incomplete},null,2));
    assert.deepEqual(r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[],name);
  }
  for(const [name,page,route]of [
    ['student-home',studentPage,'/?workspace=student'],
    ['student-profile',studentPage,'/settings/profile'],
    ['student-discovery',studentPage,'/?workspace=student&view=explore'],
    ['student-saved',studentPage,'/saved-clubs'],
    ['student-availability',studentPage,'/settings/availability'],
    ['student-notifications',studentPage,'/?workspace=student&view=inbox'],
    ['leader-overview',leaderPage,`/club/${club.id}/workspace`],
    ['leader-members',leaderPage,`/club/${club.id}/workspace?section=members`],
    ['leader-applicants',leaderPage,`/club/${club.id}/workspace?section=recruitment&tool=applicants`],
    ['leader-interviews',leaderPage,`/club/${club.id}/workspace?section=recruitment&tool=interviews`],
    ['leader-settings',leaderPage,`/club/${club.id}/workspace?section=settings`],
    ['admin-overview',adminPage,'/platform'],['admin-users',adminPage,'/platform/users'],['admin-school-requests',adminPage,'/platform/school-requests'],['admin-claims',adminPage,'/platform/claims'],['admin-events',adminPage,'/platform/events'],
  ])await t.test(name,async()=>{await open(page,route);await scan(page,name);await page.setViewportSize({width:320,height:800});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1,{},{timeout:3000});await scan(page,name+'-320');await page.setViewportSize({width:1280,height:900});});
  await t.test('student submits actual application and server persistence is verified',async()=>{
    await open(studentPage,`/?workspace=student&view=tracker&applicationId=${draft.applicationId}`);
    const essay=studentPage.getByLabel(question.prompt,{exact:true});await essay.waitFor();
    await studentPage.getByRole('button',{name:'Review & submit'}).click();await expect(essay).toHaveAttribute('aria-invalid','true');await scan(studentPage,'real-application-errors');
    await essay.fill('I would like to contribute to this fictional test club.');await studentPage.getByRole('button',{name:'Review & submit'}).click();await studentPage.getByRole('dialog').waitFor();await scan(studentPage,'real-application-review');
    await studentPage.getByRole('button',{name:'Submit application',exact:true}).click();await expect(studentPage.getByText('Your responses are saved and read-only after submission.')).toBeVisible();
    assert.equal((await db.application.findUniqueOrThrow({where:{id:draft.applicationId}})).status,'SUBMITTED');await scan(studentPage,'real-application-submitted');
  });
});

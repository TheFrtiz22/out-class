// Real student UI/Auth/database validation against the dedicated LOCAL Profile project only.
// Prepare/build/start with scripts/prepare-profile-e2e.cjs and scripts/run-profile-local.cjs.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.OUTCLASS_PLAYWRIGHT_MODULE || 'playwright');
const {createServerClient}=require('@supabase/ssr');const {PrismaClient}=require('@prisma/client');
const c=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'outclass-profile-p2-e2e/config.json')));
if(c.projectId!=='outclass-profile-p2-e2e')throw Error('Dedicated local project required');
for(const [value,port] of [[c.status.DB_URL,'58322'],[c.status.API_URL,'58321']]) { const url=new URL(value);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!==port)throw Error('Dedicated local services required'); }
const db=new PrismaClient({datasourceUrl:c.status.DB_URL});let browser;
const output=path.join(os.tmpdir(),'outclass-student-journey');fs.mkdirSync(output,{recursive:true});
async function createFixtures(identity) {
await db.club.updateMany({where:{slug:{startsWith:'journey-'}},data:{isDiscoverable:false}});const stamp=Date.now(),fixtures=[];for(const surface of ['desktop','mobile']){
 const club=await db.club.create({data:{name:`Journey ${surface} Society`,slug:`journey-${surface}-${stamp}`,description:'A fictional local research society for testing the complete student recruiting journey.',tagline:'Research, discussion, and practical projects.',category:'Academic',color:'#142d4e',claimedAt:new Date(),testRequirement:'OPTIONAL',applicationOpen:true,applicationDeadline:new Date(Date.now()+4*86400000),pipelineRounds:{create:[{name:'Application review',order:0,type:'APPLICATION_REVIEW'},{name:'Research conversation',order:1,type:'INTERVIEW'},{name:'Decision',order:2,type:'FINAL_DECISION'}]},questions:{create:[{prompt:'Why are you interested in this society?',type:'ESSAY',required:true,wordLimit:30,order:0},{prompt:'Which activity interests you?',type:'MULTIPLE_CHOICE',required:true,options:['Research','Discussion'],order:1}]}},include:{pipelineRounds:{orderBy:{order:'asc'}},questions:true}});
 const member=await db.clubMember.create({data:{clubId:club.id,userId:c.identities.leader.id,isOwner:true,interviewOffices:['PRESIDENT'],permissions:['interviews.manage']}});
 const start=new Date(Date.now()+3*86400000);start.setUTCHours(surface==='desktop'?16:20,0,0,0);
 const room=await db.interviewRoom.create({data:{clubId:club.id,roundId:club.pipelineRounds[1].id,name:'Research panel',location:'Newcomb Hall · local fixture',kind:'IN_PERSON',timezone:'America/New_York',duration:20,buffer:5,panelMemberIds:[member.id],approvedPanelMemberIds:[member.id],panelApprovedBy:c.identities.leader.id,panelApprovalRevision:1,slots:{create:[0,1].map(i=>({clubId:club.id,startTime:new Date(+start+i*3600000),endTime:new Date(+start+i*3600000+20*60000),location:'Newcomb Hall · local fixture',capacity:1}))}}});
 fixtures.push({surface,clubId:club.id,name:club.name,reviewRound:club.pipelineRounds[0].id,interviewRound:club.pipelineRounds[1].id,roomId:room.id});
}
await db.club.create({data:{name:`Journey Closed Club ${stamp}`,slug:`journey-closed-${stamp}`,category:'Academic',color:'#142d4e',tagline:'Closed local recruitment fixture',description:'Local fixture with a passed recruitment deadline.',claimedAt:new Date(),applicationOpen:true,applicationDeadline:new Date(Date.now()-86400000),pipelineRounds:{create:{name:'Application review',order:0}}}});

await db.userTutorial.upsert({where:{userId_experience:{userId:identity.id,experience:'student'}},create:{userId:identity.id,experience:'student',status:'SKIPPED',step:0,version:1},update:{status:'SKIPPED'}});
return fixtures;
}
async function createStudent() {
 const {createClient}=require('@supabase/supabase-js'),{randomUUID}=require('node:crypto');
 const admin=createClient(c.status.API_URL,c.status.SECRET_KEY||c.status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const key=randomUUID().replaceAll('-','').slice(0,12),email=`journey-${key}@virginia.edu`,password=`Local-${randomUUID()}!`;
 const result=await admin.auth.admin.createUser({email,password,email_confirm:true});if(result.error)throw result.error;
 const id=result.data.user.id;
 await db.user.upsert({where:{id},create:{id,email},update:{}});
 await db.studentProfile.create({data:{userId:id,firstName:'Student',lastName:'Journey',computingId:key,major:'Economics',gradYear:new Date().getFullYear()+2}});
 return {id,email,password};
}
(async()=>{const identity=await createStudent();const fixtures=await createFixtures(identity);
fs.writeFileSync(path.join(output,'session.json'),JSON.stringify({identity,fixtures}),{mode:0o600});
browser=await chromium.launch({executablePath:process.env.OUTCLASS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const results=[];
for(const fixture of fixtures){
 let cookies=[];const auth=createServerClient(c.status.API_URL,c.status.PUBLISHABLE_KEY,{cookies:{getAll:()=>cookies,setAll:v=>cookies=v}});const login=await auth.auth.signInWithPassword(identity);if(login.error)throw login.error;
 const context=await browser.newContext({viewport:fixture.surface==='desktop'?{width:1440,height:900}:{width:390,height:844}});await context.addCookies(cookies.map(v=>({name:v.name,value:v.value,domain:'127.0.0.1',path:'/'})));const page=await context.newPage();page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 const shot=async stage=>{await page.screenshot({path:path.join(output,`${fixture.surface}-${stage}.png`)});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),page.viewportSize().width,'no horizontal overflow at '+stage)};
 console.log('Opening',fixture.surface);await page.goto('http://127.0.0.1:3110/?workspace=student&view=explore',{waitUntil:'domcontentloaded',timeout:90000});console.log('Loaded initial document');
 // Let hydration and directory loading finish before refreshing stale metadata.
 for(let attempt=0;attempt<6;attempt++){
   try { await page.locator(`[data-club-id="${fixture.clubId}"]`).first().waitFor({timeout:20000});break }
   catch(error){if(attempt===5){await page.screenshot({path:path.join(output,'directory-failure.png')});throw error}await page.reload({waitUntil:'domcontentloaded'})}
 }

 await shot('discover');
 await page.getByRole('textbox',{name:'Search clubs'}).fill('Journey');await page.getByRole('group',{name:'Recruitment availability'}).getByRole('button',{name:'Applications open'}).click();assert.equal(await page.getByRole('button',{name:/Journey Closed Club/}).count(),0);
 await page.getByRole('combobox',{name:/Sort/}).selectOption('deadline');await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.getByRole('textbox',{name:'Search clubs'}).inputValue(),'Journey');await page.locator(`[data-club-id="${fixture.clubId}"]`).first().click();await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor();await shot('profile');
 await page.getByRole('button',{name:'Back to Discover',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Search clubs'}).inputValue(),'Journey');await page.locator(`[data-club-id="${fixture.clubId}"]`).first().click();
 await page.getByRole('button',{name:'Start application',exact:true}).first().click();await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor();
 await page.getByRole('button',{name:'Review & submit',exact:true}).click();await page.getByRole('alert').first().waitFor();
 await page.getByLabel('Why are you interested in this society?',{exact:true}).fill('I want to research practical questions and learn from a thoughtful team.');await page.getByLabel('Which activity interests you?',{exact:true}).selectOption('Research');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Your draft is saved.',{exact:true}).waitFor();await shot('draft');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator(`[data-application-id]`).filter({hasText:'Continue draft'}).first().click();assert.match(await page.getByLabel('Why are you interested in this society?',{exact:true}).inputValue(),/practical questions/);
 await page.getByRole('button',{name:'Review & submit',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit application',exact:true}).click();await page.getByText('Your application was submitted successfully.',{exact:true}).waitFor();await shot('submitted');
 const app=await db.application.findUnique({where:{studentId_clubId:{studentId:identity.id,clubId:fixture.clubId}},include:{answers:true}});assert.equal(app.status,'SUBMITTED');assert.equal(app.answers.length,2);
 await page.getByRole('button',{name:'View status',exact:true}).click();await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor();await shot('status');
 // Fixture setup simulates a club issuing an invitation; booking itself uses actual UI/server/auth/database paths.
 await db.application.update({where:{id:app.id},data:{status:'INTERVIEWING',roundId:fixture.interviewRound}});await page.getByRole('button',{name:'Refresh status',exact:true}).click();await page.getByRole('heading',{name:'Your interview',exact:true}).waitFor();
 await page.locator('.ir-times button').first().click();await page.getByRole('button',{name:'Confirm interview',exact:true}).click();await page.getByText('Interview confirmed',{exact:true}).waitFor();await shot('interview');
 let booking=await db.interviewBooking.findFirst({where:{applicationId:app.id}});assert.ok(booking);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator(`[data-application-id="${app.id}"]`).first().click();await page.getByText('Interview confirmed',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancel booking',exact:true}).click();await page.getByRole('button',{name:'Keep booking',exact:true}).click();assert.ok(await db.interviewBooking.findFirst({where:{applicationId:app.id}}));
 await page.locator('.ir-times button').nth(1).click();await page.getByRole('button',{name:'Confirm new time',exact:true}).click();await page.locator('.ir-booking-action').waitFor({state:'hidden'});await page.getByText('Interview confirmed',{exact:true}).waitFor();const changed=await db.interviewBooking.findFirst({where:{applicationId:app.id}});assert.notEqual(changed.slotId,booking.slotId);
 await page.getByRole('button',{name:'Open calendar',exact:true}).click();await page.getByRole('heading',{name:'Calendar',exact:true}).waitFor();await shot('calendar');
 assert.deepEqual(errors,[]);results.push({surface:fixture.surface,complete:true,errors,applicationId:app.id});await context.close();console.log(`PASS: ${fixture.surface} search → profile → validated draft/save/reload → submit → Status → real interview booking/reschedule → calendar`);
}
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));await browser.close();await db.$disconnect();})().catch(async e=>{console.error(e);if(browser)await browser.close();await db.$disconnect();process.exit(1)});

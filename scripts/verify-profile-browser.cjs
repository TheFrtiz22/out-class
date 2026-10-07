// Optional external browser tooling; all application/Auth/Storage calls are real.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createServerClient}=require('@supabase/ssr');
const {chromium}=require(process.env.OUTCLASS_PLAYWRIGHT_MODULE||'playwright');
const c=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'outclass-profile-p2-e2e/config.json')));
if(c.projectId!=='outclass-profile-p2-e2e'||new URL(c.status.API_URL).port!=='58321')throw Error('Disposable project required');
const base='http://127.0.0.1:3110';
async function authenticated(browser,identity,viewport={width:1440,height:1000}) {
 let cookies=[];const client=createServerClient(c.status.API_URL,c.status.PUBLISHABLE_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{cookies=values}}});
 const login=await client.auth.signInWithPassword(identity);if(login.error)throw login.error;
 const context=await browser.newContext({viewport});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'127.0.0.1',path:'/'})));return context;
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.OUTCLASS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 const context=await authenticated(browser,c.identities.student),page=await context.newPage();page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async()=>{await page.goto(base+'/?workspace=student&view=student-profile');await page.getByRole('button',{name:'Edit education',exact:true}).waitFor({timeout:60000});if(await page.getByRole('button',{name:'Skip',exact:true}).isVisible())await page.getByRole('button',{name:'Skip',exact:true}).click()};
 await open();assert.ok((await page.locator('body').innerText()).includes('4.6 · Confirm'));
 await page.getByRole('button',{name:'Edit name and photo',exact:true}).click();await page.getByLabel('First name',{exact:true}).fill('Legacy');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await open();assert.ok((await page.locator('body').innerText()).includes('4.6 · Confirm'));
 await page.getByRole('button',{name:'Edit name and photo',exact:true}).click();await page.getByLabel('First name',{exact:true}).fill('Student');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Edit education',exact:true}).click();await page.getByLabel('High school (optional)',{exact:true}).fill('Historical field edit');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await open();assert.ok((await page.locator('body').innerText()).includes('4.6 · Confirm'));
 await page.getByRole('button',{name:'Edit links',exact:true}).click();await page.getByLabel('LinkedIn URL',{exact:true}).fill('https://linkedin.com/in/legacy');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await open();assert.ok((await page.locator('body').innerText()).includes('4.6 · Confirm'));
 await page.getByRole('button',{name:'Edit name and photo',exact:true}).click();await page.locator('#profile-headshot').setInputFiles('public/images/landing/jordan-avery.jpg');
 await page.getByRole('button',{name:'Use cropped photo',exact:true}).waitFor();await page.getByRole('slider',{name:'Zoom',exact:true}).focus();for(let i=0;i<20;i++)await page.keyboard.press('ArrowRight');await page.getByRole('slider',{name:'Horizontal position',exact:true}).focus();await page.keyboard.press('End');await page.getByRole('slider',{name:'Vertical position',exact:true}).focus();await page.keyboard.press('Home');
 const canvas=page.getByRole('img',{name:'Final profile photo preview',exact:true});const cropped=await canvas.evaluate(el=>el.toDataURL());assert.ok(cropped.length>1000);
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['tablet',{width:768,height:1024}],['mobile',{width:390,height:844}]]){await page.setViewportSize(viewport);await page.waitForFunction(({width,height}) => { const el=document.querySelector("[role=dialog]"); if(!el)return false; const b=el.getBoundingClientRect();return window.innerWidth===width && b.x>=0 && b.right<=width+1 && b.y>=0 && b.bottom<=height+1 },viewport);const b=await page.getByRole('dialog').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=viewport.width+1&&b.y>=0&&b.y+b.height<=viewport.height+1,name+' dialog bounded '+JSON.stringify(b));await page.screenshot({path:path.join(os.tmpdir(),'profile-crop-'+name+'.png')});}
 await page.getByRole('button',{name:'Use cropped photo',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.setViewportSize({width:1440,height:1000});await open();const account=page.getByRole('img',{name:'Your profile photo',exact:true});await account.waitFor();const original=await account.getAttribute('src');assert.ok(original.includes('/api/profile-photos?path='+c.identities.student.id+'%2F'));assert.equal(await account.evaluate(el=>el.complete&&el.naturalWidth===512),true);
 await page.getByRole('button',{name:'Edit name and photo',exact:true}).click();await page.getByRole('button',{name:'Re-edit photo',exact:true}).click();await page.getByRole('button',{name:'Use cropped photo',exact:true}).waitFor();await page.getByRole('slider',{name:'Zoom',exact:true}).focus();await page.keyboard.press('End');await page.getByRole('button',{name:'Use cropped photo',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await open();assert.notEqual(await account.getAttribute('src'),original);
 await open();assert.ok((await page.locator('body').innerText()).includes('4.6 · Confirm'));
 await page.getByRole('button',{name:'Edit education',exact:true}).click();
 await page.getByLabel('High school (optional)',{exact:true}).fill('Example High School');await page.getByLabel('Gender',{exact:true}).selectOption('Female');await page.getByLabel('Pronouns',{exact:true}).selectOption('She/Her');await page.getByLabel('GPA out of 4.0 (optional)',{exact:true}).fill('3.875');await page.getByLabel('Transfer student',{exact:true}).check();await page.getByLabel('Are you a scholar?',{exact:true}).selectOption('yes');await page.getByLabel('Echols Scholars Program',{exact:true}).check();await page.getByLabel('CORE Scholars Program',{exact:true}).check();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await open();assert.ok((await page.locator('body').innerText()).includes('Example High School'));assert.ok((await page.locator('body').innerText()).includes('She/Her'));assert.ok((await page.locator('body').innerText()).includes('3.875 / 4.00'));assert.ok((await page.locator('body').innerText()).includes('CORE Scholars Program'));
 await page.getByRole('button',{name:'Edit name and photo',exact:true}).click();await page.locator('#profile-headshot').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await page.getByRole('alert').filter({hasText:'could not be opened'}).waitFor();await page.getByRole('button',{name:'Cancel crop',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.screenshot({path:path.join(os.tmpdir(),'profile-saved-desktop.png')});
 const photoPath=new URL(original,base).searchParams.get('path');assert.equal((await page.request.get(new URL(original,base).href)).status(),200);
 const outside=await authenticated(browser,c.identities.outsider);assert.equal((await outside.request.get(new URL(original,base).href)).status(),403);await outside.close();
 const guest=await browser.newContext();assert.equal((await guest.request.get(new URL(original,base).href)).status(),401);assert.notEqual((await guest.request.get(c.status.API_URL+'/storage/v1/object/public/headshots/'+photoPath)).status(),200);await guest.close();
 const forbidden=await page.request.get(base+'/api/workspace?kind=pipeline&args='+encodeURIComponent(JSON.stringify([c.clubId,{roundId:c.profileRoundId,gender:'Female'}])));assert.equal(forbidden.status(),403);
 const leaders=await authenticated(browser,c.identities.leader),leader=await leaders.newPage();leader.setDefaultTimeout(30000);
 await leader.goto(base+`/club/${c.clubId}/workspace`);await leader.getByRole('button',{name:'Skip',exact:true}).click({timeout:1500}).catch(()=>{});
 const apiUrl=filter=>base+'/api/workspace?kind=pipeline&args='+encodeURIComponent(JSON.stringify([c.clubId,filter]));
 const wire=await leader.request.get(apiUrl({roundId:c.profileRoundId,gender:'Female',genderCounts:true}));assert.equal(wire.status(),200);const result=await wire.json();assert.ok(!JSON.stringify(result).includes('gradYear'));assert.ok(!JSON.stringify(result).includes('highSchool'));assert.ok(!JSON.stringify(result).includes('pronouns'));assert.ok(JSON.stringify(result).includes('Third Year*'));assert.ok(JSON.stringify(result).includes('Female'));
 const anonymous=await leader.request.get(apiUrl({roundId:c.anonymousRoundId}));assert.equal(anonymous.status(),200);const anon=await anonymous.json();assert.ok(!JSON.stringify(anon).includes('gradYear'));assert.ok(!JSON.stringify(anon).includes('outsider@'));assert.ok(!JSON.stringify(anon).includes('Male'));assert.ok(!JSON.stringify(anon).includes('He/Him'));assert.ok(!JSON.stringify(anon).includes('Anonymous private high school'));
 const denied=await leader.request.get(apiUrl({roundId:c.anonymousRoundId,gender:'Female'}));assert.equal(denied.status(),403);
 await leader.goto(base+`/club/${c.clubId}/workspace?section=recruitment&tool=applicants`);
 await leader.getByLabel('Filter round',{exact:true}).waitFor({state:'attached',timeout:60000});
 const skip=leader.getByRole('button',{name:'Skip',exact:true});if(await skip.isVisible()){await skip.click();await skip.waitFor({state:'hidden'});}
 await leader.locator('.oc-pipeline-filters > summary').click();
 await leader.getByLabel('Filter round',{exact:true}).selectOption(c.profileRoundId);
 await leader.getByLabel('Filter gender',{exact:true}).waitFor();await leader.getByLabel('Filter gender',{exact:true}).selectOption('Female');await leader.getByLabel('Show round gender composition',{exact:true}).check();
 await leader.waitForFunction(()=>/Female:\s*1/.test(document.body.innerText));
 await leader.getByText('Student Fixture',{exact:true}).first().click();await leader.waitForFunction(()=>document.body.innerText.includes('Third Year*'));
 const authorizedPhoto=result.data.applications[0].student.studentProfile.headshotUrl;assert.equal((await leader.request.get(new URL(authorizedPhoto,base).href)).status(),200);
 const leaderText=await leader.locator('body').innerText();assert.ok(!leaderText.includes('Class of 2028'));assert.ok(!leaderText.includes('Graduation year'));await leader.screenshot({path:path.join(os.tmpdir(),'profile-leader.png')});
 await leader.keyboard.press('Escape');await leader.getByLabel('Filter round',{exact:true}).selectOption(c.anonymousRoundId);
 await leader.getByLabel('Filter gender',{exact:true}).waitFor({state:'hidden'});
 await leader.waitForFunction(()=>document.body.innerText.includes('Applicant ')&&!document.body.innerText.includes('Student Fixture'));
 const anonymousText=await leader.locator('body').innerText();for(const privateText of ['Male','He/Him','Anonymous private high school','Class of 2028','Outsider Fixture'])assert.ok(!anonymousText.includes(privateText));
 await leader.screenshot({path:path.join(os.tmpdir(),'profile-anonymous.png')});
 console.log('PASS: leader UI academic year/transfer marker, gender filter, optional round composition, and anonymous UI with real private demographic data withheld.');
 console.log('PASS: real browser profile fields, crop/zoom/reposition, upload/save/reload, replacement/re-edit, invalid image, account photo, three responsive sizes; real authorized pipeline privacy/filter/counts and anonymous/unauthorized denial.');
 assert.deepEqual(errors,[]);await context.close();await leaders.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});

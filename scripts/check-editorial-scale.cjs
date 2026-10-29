// Actual local PostgreSQL + authenticated production route; never loads application env.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client'),{chromium}=require('playwright'),{expect}=require('playwright/test');
const {readConfig,Actor,randomUUID}=require('../tests/helpers/onboarding-e2e.cjs');
const root=path.join(os.tmpdir(),'outclass-dashboards-e2e'),c=readConfig(path.join(root,'config.json')),file=path.join(root,'visual-fixture.json'),f=JSON.parse(fs.readFileSync(file));
const out=path.resolve('docs/editorial-campus-os/evidence/scale');fs.mkdirSync(out,{recursive:true});
(async()=>{const db=new PrismaClient({datasourceUrl:c.status.DB_URL}),browser=await chromium.launch();try{
 const actor=new Actor(c);await actor.signIn(f.actors.owner.credentials.email,f.actors.owner.credentials.password);
 if(!f.editorialScaleClubId){
 const club=await db.club.create({data:{slug:'editorial-scale-'+randomUUID().slice(0,8),name:'Campus Creative Collective',category:'Arts',color:'#142D45',tagline:'Synthetic scale verification',description:'Local test fixture only.',claimedAt:new Date(),applicationOpen:true}});
 await db.clubMember.create({data:{clubId:club.id,userId:actor.user.id,isOwner:true,accessRole:'OWNER'}});
 const names=['Initial reading','Project proposals','Collaborative practice','Final written review','Panel conversations','Offers in preparation'];
 const rounds=[];for(let i=0;i<names.length;i++)rounds.push(await db.pipelineRound.create({data:{clubId:club.id,name:names[i],type:i===4?'INTERVIEW':'APPLICATION_REVIEW',anonymousReview:true,order:i}}));
 const users=Array.from({length:1200},(_,i)=>({id:randomUUID(),email:`editorial-scale-${club.id}-${i}@virginia.edu`}));
 await db.user.createMany({data:users});await db.application.createMany({data:users.map((u,i)=>({clubId:club.id,studentId:u.id,roundId:rounds[i%6].id,status:i%6===4?'INTERVIEWING':'SUBMITTED',submittedAt:new Date(Date.now()-i*60000)}))});
 await actor.action('actions/tutorials.ts','saveTutorial',[{experience:'leader',clubId:club.id,action:'skip',step:0}]);
 f.editorialScaleClubId=club.id;fs.writeFileSync(file,JSON.stringify(f),{mode:0o600});
 }
 const start=performance.now(),res=await actor.request('/api/workspace?'+new URLSearchParams({kind:'overview',args:JSON.stringify([f.editorialScaleClubId])}));assert.ok(res.ok);const wire=await res.json(),data=wire.data.operations;
 const result={applications:data.rounds.reduce((n,r)=>n+r.count,0),rounds:data.rounds.length,queue:data.queue.length,bytes:Buffer.byteLength(JSON.stringify(wire)),localReadMs:Math.round(performance.now()-start),screens:[]};
 assert.equal(result.applications,1200);assert.equal(result.rounds,6);assert.equal(result.queue,12);assert.ok(result.bytes<100000);
 const context=await browser.newContext({reducedMotion:'reduce'});await context.addCookies([...actor.cookies].map(([name,value])=>({name,value,url:c.appUrl})));const page=await context.newPage();
 for(const [width,height] of [[1440,900],[390,844],[320,844]]){
 await page.setViewportSize({width,height});await page.goto(c.appUrl+`/club/${f.editorialScaleClubId}/workspace?section=recruitment&tool=overview`,{waitUntil:'networkidle'});await expect(page.locator('.oc-command-pipeline button')).toHaveCount(7);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`recruitment-${width}.png`),fullPage:true});result.screens.push({width,overflow:false});
 }
 const rounds=page.getByRole('group',{name:'Filter review queue by round'}).getByRole('button');await rounds.last().focus();await page.keyboard.press('Enter');await expect(rounds.last()).toHaveAttribute('aria-pressed','true');await expect(page.locator('.oc-review-records')).toContainText('Offers in preparation');result.keyboardRoundFilter=true;
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});

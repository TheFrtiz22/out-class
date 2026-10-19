// Reuses ONLY the reserved disposable onboarding fixture after its runner passes.
// Executes real Auth -> Next HTTP -> Prisma -> PostgreSQL. Never loads repo .env.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{createClient}=require('@supabase/supabase-js'),{createServerClient}=require('@supabase/ssr');
const repo=path.resolve(__dirname,'../..'),root=path.join(os.tmpdir(),'outclass-onboarding-e2e');
const {readConfig}=require('../../tests/helpers/onboarding-e2e.cjs');
const config=readConfig(path.join(root,'config.json'));
assert.equal(config.projectId,'outclass-onboarding-e2e');
const supabase=path.join(repo,'node_modules/supabase/dist/supabase.js');
let app,db;
const run=args=>{const r=spawnSync(process.execPath,[supabase,...args],{cwd:repo,encoding:'utf8'});if(r.status!==0)throw Error('Disposable Supabase command failed; output intentionally withheld.');};
const env={...process.env,DATABASE_URL:config.status.DB_URL,POSTGRES_PRISMA_URL:config.status.DB_URL,POSTGRES_URL:config.status.DB_URL,POSTGRES_URL_NON_POOLING:config.status.DB_URL,NEXT_PUBLIC_SUPABASE_URL:config.status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.status.PUBLISHABLE_KEY,SUPABASE_SECRET_KEY:config.status.SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:config.status.SERVICE_ROLE_KEY,OUTCLASS_PUBLISH_BUILD:'1',OUTCLASS_SITE_URL:config.appUrl,SMTP_HOST:'',SMTP_PASSWORD:'',RESEND_API_KEY:'',COMMUNICATIONS_EMAIL_ENABLED:'false',OUTCLASS_PLATFORM_ADMIN_IDS:'',VERCEL:'',VERCEL_ENV:''};
async function main(){
 run(['start','--workdir',root,'-x','studio,edge-runtime,analytics,vector,imgproxy']);
 const fd=fs.openSync(path.join(root,'projection-server.log'),'w');app=spawn(process.execPath,[path.join(repo,'node_modules/next/dist/bin/next'),'start','-p','3107','-H','127.0.0.1'],{cwd:repo,env,stdio:['ignore',fd,fd]});fs.closeSync(fd);
 for(let n=0;n<100;n++){try{if((await fetch(config.appUrl)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 db=new PrismaClient({datasourceUrl:config.status.DB_URL});
 const admin=createClient(config.status.API_URL,config.status.SECRET_KEY,{auth:{persistSession:false}}),people=[];
 for(const kind of ['a','b']){const email=`audit.${kind}.${randomUUID()}@virginia.edu`,password='Disposable-only!'+randomUUID();const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw Error('Local account creation failed');await db.user.create({data:{id:data.user.id,email}});people.push({id:data.user.id,email,password});}
 const schools=await Promise.all(['a','b'].map(key=>db.school.create({data:{key:'audit-'+key+'-'+randomUUID(),name:'Synthetic campus '+key}})));
 const clubs=await Promise.all(schools.map((s,i)=>db.club.create({data:{schoolId:s.id,campusKey:s.key,slug:randomUUID(),name:'Projection club '+i,tagline:'',description:'',color:'#142d45',category:'Other',decisionLetterTemplates:{ACCEPTED:{title:'Internal draft '+i,body:'Synthetic manager-only draft',closing:'',signer:'',footer:''}}}})));
 const rounds=await Promise.all(clubs.map(c=>db.pipelineRound.create({data:{clubId:c.id,name:'Review',order:0}})));
 await db.application.createMany({data:people.map((u,i)=>({studentId:u.id,clubId:clubs[i].id,roundId:rounds[i].id,status:'SUBMITTED'}))});
 // Overlapping memberships make the ordinary-member path explicit as well.
 for(const u of people)for(const c of clubs)await db.clubMember.create({data:{userId:u.id,clubId:c.id,permissions:[],accessRole:'MEMBER'}});
 let jar=[];const browser=createServerClient(config.status.API_URL,config.status.PUBLISHABLE_KEY,{cookies:{getAll:()=>jar,setAll:items=>{jar=items;}}});
 const {error}=await browser.auth.signInWithPassword({email:people[0].email,password:people[0].password});if(error)throw Error('Local sign in failed');
 const response=await fetch(config.appUrl+'/api/users/me',{headers:{Cookie:jar.map(c=>c.name+'='+c.value).join('; ')}}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.id,people[0].id);assert.equal(body.applications.length,1);assert.equal(body.applications[0].studentId,people[0].id);assert.equal(body.adminRoles.length,0);assert.equal(body.memberships.length,2);
 const result={httpStatus:response.status,ownApplicationsOnly:true,ordinaryMemberHasNoAdminRole:true,twoUniversities:true,overlappingMemberships:true,applicationClubExposesDecisionTemplates:Object.hasOwn(body.applications[0].club,'decisionLetterTemplates'),membershipClubsExposeDecisionTemplates:body.memberships.every(m=>Object.hasOwn(m.club,'decisionLetterTemplates')),classification:'Verified API property exposure; no fix applied. Synthetic content only.',limitation:'Controlled fixture uses verified UVA accounts; it does not establish second-domain login support.'};
 assert.equal(result.applicationClubExposesDecisionTemplates,true);assert.equal(result.membershipClubsExposeDecisionTemplates,true);
 fs.writeFileSync(path.join(__dirname,'evidence/account-projection.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
main().catch(()=>{console.error('Projection probe failed; no credentials or provider error bodies printed.');process.exitCode=1;}).finally(async()=>{if(db)await db.$disconnect();if(app)app.kill('SIGTERM');run(['stop','--workdir',root]);});

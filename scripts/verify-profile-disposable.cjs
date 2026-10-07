const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client'),{createClient}=require('@supabase/supabase-js');
const filename=path.join(os.tmpdir(),'outclass-profile-p2-e2e/config.json'),c=JSON.parse(fs.readFileSync(filename));
if(c.projectId!=='outclass-profile-p2-e2e'||new URL(c.status.DB_URL).port!=='58322'||new URL(c.status.API_URL).port!=='58321')throw Error('Disposable project required');
const db=new PrismaClient({datasourceUrl:c.status.DB_URL});
(async()=>{
 const rows=await db.$queryRawUnsafe(`SELECT relrowsecurity FROM pg_class WHERE oid='public."StudentProfile"'::regclass`);assert.equal(rows[0].relrowsecurity,true);
 const constraint=await db.$queryRawUnsafe(`SELECT tgenabled FROM pg_trigger WHERE tgname='outclass_student_profile_gpa'`);assert.equal(constraint[0].tgenabled,'O');
 const before=await db.studentProfile.findMany();assert.equal(before.length,4);
 for(const role of ['anon','authenticated'])for(const operation of ['SELECT','INSERT','UPDATE','DELETE']) {
  const r=await db.$queryRawUnsafe(`SELECT has_table_privilege('${role}','public."StudentProfile"','${operation}') allowed`);assert.equal(r[0].allowed,false,`${role} ${operation}`);
 }
 const browser=createClient(c.status.API_URL,c.status.PUBLISHABLE_KEY||c.status.ANON_KEY,{auth:{persistSession:false}});
 for(const loggedIn of [false,true]) {
  if(loggedIn){const r=await browser.auth.signInWithPassword(c.identities.student);assert.ifError(r.error);}
  for(const request of [()=>browser.from('StudentProfile').select('*'),()=>browser.from('StudentProfile').insert({userId:c.identities.student.id,gender:'Male'}),()=>browser.from('StudentProfile').update({gender:'Male'}).eq('userId',c.identities.student.id),()=>browser.from('StudentProfile').delete().eq('userId',c.identities.student.id)])assert.ok((await request()).error,'Browser CRUD denied');
 }
 assert.ok((await browser.storage.from('headshots').createSignedUploadUrl(c.identities.leader.id+'/forged.png')).error,'Foreign owner upload denied');
 await browser.auth.signOut();assert.ok((await browser.storage.from('headshots').createSignedUploadUrl(c.identities.student.id+'/anonymous.png')).error,'Anonymous upload denied');
 const student=c.identities.student;
 await db.studentProfile.update({where:{userId:student.id},data:{highSchool:'Example High School',gender:'Female',pronouns:'She/Her',gpa:3.875,transferStudent:true,scholarStatus:{selections:['ECHOLS','CORE'],other:''}}});
 for(const data of [{gender:'Arbitrary'},{pronouns:'Arbitrary'},{gpa:4.5},{gpa:3.1234}])await assert.rejects(db.studentProfile.update({where:{userId:student.id},data}),/constraint|GPA/);
 await db.studentProfile.update({where:{userId:student.id},data:{highSchool:null,gender:null,pronouns:null,gpa:null,transferStudent:false,scholarStatus:{selections:['NOT_APPLICABLE'],other:''}}});
 await db.application.deleteMany({where:{clubId:c.clubId}});await db.pipelineRound.deleteMany({where:{clubId:c.clubId}});
 await db.studentProfile.update({where:{userId:c.identities.outsider.id},data:{gender:'Male',pronouns:'He/Him',highSchool:'Anonymous private high school',gpa:3.5}});
 const round=await db.pipelineRound.create({data:{clubId:c.clubId,name:'Profile Review',order:1,applicantDisplay:{version:1,fields:['name','photo','major','academicYear','gender','gpa']}}});
 const anonymous=await db.pipelineRound.create({data:{clubId:c.clubId,name:'Anonymous Review',order:2,anonymousReview:true,applicantDisplay:{version:1,fields:['academicYear','gpa']}}});
 await db.application.create({data:{clubId:c.clubId,roundId:round.id,studentId:student.id,status:'SUBMITTED'}});
 await db.application.create({data:{clubId:c.clubId,roundId:anonymous.id,studentId:c.identities.outsider.id,status:'SUBMITTED'}});
 c.profileRoundId=round.id;c.anonymousRoundId=anonymous.id;fs.writeFileSync(filename,JSON.stringify(c),{mode:0o600});
 // Reproduce pre-migration historical data without weakening normal sessions.
 await db.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL session_replication_role=replica'); await tx.studentProfile.update({where:{userId:student.id},data:{gpa:4.6}}); });
 for(const data of [{firstName:'Legacy Name'},{headshotUrl:student.id+'/legacy.png'},{linkedinUrl:'https://linkedin.com/in/legacy'}]) {
  const row=await db.studentProfile.update({where:{userId:student.id},data});assert.equal(row.gpa,4.6);
 }
 await db.studentProfile.update({where:{userId:student.id},data:{gpa:3.8}});
 for(const gpa of [4.6,3.1234,-1])await assert.rejects(db.studentProfile.update({where:{userId:student.id},data:{gpa}}),/GPA/);
 await db.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL session_replication_role=replica'); await tx.studentProfile.update({where:{userId:student.id},data:{gpa:4.6,headshotUrl:null,firstName:'Student'}}); });
 const admin=createClient(c.status.API_URL,c.status.SECRET_KEY||c.status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 assert.equal((await admin.storage.getBucket('headshots')).data.public,false);
 console.log('PASS: real disposable PostgreSQL constraints, existing profiles, enabled RLS, and anon/authenticated browser CRUD denial. Recruitment browser fixtures ready.');
})().finally(()=>db.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1});

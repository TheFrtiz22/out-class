const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}) { const m={exports:{}}; new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts',mocks):require(n),m,m.exports);return m.exports; }
const fields=load('lib/student-profile.ts'),privacy=load('lib/recruitment-profile.ts'),anon=load('lib/anonymous-review.ts'),display=load('lib/applicant-display.ts'),crop=load('lib/photo-crop.ts');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clubId=uuid(1),roundId=uuid(2);
const profile={id:uuid(4),userId:uuid(5),firstName:'Jordan',lastName:'Avery',computingId:'ja123',major:'Math',gradYear:2028,transferStudent:true,gender:'Female',pronouns:'She/Her',highSchool:'Private high school',gpa:3.875,scholarStatus:null,experiences:[],bio:null,headshotUrl:null,resumeUrl:null,linkedinUrl:null};
const app={id:uuid(3),clubId,roundId,status:'SUBMITTED',student:{id:uuid(5),email:'ja@virginia.edu',studentProfile:profile},round:{id:roundId,name:'Round 1',anonymousReview:false,applicantDisplay:display.defaultDisplayConfig},evaluations:[],answers:[],bookings:[]};
test('canonical academic projection covers semester boundary, future/completed education and transfer without raw year',()=>{
 assert.deepEqual(['Fourth Year','Second Year','Third Year*','First Year'].sort(privacy.compareAcademicYears),['First Year','Second Year','Third Year*','Fourth Year']);
 assert.equal(privacy.academicYear(profile,new Date('2026-10-06Z')),'Third Year*');
 assert.equal(privacy.academicYear({...profile,transferStudent:false},new Date('2026-07-31Z')),'Second Year');
 assert.equal(privacy.academicYear({...profile,transferStudent:false},new Date('2026-08-01Z')),'Third Year');
 for(const result of [anon.identifiedApplication(app),anon.anonymousApplication(app)]) { const p=result.student.studentProfile; assert.match(p.academicYear,/\*$/); for(const key of ['gradYear','transferStudent','highSchool','pronouns'])assert.equal(key in p,false);assert.equal(p.gender,null); }
 assert.equal(anon.identifiedApplication(app,true).student.studentProfile.gender,'Female');
 const historical={...app,student:{...app.student,studentProfile:{...profile,gpa:4.6}}};
 assert.equal(anon.identifiedApplication(historical).student.studentProfile.gpa,null);assert.equal(anon.anonymousApplication(historical).student.studentProfile.gpa,null);
 assert.deepEqual(display.projectApplicantDisplay(historical,app.round,{version:1,fields:['gpa']},[]).sections[0].items,[]);
});
test('gender defaults fail closed and anonymous voting/preview cannot independently grant demographic visibility',()=>{
 assert.equal(display.defaultDisplayConfig.fields.includes('gender'),false);
 const config={version:1,fields:['academicYear','gender']};
 for(const anonymousReview of [false,true]) {
  const round={...app.round,anonymousReview};
  const hidden=display.projectApplicantDisplay(app,round,config,[]);assert.equal(hidden.visible.includes('gender'),false);assert.ok(!JSON.stringify(hidden).includes('Female'));
  const visible=display.projectApplicantDisplay(app,{...round,applicantDisplay:config},config,[]);assert.equal(visible.sections.find(s=>s.field==='gender').items[0],'Female');assert.ok(!JSON.stringify(visible).includes('2028'));
 }
 assert.deepEqual(display.readDisplayConfig({version:1,fields:['graduationYear']}).fields,['academicYear']);
});
test('profile section stores fields only for authenticated owner and roundtrips canonical values',async()=>{
 let row={...profile},authorized=true;const writes=[];
 const api=load('actions/profile.ts',{'@/utils/auth':{requireAuth:async()=>{if(!authorized)throw Error('Unauthenticated');return{user:{id:profile.userId,email:'ja@virginia.edu'}}}},'@/utils/prisma':{prisma:{studentProfile:{update:async q=>{assert.equal(q.where.userId,profile.userId);writes.push(q);row={...row,...q.data};return row},findUnique:async q=>{assert.equal(q.where.userId,profile.userId);return row}}}},'next/cache':{revalidatePath(){}}});
 const input={section:'education',major:'Math',gradYear:2028,gpa:3.875,satScore:null,highSchool:'  Example High School  ',gender:'Female',pronouns:'Other',transferStudent:true,scholarStatus:{selections:['ECHOLS','CORE'],other:''},userId:uuid(99)};
 assert.ok(!(await api.updateStudentProfileSection(input)).error);
 const saved=(await api.getStudentProfile()).profile; assert.equal(saved.highSchool,'Example High School'); assert.equal(saved.gender,'Female');assert.equal(saved.pronouns,'Other');assert.equal(saved.transferStudent,true);assert.deepEqual(saved.scholarStatus.selections,['ECHOLS','CORE']);assert.equal(saved.gradYear,2028);
 for(const invalid of [{gender:'arbitrary'},{pronouns:'Male'},{transferStudent:'yes'},{highSchool:'x'.repeat(201)},{gpa:4.1},{gpa:3.1234},{gpa:'3.8'},{gpa:NaN}])assert.ok((await api.updateStudentProfileSection({...input,...invalid})).error);
 assert.equal(writes.length,1);authorized=false;await assert.rejects(api.updateStudentProfileSection(input),/Unauthenticated/);
});
test('server filters gender in scoped round and counts unfiltered authorized round applicants transactionally',async()=>{
 let permitted=true,visible=true,anonymousReview=false,caps=["applications.review","applicants.identify"];const queries=[];
 const tx={pipelineRound:{findMany:async()=>[{...app.round,anonymousReview,applicantDisplay:visible?{version:1,fields:['gender']}:display.defaultDisplayConfig}]},application:{findMany:async q=>{queries.push(q);return[{...app,round:{...app.round,anonymousReview,applicantDisplay:visible?{version:1,fields:['gender']}:display.defaultDisplayConfig}}]},groupBy:async q=>{queries.push(q);return[{studentId:profile.userId}]}},studentProfile:{groupBy:async q=>{queries.push(q);return[{gender:'Female',_count:1}]}},auditLog:{}};
 const api=load('actions/crm.ts',{'@/utils/auth':{requireClubPermission:async()=>{if(!permitted)throw Error('Denied');return {membership:{permissions:caps}}}},'@/utils/prisma':{prisma:{$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn(tx)}}},'next/cache':{revalidatePath(){}}});
 const result=await api.getClubPipeline(clubId,{roundId,gender:'Female',genderCounts:true});assert.equal(result.applications[0].student.studentProfile.gender,'Female');assert.deepEqual(queries[0].where.student,{studentProfile:{gender:'Female'}});assert.equal(queries[0].where.clubId,clubId);assert.equal(queries[0].where.roundId,roundId);assert.equal('student'in queries[1].where,false);assert.equal(result.genderCounts.find(c=>c.gender==='Female').count,1);
 caps=['applicants.identify'];assert.equal((await api.getClubPipeline(clubId)).applications[0].student.studentProfile.gender,null);await assert.rejects(api.getClubPipeline(clubId,{roundId,gender:'Female'}),/visibility/);caps=['applications.review','applicants.identify'];
 visible=false;for(const filter of [{roundId,gender:'Female'},{roundId,genderCounts:true},{gender:'Female'},{roundId:uuid(99),genderCounts:true}])await assert.rejects(api.getClubPipeline(clubId,filter),/visibility/);
 anonymousReview=true;const hidden=await api.getClubPipeline(clubId);assert.equal(hidden.applications[0].student.studentProfile.gender,null);
 permitted=false;await assert.rejects(api.getClubPipeline(clubId,{roundId,gender:'Female'}),/Denied/);
});
test('GPA preserves three-decimal 4.0 values and importer never infers demographics or converts alternate scales',()=>{
 for(const value of [0,4,3.875])assert.equal(fields.gpaSchema.safeParse(value).success,true);
 for(const value of [-1,4.01,3.1234,Infinity,NaN,'3.8'])assert.equal(fields.gpaSchema.safeParse(value).success,false);
 const resume=load('lib/resume-import.ts');
 const proposal=resume.extractResumeProposal('Jordan Avery\nHigh school: Example High School\nGPA: 3.875/4.0\nMajor: Math\nFemale She/Her transfer Echols scholar');assert.equal(proposal.fields.find(f=>f.field==='highSchool').value,'Example High School');assert.equal(proposal.fields.find(f=>f.field==='gpa').value,'3.875');for(const forbidden of ['gender','pronouns','transferStudent','scholarStatus'])assert.equal(proposal.fields.some(f=>f.field===forbidden),false);
 for(const text of ['GPA: 3.8/4.33','GPA: 3.8/5','GPA: 3.1234'])assert.notEqual(resume.extractResumeProposal('Example resume with academic history\n'+text).fields.find(f=>f.field==='gpa').status,'found');
});
test('crop bounds preserve pixels at zoom/reposition extremes and reject invalid state/images',()=>{
 for(const zoom of [1,2,4])for(const x of [-1,0,1])for(const y of [-1,0,1]){const r=crop.photoCropRect(1200,800,{zoom,x,y});assert.ok(r.sx>=0&&r.sy>=0&&r.sx+r.side<=1200&&r.sy+r.side<=800);}
 assert.deepEqual(crop.photoCropRect(1200,800,{zoom:2,x:1,y:-1}),{sx:800,sy:0,side:400});
 for(const dimensions of [[0,800],[NaN,800],[10000,10000]])assert.throws(()=>crop.photoCropRect(...dimensions,crop.initialPhotoCrop));
 for(const state of [{zoom:0,x:0,y:0},{zoom:5,x:0,y:0},{zoom:1,x:2,y:0}])assert.throws(()=>crop.photoCropRect(100,100,state));
});
test('migration preserves historical GPA/scholar data, defaults and application relations without conversion',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try {
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;');
  const dir='prisma/migrations/',migration='20261006020000_profile_recruitment_visibility';
  for(const name of fs.readdirSync(dir).filter(n=>fs.existsSync(dir+n+'/migration.sql')).sort().filter(n=>n<migration))await db.exec(fs.readFileSync(dir+name+'/migration.sql','utf8'));
  await db.exec(`INSERT INTO "User"(id,email) VALUES('legacy','legacy@virginia.edu'),('valid','valid@virginia.edu');INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear",gpa,"scholarStatus") VALUES('legacy-profile','legacy','Legacy','Student','legacy','Math',2028,4.6,'{"selections":["WALENTAS"],"other":""}'),('valid-profile','valid','Valid','Student','valid','Math',2028,3.875,NULL);`);
  await db.exec(fs.readFileSync(dir+migration+'/migration.sql','utf8'));
  const row=(await db.query(`SELECT * FROM "StudentProfile" WHERE id='legacy-profile'`)).rows[0];assert.equal(row.gpa,4.6);assert.deepEqual(row.scholarStatus,{selections:['WALENTAS'],other:''});assert.equal(row.transferStudent,false);assert.equal(row.gender,null);assert.equal(row.pronouns,null);assert.equal(row.highSchool,null);assert.equal(row.gradYear,2028);
  await assert.rejects(db.exec(`UPDATE "StudentProfile" SET gpa=4.5 WHERE id='valid-profile'`),/check constraint/);
  await db.exec(`UPDATE "StudentProfile" SET gender='Other',pronouns='They/Them',"transferStudent"=TRUE,"scholarStatus"='{"selections":["ECHOLS","JEFFERSON","COLLEGE_SCIENCE","RODMAN","MILLER_ARTS","CORE"],"other":""}' WHERE id='valid-profile'`);
  assert.equal((await db.query(`SELECT gpa FROM "StudentProfile" WHERE id='valid-profile'`)).rows[0].gpa,3.875);
  for(const role of ['anon','authenticated'])for(const op of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege('${role}','"StudentProfile"','${op}') allowed`)).rows[0].allowed,false);
 }finally{await db.close();}
});
test('generic audited Admin inspection cannot acquire new private fields by schema expansion',async()=>{
 let authorized=false;const reads=[],audit=[];
 const api=load('actions/platform-admin.ts',{'@/utils/platform-admin':{requirePlatformAdmin:async()=>{if(!authorized)throw Error('Elevation required');return{id:uuid(8)}}},'@/utils/prisma':{prisma:{auditLog:{create:async q=>audit.push(q)},user:{findUnique:async q=>{reads.push(q);return null}},application:{findUnique:async q=>{reads.push(q);return null}}}},'@/lib/demo/validate':{}});
 await assert.rejects(api.inspectPlatformUser(profile.userId,'Review account access'),/Elevation/);assert.equal(reads.length,0);
 authorized=true;await api.inspectPlatformUser(profile.userId,'Review account access');await api.inspectPlatformRecord('users',profile.userId,'Review account access');await api.inspectPlatformRecord('applications',app.id,'Review account access');
 for(const q of reads){const select=q.include?.studentProfile?.select??q.select?.studentProfile?.select??q.include?.student?.select?.studentProfile?.select;assert.equal(select.gradYear,true);for(const key of ['highSchool','gender','pronouns','transferStudent'])assert.equal(key in select,false);}
 assert.equal(audit.length,3);
});

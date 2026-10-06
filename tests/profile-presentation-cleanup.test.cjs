const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop:true } }).outputText;
  new Function('require','module','exports',code)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.slice(2)+'.ts',mocks) : require(n),mod,mod.exports);
  return mod.exports;
}
const profile = load('lib/student-profile.ts');
const display = load('lib/applicant-display.ts');
const owner='123e4567-e89b-12d3-a456-426614174000';
test('web imports normalize domains, preserve explicit protocols and reject malformed/unsafe URLs',()=>{
  for(const [input,output] of [[' linkedin.com/in/example ','https://linkedin.com/in/example'],['www.linkedin.com/in/example','https://www.linkedin.com/in/example'],['example.com/resume.pdf','https://example.com/resume.pdf'],['http://example.com/resume.pdf','http://example.com/resume.pdf']]) assert.equal(profile.normalizeWebUrl(input),output);
  for(const value of ['nonsense','hello world','/example.com','//example.com','https:///example.com','javascript:alert(1)','ftp://example.com','https://user:secret@example.com','https://example..com']) assert.throws(()=>profile.normalizeWebUrl(value),value);
  assert.equal(profile.linkedinUrlSchema.parse('linkedin.com/in/example'),'https://linkedin.com/in/example');
  assert.equal(profile.linkedinUrlSchema.safeParse('linkedin.com.evil.com/in/example').success,false);
  assert.equal(profile.resumeReferenceSchema.parse(`${owner}/resume.pdf`),`${owner}/resume.pdf`);
});
test('PDF/image validation examines bytes, accepts generic PDF MIME, and enforces size/type',()=>{
  const pdf=fs.readFileSync('public/demo/sample-resume.pdf');
  for(const mime of ['application/pdf','application/octet-stream','']) assert.equal(profile.validateProfileFile(pdf,mime,'resume'),'application/pdf');
  assert.throws(()=>profile.validateProfileFile(Buffer.from('not a PDF'),'application/pdf','resume'));
  assert.throws(()=>profile.validateProfileFile(pdf,'image/png','resume'));
  assert.throws(()=>profile.validateProfileFile(new Uint8Array(10*1024*1024+1),'application/pdf','resume'));
  assert.throws(()=>profile.validateProfileFile(new Uint8Array(),'application/pdf','resume'));
  assert.equal(profile.validateProfileFile(Uint8Array.from([137,80,78,71,13,10,26,10]),'image/png','headshot'),'image/png');
  assert.throws(()=>profile.validateProfileFile(Buffer.from('<svg/>'),'image/svg+xml','headshot'));
});
function app(photo='https://example.com/photo.png') { return {id:'app',clubId:'club',roundId:'round',student:{id:owner,studentProfile:{firstName:'Jordan',lastName:'Avery',headshotUrl:photo,bio:'Historical hidden bio',actScore:33,actEnglish:34,actMath:35,actReading:36,actScience:32,experiences:[{title:'Research',subtitle:'Lab',period:'2025'}],resumeUrl:`${owner}/resume.pdf`,linkedinUrl:'https://linkedin.com/in/example'}},answers:[],evaluations:[],status:'IN_REVIEW'} }
test('canonical interview/voting projection hides historical Bio/subsections and avoids résumé duplication',()=>{
  const round={id:'round',name:'Interview',anonymousReview:false};
  const config=display.displayConfigSchema.parse({version:1,fields:['name','photo','biography','act','resume','experiences']});
  const view=display.projectApplicantDisplay(app(),round,config,[]);
  assert.equal(view.photo,'https://example.com/photo.png');
  assert.deepEqual(view.sections.find(s=>s.field==='act').items,['33']);
  assert.equal(view.sections.some(s=>s.field==='experiences'),false);
  assert.doesNotMatch(JSON.stringify(view),/Historical hidden bio|actEnglish|actReading/);
  assert.equal(view.links[0].href,'/api/recruiting-resumes?clubId=club&applicationId=app');
  assert.equal(display.projectApplicantDisplay(app(),round,{version:1,fields:['experiences']},[]).sections[0].items[0],'Research · Lab · 2025');
  for(const photo of [null,'javascript:alert(1)']) assert.equal(display.projectApplicantDisplay(app(photo),round,config,[]).photo,null);
  const anonymous=display.projectApplicantDisplay(app(),{...round,anonymousReview:true},config,[]);
  assert.equal(anonymous.photo,null); assert.deepEqual(anonymous.links,[]);assert.doesNotMatch(JSON.stringify(anonymous),/Jordan|resume.pdf|Historical/);
});
test('identity updates persist the headshot while leaving historical bio and academic data untouched',async()=>{
  let stored={headshotUrl:null,bio:'Historical',actEnglish:34};
  const api=load('actions/profile.ts',{'@/utils/auth':{requireAuth:async()=>({user:{id:owner}})},'@/utils/prisma':{prisma:{studentProfile:{update:async({where,data})=>{assert.equal(where.userId,owner);stored={...stored,...data};return stored},findUnique:async()=>stored}}},'next/cache':{revalidatePath(){}}});
  await api.updateStudentProfileSection({section:'identity',firstName:'Jordan',lastName:'Avery',headshotUrl:'https://example.com/new.png',bio:'Forged'});
  assert.equal(stored.headshotUrl,'https://example.com/new.png');assert.equal(stored.bio,'Historical');assert.equal(stored.actEnglish,34);
  const refreshed=await api.getStudentProfile();assert.equal(refreshed.profile.headshotUrl,stored.headshotUrl);
  await api.updateStudentProfileSection({section:'identity',firstName:'Jordan',lastName:'Avery',headshotUrl:null});assert.equal(stored.headshotUrl,null);
});
function uploads({deny=false,publicBucket=false,error=false}={}) {
  const writes=[];
  process.env.SUPABASE_SECRET_KEY='test-only';
  const bucket={createSignedUploadUrl:async(path)=>({data:{signedUrl:'https://signed',token:'token',path}}),getPublicUrl:path=>({data:{publicUrl:`https://storage.example.com/${path}`}}),uploadToSignedUrl:async(path,token,bytes,opts)=>{writes.push({path,token,bytes,opts});return{error:error?{}:null}}};
  const client={storage:{from:()=>bucket}};
  const api=load('actions/storage.ts',{'@/utils/auth':{requireAuth:async()=>{if(deny)throw Error('Denied');return{user:{id:owner}}}},'@/utils/support-audit':{auditSupportAction:async()=>{}},'@/utils/supabase/server':{createClient:async()=>client},'next/headers':{cookies:async()=>({})},'@supabase/supabase-js':{createClient:()=>({storage:{getBucket:async()=>({data:{public:publicBucket}})}})}});
  return {api,writes};
}
function form(bytes=fs.readFileSync('public/demo/sample-resume.pdf'),kind='resume',mime='application/pdf') {const data=new FormData();data.set('kind',kind);data.set('file',new Blob([bytes],{type:mime}),kind==='resume'?'resume.pdf':'photo.png');return data}
test('authenticated PDF uploads retain private owner keys and canonical MIME; rejected uploads do not write',async()=>{
  const h=uploads();const result=await h.api.uploadProfileFile(form());assert.match(result.reference,new RegExp(`^${owner}/`));assert.equal(h.writes[0].opts.contentType,'application/pdf');assert.equal(h.writes[0].token,'token');
  for(const data of [new FormData(),form(Buffer.from('invalid')),form(new Uint8Array(10*1024*1024+1))]) await assert.rejects(h.api.uploadProfileFile(data));assert.equal(h.writes.length,1);
  await assert.rejects(uploads({deny:true}).api.uploadProfileFile(form()),/Denied/);
  await assert.rejects(uploads({publicBucket:true}).api.uploadProfileFile(form()),/Private document/);
  await assert.rejects(uploads({error:true}).api.uploadProfileFile(form()),/Upload failed/);
});
test('headshots use the existing owner storage flow and return a reloadable public image URL',async()=>{
  const h=uploads();const result=await h.api.uploadProfileFile(form(Uint8Array.from([137,80,78,71,13,10,26,10]),'headshot','image/png'));assert.match(result.reference,/https:\/\/storage.example.com\//);assert.match(h.writes[0].path,new RegExp(`^${owner}/`));assert.equal(h.writes[0].opts.contentType,'image/png');
});
test('interview uses a narrow panel while voting retains the shared image fallback; profile overview excludes retired sections',()=>{
  const panel=fs.readFileSync('components/applicant-intelligence.tsx','utf8');assert.match(panel,/AvatarFallback/);assert.match(panel,/AvatarImage/);assert.match(panel,/!data.anonymous/);assert.match(panel,/size-24/);
  assert.match(fs.readFileSync('components/live-voting/board-decision-mode.tsx','utf8'),/ApplicantDisplayPanel/);assert.match(fs.readFileSync('components/views/interview-workspace-view.tsx','utf8'),/InterviewApplicantPanel/);
  const overview=fs.readFileSync('components/views/unified-student-profile-view.tsx','utf8');assert.doesNotMatch(overview,/profile\.bio|actEnglish|actMath|Campus involvement|TestScoreDetail/);assert.match(overview,/size-24/);
});

test('profile link edits store normalized external URLs without weakening private-key ownership',async()=>{
  let saved;
  const api=load('actions/profile.ts',{'@/utils/auth':{requireAuth:async()=>({user:{id:owner}})},'@/utils/prisma':{prisma:{studentProfile:{update:async({data})=>{saved=data;return data}}}},'next/cache':{revalidatePath(){}}});
  const result=await api.updateStudentProfileSection({section:'links',linkedinUrl:'linkedin.com/in/example',resumeUrl:'example.com/resume.pdf'});assert.ok(!result.error);assert.equal(saved.resumeUrl,'https://example.com/resume.pdf');assert.equal(saved.linkedinUrl,'https://linkedin.com/in/example');
  assert.ok((await api.updateStudentProfileSection({section:'links',linkedinUrl:null,resumeUrl:'00000000-0000-4000-8000-000000000001/private.pdf'})).error);
});

test('shared Avatar renders initials while missing/broken images have not loaded',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const {Avatar,AvatarImage,AvatarFallback}=load('components/ui/avatar.tsx',{'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}});
  for(const src of [undefined,'https://example.com/missing-photo.png']) {
    const html=renderToStaticMarkup(React.createElement(Avatar,{className:'size-24'},React.createElement(AvatarImage,{src,alt:'Applicant photo'}),React.createElement(AvatarFallback,null,'JA')));
    assert.match(html,/data-slot="avatar-fallback"/);assert.match(html,/>JA</);assert.match(html,/size-24/);assert.doesNotMatch(html,/<img/);
  }
});
test('application résumé links normalize independently of essays and retain private ownership checks',()=>{
  const helpers=load('lib/student-applications.ts');const questions=[{id:'file',type:'FILE_UPLOAD'},{id:'essay',type:'ESSAY'}];
  const answers=helpers.normalizeApplicationAttachments(questions,[{questionId:'file',response:'example.com/resume.pdf'},{questionId:'essay',response:'example.com essay'}]);
  assert.equal(answers[0].response,'https://example.com/resume.pdf');assert.equal(answers[1].response,'example.com essay');
  assert.deepEqual(helpers.answerErrors(questions,[{questionId:'file',response:'example.com/resume.pdf'}],false),{});
});

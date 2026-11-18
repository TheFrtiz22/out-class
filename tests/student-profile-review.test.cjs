const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
function load(file){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/')?load(path.resolve(n.slice(2))+'.ts'):require(n),mod,mod.exports);return mod.exports}
const {gpaLabel,recruitmentProfile}=load('lib/recruitment-profile.ts')
const read=file=>fs.readFileSync(file,'utf8')

test('the GPA label says high school until a first fall term has ended, then college',()=>{
  const fall=new Date('2026-10-01T12:00:00Z'),spring=new Date('2027-02-01T12:00:00Z')
  assert.equal(gpaLabel({gradYear:2031},fall),'High school GPA','incoming student')
  assert.equal(gpaLabel({gradYear:2030},fall),'High school GPA','first year, fall term')
  assert.equal(gpaLabel({gradYear:2030},spring),'College GPA','first year, spring term')
  assert.equal(gpaLabel({gradYear:2028},fall),'College GPA','third year')
  assert.equal(gpaLabel({gradYear:2030,transferStudent:true},fall),'College GPA','a transfer student has college grades')
})

test('Preview renders the recruiter projection: gender, phone and high school never appear',()=>{
  const source=read('components/student-profile-preview.tsx')
  assert.match(source,/recruitmentProfile\(profile\)/,'the same allowlist club reviewers read')
  assert.match(source,/<ApplicantProfileFacts profile=\{view\}/,'the same applicant component reviewers use')
  const profile={id:'p',userId:'u',firstName:'Ada',lastName:'L',computingId:'al1',major:'Math',gradYear:2028,transferStudent:false,gpa:3.9,satScore:null,actScore:null,actEnglish:null,actMath:null,actReading:null,actScience:null,bio:null,linkedinUrl:null,resumeUrl:null,headshotUrl:null,experiences:[{id:'e',title:'Analyst',subtitle:'Fund',period:'2025'}],gender:'Woman',phone:'4345550100',highSchool:'Central',pronouns:'she/her',scholarStatus:null}
  const view=recruitmentProfile(profile)
  assert.equal(view.gender,null);assert.equal('phone' in view,false);assert.equal('highSchool' in view,false);assert.equal(view.experiences.length,1)
})

test('Profile shows experience, notes who sees gender, labels the GPA, and the editor keeps one height',()=>{
  const view=read('components/views/unified-student-profile-view.tsx'),dialog=read('components/edit-student-profile-dialog.tsx')
  assert.match(view,/"Experience",\s*"experience"/);assert.match(view,/profile\.experiences\.map/)
  assert.match(view,/Clubs see your gender only when they turn it on for a round\./)
  assert.match(view,/\{gpaLabel\(profile\)\}/)
  assert.match(view,/<StudentProfilePreview profile=\{profile\} \/>/)
  assert.match(dialog,/sections \? \{ height: "min\(46rem, calc\(100dvh - 2rem\)\)"/)
  assert.doesNotMatch(dialog,/Save changes to update your photo|saves automatically|explicitly enabled/)
})

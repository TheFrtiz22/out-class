const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
function load(file){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports}
const {managerNavigation,mobileDestinations}=load('lib/product-navigation.ts')
test('recruiting destinations are flat links: Applicants and Decide, with Scheduled decisions gated inside Decide',()=>{
 const owner=managerNavigation({isOwner:true},'club','recruiting')
 assert.ok(owner.every(i=>!('navGroup' in i)),'no flyout groups')
 assert.deepEqual(owner.filter(i=>!i.hidden).map(i=>[i.id,i.label]),[['overview','Overview'],['applicants','Applicants'],['interviews','Interviews'],['decisions','Decide'],['settings','Settings']])
 assert.equal(owner.find(i=>i.id==='applicants').href,'/club/club/workspace?section=recruitment&tool=applicants')
 assert.equal(owner.find(i=>i.id==='decisions').href,'/club/club/workspace?section=recruitment&tool=decisions&decisionTab=voting')
 const reviewer=managerNavigation({permissions:['applications.review']},'club','recruiting')
 // Decision status filters live on Applicants; Decide needs voting, letters or scheduled-send access.
 assert.ok(!reviewer.some(i=>i.id==='decisions'));assert.ok(managerNavigation({permissions:['applications.review','decisions.vote']},'club','recruiting').some(i=>i.id==='decisions'));assert.equal(managerNavigation({permissions:['recruitment.manage']},'club','recruiting').find(i=>i.id==='decisions').href,'/club/club/workspace?section=recruitment&tool=decisions&decisionTab=letters')
 assert.ok(!managerNavigation({permissions:['decisions.publish']},'club','recruiting').some(i=>i.id==='decisions'))
 assert.equal(managerNavigation({permissions:['decisions.publish','applicants.identify']},'club','recruiting').find(i=>i.id==='decisions').href,'/club/club/workspace?section=recruitment&tool=decisions&decisionTab=letters')
 assert.deepEqual(mobileDestinations(owner).map(i=>i.label),['Overview','Applicants','Interviews','Decide','Settings'])
})
test('Announcements are not a destination: they live on Home; Settings keeps its page',()=>{
 for(const mode of ['club','recruiting'])assert.ok(!managerNavigation({permissions:['meetings.manage']},'club',mode).some(i=>i.id==='announcements'))
 const settings=managerNavigation({isOwner:true},'club','club').find(i=>i.id==='settings');assert.equal(settings.label,'Settings');assert.equal(settings.href,'/club/club/workspace?section=settings')
})
test('current-person initials and photo handling use stored identity with safe fallback',()=>{
 const {accountInitials,profilePhotoSource}=load('lib/profile-photo.ts')
 assert.equal(accountInitials({profile:{firstName:' Ada ',lastName:'Lovelace'}}),'AL')
 assert.equal(accountInitials({email:'sam.lee@virginia.edu'}),'SL');assert.equal(accountInitials({email:'kim@virginia.edu'}),'KI');assert.equal(accountInitials(null),'OC')
 assert.equal(profilePhotoSource('https://untrusted.invalid/photo.png'),undefined)
 assert.equal(profilePhotoSource('/demo/sample-headshot.svg'),'/demo/sample-headshot.svg')
})

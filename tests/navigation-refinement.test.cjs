const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
function load(file){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports}
const {managerNavigation,mobileDestinations}=load('lib/product-navigation.ts')
test('recruiting navigation groups preserve original routes and individually gated children',()=>{
 const owner=managerNavigation({isOwner:true},'club','recruiting')
 assert.deepEqual(owner.filter(i=>i.navGroup==='applicants').map(i=>[i.id,i.label]),[['applicants','All Applicants'],['rejected','Rejected Applicants']])
 assert.deepEqual(owner.filter(i=>i.navGroup==='decisions').map(i=>[i.id,i.label]),[['decisions','All Decisions'],['scheduled-decisions','Scheduled Decisions'],['letters','Decision Letters']])
 for(const item of owner.filter(i=>i.navGroup))assert.equal(item.href,`/club/club/workspace?section=recruitment&tool=${item.id}`)
 const reviewer=managerNavigation({permissions:['applications.review']},'club','recruiting')
 assert.ok(reviewer.some(i=>i.id==='decisions'));for(const id of ['scheduled-decisions','letters','announcements'])assert.ok(!reviewer.some(i=>i.id===id))
 const publishing=managerNavigation({permissions:['decisions.publish']},'club','recruiting');assert.ok(!publishing.some(i=>i.id==='scheduled-decisions'))
 assert.ok(managerNavigation({permissions:['decisions.publish','applicants.identify']},'club','recruiting').some(i=>i.id==='scheduled-decisions'))
 assert.deepEqual(mobileDestinations(owner).filter(i=>i.navGroup).map(i=>i.label),['Applicants','Decisions'])
})
test('Announcements in both modes retain one destination, same permission, and Recruiting context',()=>{
 for(const mode of ['club','recruiting']){
  assert.ok(!managerNavigation({permissions:['applications.review']},'club',mode).some(i=>i.id==='announcements'))
  const nav=managerNavigation({permissions:['meetings.manage']},'club',mode),item=nav.find(i=>i.id==='announcements'),url=new URL(item.href,'https://outclass.test')
  assert.equal(item.label,'Announcements');assert.equal(url.pathname,'/club/club/workspace');assert.equal(url.searchParams.get('section'),'announcements');assert.equal(url.searchParams.get('mode'),mode==='recruiting'?'recruiting':null)
 }
 const settings=managerNavigation({isOwner:true},'club','club').find(i=>i.id==='settings');assert.equal(settings.label,'Settings');assert.equal(settings.href,'/club/club/workspace?section=settings')
})
test('current-person initials and photo handling use stored identity with safe fallback',()=>{
 const {accountInitials,profilePhotoSource}=load('lib/profile-photo.ts')
 assert.equal(accountInitials({profile:{firstName:' Ada ',lastName:'Lovelace'}}),'AL')
 assert.equal(accountInitials({email:'sam.lee@virginia.edu'}),'SL');assert.equal(accountInitials({email:'kim@virginia.edu'}),'KI');assert.equal(accountInitials(null),'OC')
 assert.equal(profilePhotoSource('https://untrusted.invalid/photo.png'),undefined)
 assert.equal(profilePhotoSource('/demo/sample-headshot.svg'),'/demo/sample-headshot.svg')
})

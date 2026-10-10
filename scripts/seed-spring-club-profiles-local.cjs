// Explicit, disposable-local fixture enrichment. No hosted URL is accepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {Actor,totp}=require('../tests/helpers/onboarding-e2e.cjs');
const filename=process.argv[2];if(!filename)throw Error('Pass the disposable local Corkboard config explicitly.');
const c=JSON.parse(fs.readFileSync(filename));assert.equal(c.projectId,'outclass-corkboard-e2e');
for(const [value,port] of [[c.status.DB_URL,'56322'],[c.status.API_URL,'56321'],[c.appUrl,'3108']]){const u=new URL(value);assert.ok(['127.0.0.1','localhost'].includes(u.hostname));assert.equal(u.port,port);}
c.buildDir=path.resolve('.next-publish');
const db=new PrismaClient({datasourceUrl:c.status.DB_URL});
function load(file){const ts=require('typescript'),m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/lib/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return m.exports;}
(async()=>{try{
 const admin=new Actor(c);await admin.signIn(c.identities.admin.email,c.identities.admin.password);
 for(const body of [{action:'password',password:c.identities.admin.password},{action:'verify',code:totp(c.identities.admin.totpSecret)}])assert.equal((await admin.request('/api/platform/elevation',{method:'POST',headers:{origin:c.appUrl,'Content-Type':'application/json'},body:JSON.stringify(body)})).status,200);
 const {profileDraft}=load('lib/club-marketing.ts');const fixtures=require('./fixtures/spring-launch-club-profiles.json'),out=[];
 for(const f of fixtures){
  const matches=await db.club.findMany({where:{campusKey:'uva',OR:[{slug:f.slug},{name:{contains:f.key==='common-cents'?'Common Cents':f.key,mode:'insensitive'}}]},select:{id:true,name:true,slug:true}});assert.ok(matches.length<=1,'Ambiguous canonical row: '+f.key);
  let club=matches[0];if(!club){const created=await admin.action('actions/admin-clubs.ts','saveAdminClub',[{slug:f.slug,schoolId:'school-uva',isDiscoverable:true,applicationOpen:false,applicationDeadline:null,profile:profileDraft({...f}),reason:'Create disposable sourced launch profile fixture.'}]);assert.ok(created.id,created.error);club={id:created.id,slug:f.slug,name:f.name};}
  const current=(await admin.action('actions/admin-clubs.ts','getAdminClub',[club.id])).value;assert.ok(current);
  const profile={...current.profile,tagline:f.tagline,description:f.description,category:f.category,color:f.color,acceptanceRate:null,aumValue:null,marketing:{...profileDraft({}).marketing,website:f.website,showAcceptance:false,showAum:false,showMembers:false,sections:f.sections}};
  // Official logos are fetched once and stored through the elevated Admin action.
  const sources={enactus:null,portico:'https://images.squarespace-cdn.com/content/v1/660ef0c4007324761177564b/964393c0-9437-420e-8401-0049a03048b5/PORTICO+IMPACT+FUND.png?format=500w',tamid:'https://www.uvatamid.org/Images/TAMID-Logo.png','common-cents':'https://virginia-cdn.presence.io/organization-photos/cea28f2b-baa9-4c47-8879-da8d675e4471/95ef9900-9cc9-4a2b-824b-6a58634940a9.png'};
  if(!profile.logoUrl?.startsWith('club-assets/')){const bytes=sources[f.key]?Buffer.from(await(await fetch(sources[f.key])).arrayBuffer()):fs.readFileSync('public/logos/enactus.png');const image=require('sharp')(bytes);if(f.key==='portico')image.flatten({background:f.color});const optimized=await image.png().toBuffer();const form=new FormData();form.set('clubId',club.id);form.set('admin','true');form.set('file',new File([optimized],'official-logo.png',{type:'image/png'}));profile.logoUrl=(await admin.action('actions/club-assets.ts','uploadClubAsset',[form])).reference;}
  const result=await admin.action('actions/admin-clubs.ts','saveAdminClub',[{id:current.id,version:current.version,slug:current.slug,schoolId:current.schoolId,isDiscoverable:true,applicationOpen:current.applicationOpen,applicationDeadline:current.applicationDeadline,profile,reason:'Enrich disposable local launch profile with sourced content.'}]);assert.ok(result.id,result.error);
  out.push({id:club.id,slug:club.slug,name:club.name});
 }
 fs.writeFileSync('/tmp/outclass-spring-profiles-local.json',JSON.stringify(out,null,2)+'\n');console.log('Four canonical local profiles enriched through elevated Admin actions; existing names/slugs and recruitment preserved.');
}finally{await db.$disconnect();}})().catch(e=>{console.error(e.message);process.exitCode=1});

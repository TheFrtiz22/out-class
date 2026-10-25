// Native row/NULL/scope parity on the reserved local database. Roll back all
// synthetic cases; existing HTTP suites separately exercise every live guard.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{isDeepStrictEqual}=require('node:util'),{readConfig}=require('./helpers/onboarding-e2e.cjs'),{load}=require('./helpers/voting-harness.cjs');
const configFile=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('native metadata JOIN preserves complete Prisma predicates, nullable profiles and unknown-scope fallback',{skip:!configFile,timeout:120000},async()=>{
 const config=readConfig(configFile),f=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'navigation-fixture.json'))),db=new PrismaClient({datasourceUrl:config.status.DB_URL});
 const {readPipelineMetadata,pipelinePageMetadataSelect,pipelineMetadataQuery}=load('lib/pipeline-metadata-read.ts');let comparisons=0;const rollback=new Error('Rollback native metadata cases');
 try{await assert.rejects(db.$transaction(async tx=>{
  const rounds=[];for(const clubId of f.clubIds)for(const anonymousReview of [false,true])rounds.push(await tx.pipelineRound.create({data:{clubId,anonymousReview,archivedAt:anonymousReview?new Date():null,name:'Phase 9 disposable scope',order:99,type:'APPLICATION_REVIEW'}}));
  const apps=[];for(const [i,round]of rounds.entries())for(const status of ['SUBMITTED','DRAFTING'])for(const profile of [false,true]){
   const user=await tx.user.create({data:{email:randomUUID()+'@virginia.edu',...(profile?{studentProfile:{create:{firstName:'Éva 李',lastName:'Scope',computingId:randomUUID(),major:'Apostrophe \' Math',gradYear:2028,transferStudent:true,gpa:3.125,satScore:null,actScore:29,gender:i%2?'Female':'Male'}}}:{})}});
   apps.push(await tx.application.create({data:{clubId:round.clubId,roundId:round.id,studentId:user.id,status}}));
  }
  const scopes=[];for(const clubId of f.clubIds){const base={clubId,status:{not:'DRAFTING'}};scopes.push(base,{...base,round:{anonymousReview:true}},{...base,student:{studentProfile:{gender:'Female'}}},{...base,round:{anonymousReview:true},student:{studentProfile:{gender:'Female'}}});for(const round of rounds)scopes.push({...base,roundId:round.id});for(const app of apps)scopes.push({...base,id:app.id},{...base,id:app.id,roundId:app.roundId});scopes.push({...base,AND:[{roundId:rounds[0].id}]},{...base,OR:[{status:'SUBMITTED'},{status:'IN_REVIEW'}]},{...base,student:{studentProfile:{gender:'Male',major:'Apostrophe \' Math'}}})}
  const sorted=rows=>rows.sort((a,b)=>a.id.localeCompare(b.id));
  for(const where of scopes){let raw=0;const wrapped={...tx,async $queryRaw(query){raw++;return tx.$queryRaw(query)}};
   const expected=await tx.application.findMany({where,select:pipelinePageMetadataSelect}),actual=await readPipelineMetadata(wrapped,where);assert.ok(isDeepStrictEqual(sorted(actual),sorted(expected)),'Native metadata parity at synthetic case '+comparisons);assert.equal(raw,pipelineMetadataQuery(where)?1:0);comparisons++;
  }
  const impossible={clubId:"x' OR TRUE; --",status:{not:'DRAFTING'}};assert.deepEqual(await readPipelineMetadata(tx,impossible),[]);
  throw rollback;
 },{isolationLevel:'RepeatableRead',timeout:60000}),error=>error===rollback);assert.ok(comparisons>=80);
 }finally{await db.$disconnect()}
});

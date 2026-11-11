// Keyset paging for the leadership Submitted reviews and Résumé moderation lists, run through the
// real server actions against migrated disposable PostgreSQL/WASM (tests/helpers/interview-sql-harness.cjs).
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {harness}=require('./helpers/interview-sql-harness.cjs');
let h,reviews,resumes,cursorLib,seed;
const N=250,TIE=7,base=Date.UTC(2026,9,1,12);
const q=s=>`'${s}'`;
before(async()=>{
 h=await harness();reviews=h.load('actions/interview-kits.ts');resumes=h.load('actions/interview-resumes.ts');cursorLib=h.load('lib/interview-list-page.ts');
 const {db,ids}=h,round2=randomUUID(),cycleA=randomUUID(),cycleB=randomUUID(),club2=randomUUID(),club2Round=randomUUID(),club2Member=randomUUID();
 await db.exec(`INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES (${q(cycleA)},${q(ids.club)},'A'),(${q(cycleB)},${q(ids.club)},'B');
  INSERT INTO "PipelineRound"(id,"clubId",name,"order","interviewKit") VALUES (${q(round2)},${q(ids.club)},'Final',2,'[]');
  INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES (${q(club2)},'other-club','Other','','','','');
  INSERT INTO "PipelineRound"(id,"clubId",name,"order","interviewKit") VALUES (${q(club2Round)},${q(club2)},'Other interview',1,'[]');
  INSERT INTO "ClubMember"(id,"clubId","userId","isOwner",permissions,"interviewOffices") VALUES (${q(club2Member)},${q(club2)},${q(ids.owner)},true,'{}','{PRESIDENT}');`);
 // N applicants in the fixture club plus 20 in another club. Timestamps repeat in runs of TIE so
 // the id tie-break is exercised on every page boundary.
 const rows=[];for(let g=0;g<N+20;g++){const other=g>=N;rows.push({g,other,user:randomUUID(),app:randomUUID(),evaluation:randomUUID(),record:randomUUID(),doc:randomUUID(),round:other?club2Round:g%2?round2:ids.round,cycle:other?null:g%3===0?cycleA:cycleB,club:other?club2:ids.club,member:other?club2Member:ids.ownerMember,at:new Date(base-Math.floor(g/TIE)*60000).toISOString()});}
 const values=(list,fn)=>list.map(fn).join(',');
 await db.exec(`INSERT INTO "User"(id,email) VALUES ${values(rows,r=>`(${q(r.user)},'paging${r.g}@virginia.edu')`)};
  INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES ${values(rows,r=>`(${q(r.app)},${q(r.club)},${q(r.user)},${q(r.other?club2Round:ids.round)},${r.cycle?q(r.cycle):'NULL'},'INTERVIEWING')`)};
  INSERT INTO "Evaluation"(id,"applicationId","interviewerId","roundId",round,score,"submittedAt") VALUES ${values(rows,r=>`(${q(r.evaluation)},${q(r.app)},${q(r.member)},${q(r.round)},'Interview',8,${q(r.at)})`)};
  INSERT INTO "InterviewRecord"(id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","completedAt","evaluationId","updatedAt") VALUES ${values(rows,r=>`(${q(r.record)},${q(r.app)},${q(r.member)},${q(r.round)},'[]','{}',false,${q(r.at)},${q(r.evaluation)},${q(r.at)})`)};
  INSERT INTO "InterviewResumeDocument"(id,"applicationId","roundId","sourcePath","contentHash",content,"createdAt") VALUES ${values(rows,r=>`(${q(r.doc)},${q(r.app)},${q(r.round)},'x/resume.pdf','${'a'.repeat(64)}','\\x00'::bytea,${q(r.at)})`)};`);

 const expected=(key,filter=()=>true)=>rows.filter(r=>!r.other&&filter(r)).map(r=>({id:r[key],at:r.at})).sort((a,b)=>a.at<b.at?1:a.at>b.at?-1:a.id<b.id?1:a.id>b.id?-1:0).map(r=>r.id);
 seed={rows,round2,cycleA,club2,club2Round,expected};
},{timeout:180000});
after(async()=>{await h?.db.close();});
const lists=()=>[
 {name:'submitted reviews',page:reviews.getSubmittedInterviewReviewPage,key:'record',kind:'reviews',id:r=>r.id},
 {name:'résumé moderation',page:resumes.getInterviewResumeModerationPage,key:'doc',kind:'resumes',id:r=>r.documentId},
];
async function walk(list,filters={}){const pages=[];let cursor=null;do{const page=await list.page(h.ids.club,filters,cursor);pages.push(page);cursor=page.nextCursor;assert.ok(pages.length<20,'paging terminates');}while(cursor);return pages;}

test('250 items page newest first across 5 pages of 50 with ties, no duplicates or gaps',{timeout:300000},async()=>{
 h.as(h.ids.owner);
 for(const list of lists()){
  const pages=await walk(list),ids=pages.flatMap(p=>p.items.map(list.id));
  assert.deepEqual(pages.map(p=>p.items.length),[50,50,50,50,50],list.name);
  assert.ok(pages.every(p=>p.total===N),list.name+' total on every page');
  assert.equal(new Set(ids).size,N,list.name+' no duplicates');
  assert.deepEqual(ids,seed.expected(list.key),list.name+' exact order, no gaps');
  assert.equal(pages.at(-1).nextCursor,null);
  assert.ok(!ids.some(id=>seed.rows.some(r=>r.other&&r[list.key]===id)),list.name+' never includes another club');
 }
});

test('round and cycle filters run on the server across pages and total matches the filtered set',{timeout:300000},async()=>{
 h.as(h.ids.owner);
 for(const list of lists()){
  const byRound=await walk(list,{roundId:seed.round2}),want=seed.expected(list.key,r=>r.round===seed.round2);
  assert.deepEqual(byRound.flatMap(p=>p.items.map(list.id)),want,list.name+' round filter');assert.ok(byRound.every(p=>p.total===want.length));assert.deepEqual(byRound.map(p=>p.items.length),[50,50,25]);
  const byCycle=await walk(list,{cycleId:seed.cycleA}),wantCycle=seed.expected(list.key,r=>r.cycle===seed.cycleA);
  assert.deepEqual(byCycle.flatMap(p=>p.items.map(list.id)),wantCycle,list.name+' cycle filter');assert.ok(byCycle.every(p=>p.total===wantCycle.length));
  const both=await walk(list,{roundId:seed.round2,cycleId:seed.cycleA}),wantBoth=seed.expected(list.key,r=>r.round===seed.round2&&r.cycle===seed.cycleA);
  assert.deepEqual(both.flatMap(p=>p.items.map(list.id)),wantBoth);assert.equal(both[0].total,wantBoth.length);
  const one=seed.rows.find(r=>!r.other&&r.g===3),single=await list.page(h.ids.club,{applicationId:one.app},null);
  assert.deepEqual(single.items.map(list.id),[one[list.key]]);assert.equal(single.total,1);assert.equal(single.nextCursor,null);
 }
});

test('a cursor is only a position: other clubs, rounds, filters and lists are refused, and malformed cursors are refused',{timeout:300000},async()=>{
 h.as(h.ids.owner);
 for(const list of lists()){
  const first=await list.page(h.ids.club,{},null);assert.ok(first.nextCursor);
  // Same cursor under a different round filter or list.
  await assert.rejects(list.page(h.ids.club,{roundId:seed.round2},first.nextCursor),/list changed/i,list.name);
  const otherList=lists().find(l=>l.kind!==list.kind);await assert.rejects(otherList.page(h.ids.club,{},first.nextCursor),/list changed/i);
  // A cursor issued for another club cannot be replayed here, and this club's cursor cannot open the other club.
  const foreign=seed.rows.find(r=>r.other);
  await assert.rejects(list.page(h.ids.club,{},cursorLib.encodeInterviewListCursor(list.kind,cursorLib.interviewListScope(seed.club2,{}),foreign[list.key])),/list changed/i);
  await assert.rejects(list.page(seed.club2,{},first.nextCursor),/list changed/i);
  // A forged token with this request's scope but an anchor outside it resolves to nothing: refused.
  await assert.rejects(list.page(h.ids.club,{},cursorLib.encodeInterviewListCursor(list.kind,cursorLib.interviewListScope(h.ids.club,{}),foreign[list.key])),/list changed/i);
  const round1Row=seed.rows.find(r=>!r.other&&r.round===h.ids.round);
  await assert.rejects(list.page(h.ids.club,{roundId:seed.round2},cursorLib.encodeInterviewListCursor(list.kind,cursorLib.interviewListScope(h.ids.club,{roundId:seed.round2}),round1Row[list.key])),/list changed/i);
  for(const bad of ['', 'not a cursor!', 'x'.repeat(600), Buffer.from('{"v":1}').toString('base64url'), Buffer.from(JSON.stringify({v:2,k:list.kind,s:'x',i:'y'})).toString('base64url'), Buffer.from(JSON.stringify({v:1,k:list.kind,s:cursorLib.interviewListScope(h.ids.club,{}),i:"x' OR 1=1"})).toString('base64url'), Buffer.from('not json').toString('base64url'), 42, {id:foreign[list.key]}])
   await assert.rejects(list.page(h.ids.club,{},bad),/Invalid list position/,list.name+' '+JSON.stringify(bad));
 }
});

test('permission checks run on every page: losing the office refuses page 2',{timeout:300000},async()=>{
 for(const list of lists()){
  h.as(h.ids.owner);const first=await list.page(h.ids.club,{},null);assert.ok(first.nextCursor);
  h.as(h.ids.peer);await assert.rejects(list.page(h.ids.club,{},first.nextCursor),/leadership|moderation/i,list.name+' user without access');
  h.as(h.ids.owner);await h.db.query(`UPDATE "ClubMember" SET "interviewOffices"='{}' WHERE id=$1`,[h.ids.ownerMember]);
  try{await assert.rejects(list.page(h.ids.club,{},first.nextCursor),/leadership|moderation/i,list.name+' revoked between pages');}
  finally{await h.db.query(`UPDATE "ClubMember" SET "interviewOffices"='{PRESIDENT}' WHERE id=$1`,[h.ids.ownerMember]);}
  h.as(h.ids.peer);await assert.rejects(list.page(h.ids.club,{},null),/leadership|moderation/i);
 }
 h.as(h.ids.owner);
});

test('earlier array reads stay compatible and return the first page',{timeout:300000},async()=>{
 h.as(h.ids.owner);
 const legacy=await reviews.getSubmittedInterviewReviews(h.ids.club),page=await reviews.getSubmittedInterviewReviewPage(h.ids.club);
 assert.ok(Array.isArray(legacy));assert.deepEqual(legacy,page.items);
 const docs=await resumes.getInterviewResumeModerationQueue(h.ids.club);assert.deepEqual(docs,(await resumes.getInterviewResumeModerationPage(h.ids.club)).items);
});

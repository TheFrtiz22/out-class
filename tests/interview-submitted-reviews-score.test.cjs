// Submitted reviews list rows carry the round score only for viewers getInterviewRoundScore would
// answer, computed by the same summary, in a constant number of queries per page. Real server
// actions against migrated disposable PostgreSQL/WASM (tests/helpers/interview-sql-harness.cjs).
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {harness}=require('./helpers/interview-sql-harness.cjs');
const pick=s=>({average:s.average,submitted:s.submitted});
test('list score matches the detail score and never widens who sees it',{timeout:180000},async t=>{
 const h=await harness();t.after(()=>h.db.close());const i=h.ids,grants=h.load('actions/organization-members.ts'),api=h.load('actions/interview-kits.ts');
 for(const memberId of [i.panelMember,i.peerMember])await grants.setInterviewPanelAssignment({...h.scope,memberId,assigned:true});
 h.as(i.peer);const peer=await api.openInterviewSession(h.scope);await api.saveInterviewSession({...h.scope,revision:peer.revision,draft:{...peer.draft,score:7.5},complete:true});

 // Leadership not on the panel: score present and identical to the opened detail's summary.
 h.as(i.owner);let page=await api.getSubmittedInterviewReviewPage(i.club);
 assert.equal(page.items.length,1);assert.deepEqual(page.items[0].score,pick(await api.getInterviewRoundScore(h.scope)));assert.deepEqual(page.items[0].score,{average:7.5,submitted:1});
 assert.deepEqual(Object.keys(page.items[0].score).sort(),['average','submitted'],'no per-reviewer scores or assignment counts on the row');

 // Leadership who also sits on this current-round panel and has not submitted: detail refuses, list row has no score.
 await h.db.query('UPDATE "ClubMember" SET "interviewOffices"=\'{BOARD}\' WHERE id=$1',[i.panelMember]);
 h.as(i.panel);await assert.rejects(api.getInterviewRoundScore(h.scope),/Submit your own/);
 page=await api.getSubmittedInterviewReviewPage(i.club);assert.equal(page.items.length,1,'row still listed');assert.equal(page.items[0].score,null,'score withheld until own review submitted');
 const own=await api.openInterviewSession(h.scope);await api.saveInterviewSession({...h.scope,revision:own.revision,draft:{...own.draft,score:8},complete:true});
 page=await api.getSubmittedInterviewReviewPage(i.club);assert.equal(page.items.length,2);
 for(const row of page.items)assert.deepEqual(row.score,{average:7.75,submitted:2});assert.deepEqual(page.items[0].score,pick(await api.getInterviewRoundScore(h.scope)));

 // A member without leadership review access gets neither rows nor scores.
 h.as(i.peer);await assert.rejects(api.getSubmittedInterviewReviewPage(i.club),/leadership/i);

 // A recused leader: detail refuses; list rows carry no score.
 await h.db.query('INSERT INTO "ApplicantRecusal"(id,"clubId","applicationId","memberId","createdById") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),i.club,i.app,i.ownerMember,i.owner]);
 h.as(i.owner);await assert.rejects(api.getInterviewRoundScore(h.scope));
 page=await api.getSubmittedInterviewReviewPage(i.club);assert.equal(page.items.length,2);assert.ok(page.items.every(r=>r.score===null),'recused viewer sees no score');
 await h.db.query('UPDATE "ApplicantRecusal" SET "liftedAt"=now(),"liftedById"=$2 WHERE "memberId"=$1',[i.ownerMember,i.owner]);
 page=await api.getSubmittedInterviewReviewPage(i.club);assert.ok(page.items.every(r=>r.score?.average===7.75),'lifted recusal restores the score');

 // Batched: the number of queries does not grow with the rows on a page.
 const rows=Array.from({length:30},(_,g)=>({g,user:randomUUID(),app:randomUUID(),evaluation:randomUUID(),record:randomUUID(),at:new Date(Date.UTC(2026,9,1)-g*60000).toISOString()}));
 const v=(fn)=>rows.map(fn).join(',');
 await h.db.exec(`INSERT INTO "User"(id,email) VALUES ${v(r=>`('${r.user}','score${r.g}@virginia.edu')`)};
  INSERT INTO "Application"(id,"clubId","studentId","roundId",status) VALUES ${v(r=>`('${r.app}','${i.club}','${r.user}','${i.round}','INTERVIEWING')`)};
  INSERT INTO "Evaluation"(id,"applicationId","interviewerId","roundId",round,score,"submittedAt") VALUES ${v(r=>`('${r.evaluation}','${r.app}','${i.ownerMember}','${i.round}','Interview',${r.g%2?9:6.5},'${r.at}')`)};
  INSERT INTO "InterviewRecord"(id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","completedAt","evaluationId","updatedAt") VALUES ${v(r=>`('${r.record}','${r.app}','${i.ownerMember}','${i.round}','[]','{}',false,'${r.at}','${r.evaluation}','${r.at}')`)};`);
 // The harness resolves nested relations row by row (Prisma joins them), so count only the
 // round-score tables: the same three batched reads whatever the page size, never one per row.
 const original=h.db.transaction.bind(h.db);
 const scoreReads=async limit=>{const seen=[];h.db.transaction=fn=>original(client=>fn(new Proxy(client,{get:(c,k)=>k==='query'?(sql,...a)=>{const m=/FROM "(ApplicantRecusal|Evaluation|InterviewPanelAssignment)" t /.exec(sql);if(m)seen.push(m[1]);return c.query(sql,...a);}:c[k]})));try{return{page:await api.getSubmittedInterviewReviewPage(i.club,{},null,limit),seen};}finally{h.db.transaction=original;}};
 const small=await scoreReads(2),large=await scoreReads(32);
 assert.equal(large.page.items.length,32);assert.ok(large.page.items.every(r=>r.score&&r.score.submitted>=1));
 assert.deepEqual(small.seen,['ApplicantRecusal','Evaluation','InterviewPanelAssignment']);assert.deepEqual(large.seen,small.seen,'score reads are batched per page');
});

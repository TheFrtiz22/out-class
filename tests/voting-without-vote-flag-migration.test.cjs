const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
const dir='prisma/migrations',target='20261109150000_voting_without_vote_flag';
const sql=n=>fs.readFileSync(path.join(dir,n,'migration.sql'),'utf8');

test('withoutVote records Pass and Do not pass decided with no ballot, refuses ballots, and Undo still resets it',{timeout:240000},async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
  for(const n of fs.readdirSync(dir).filter(n=>n<target&&fs.existsSync(path.join(dir,n,'migration.sql'))).sort())await db.exec(sql(n));
  await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu'),('voter','voter@virginia.edu');
   INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other');
   INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('mem','club','voter','GENERAL_MEMBER');
   INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);`);
  // One started LIVE room per scenario; applicant ids are <room>_<i>.
  const room=async(id,n)=>{
   const apps=[...Array(n).keys()].map(i=>`${id}_${i}`);
   await db.exec(`${apps.map(a=>`INSERT INTO "User"(id,email) VALUES('u_${a}','${a}@virginia.edu'); INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('${a}','club','u_${a}','round','cycle','IN_REVIEW');`).join('\n')}
    INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('${id}','club','round','cycle','LIVE',ARRAY['lead'],1,'owner',NOW());
    ${apps.map((a,i)=>`INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('${id}','${a}',${i},'IN_REVIEW');`).join('\n')}
    INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('${id}','lead'),('${id}','mem');
    INSERT INTO "VotingPass"("sessionId",number) VALUES('${id}',1);
    ${apps.map((a,i)=>`INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES('${id}',1,'${a}',${i});`).join('\n')}
    UPDATE "VotingSession" SET state='OPEN',"currentPass"=1,"activeApplicationId"='${apps[0]}',"startedAt"=NOW(),"joinOpenedAt"=NOW() WHERE id='${id}';`);
   return apps;
  };
  const where=a=>`"passNumber"=1 AND "applicationId"='${a}'`;
  const row=async a=>(await db.query(`SELECT "ballotState","withoutVote","confirmedDecision","openedAt","closedAt",override FROM "VotingPassCandidate" WHERE ${where(a)}`)).rows[0];
  const active=(id,a)=>db.exec(`UPDATE "VotingSession" SET "activeApplicationId"='${a}' WHERE id='${id}'`);
  const open=a=>db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='OPEN',"openedAt"=NOW()-interval '1 minute' WHERE ${where(a)}`);
  const decide=(a,decision,extra='')=>`UPDATE "VotingPassCandidate" SET "ballotState"='CONFIRMED',"withoutVote"=true,"confirmedDecision"='${decision}',"confirmedBy"='owner',"confirmedAt"=NOW(),override='${decision}',"overrideBy"='owner',"overrideAt"=NOW()${extra} WHERE ${where(a)}`;
  const ballot=(id,a,n)=>db.exec(`INSERT INTO "VotingBallot"(id,"sessionId","passNumber","applicationId","memberId",decision) VALUES('${n}','${id}',1,'${a}','mem','PASS')`);
  const rejectsTx=async(body,re)=>{await assert.rejects(db.exec(`BEGIN; ${body}; COMMIT;`),re);await db.exec('ROLLBACK');};
  const undo=async(id,a,request)=>{
   const rev=(await db.query(`SELECT revision FROM "VotingSession" WHERE id='${id}'`)).rows[0].revision;
   await db.exec(`INSERT INTO "AuditLog"(id,"actorId",action,"targetId","clubId",details) VALUES('${request}','owner','voting.room.undo_authorized','${id}','club','{"requestId":"${request}","applicationId":"${a}","passNumber":1,"revision":${rev}}')`);
   return body=>`SELECT set_config('outclass.voting_undo','${request}',true); ${body}`;
  };
  const resetTo=(a,state,flag=false)=>`UPDATE "VotingPassCandidate" SET "ballotState"='${state}',"withoutVote"=${flag},"confirmedDecision"=NULL,"confirmedBy"=NULL,"confirmedAt"=NULL,override=NULL,"overrideBy"=NULL,"overrideAt"=NULL WHERE ${where(a)}`;

  // Rows written under the previous rules: Pass without vote, and one later corrected to Hold.
  const pre=await room('pre',2);
  await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='CONFIRMED',"withoutVote"=true,"confirmedDecision"='PASS',"confirmedBy"='owner',"confirmedAt"=NOW() WHERE ${where(pre[0])}`);
  await active('pre',pre[1]);
  await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='CONFIRMED',"withoutVote"=true,"confirmedDecision"='PASS',"confirmedBy"='owner',"confirmedAt"=NOW() WHERE ${where(pre[1])};
   UPDATE "VotingPassCandidate" SET "confirmedDecision"='HOLD' WHERE ${where(pre[1])}`);
  // The old guard refused Do not pass without vote; this is the live defect.
  const old=await room('old',1);
  await assert.rejects(db.exec(decide(old[0],'NOT_PASS')),/Invalid ballot transition|live_state/);
  const fn=`SELECT p.prosecdef,p.proconfig,p.proacl::text acl FROM pg_proc p WHERE p.proname='outclass_live_voting_entry_guard'`;
  const acl=`SELECT relacl::text acl FROM pg_class WHERE relname='VotingPassCandidate'`,policies=`SELECT count(*)::int n FROM pg_policies`;
  const before={fn:(await db.query(fn)).rows,acl:(await db.query(acl)).rows,policies:(await db.query(policies)).rows};

  await db.exec(sql(target));
  const after={fn:(await db.query(fn)).rows,acl:(await db.query(acl)).rows,policies:(await db.query(policies)).rows};
  assert.deepEqual(after,before,'SECURITY INVOKER, pinned search_path, function and table ACLs and policies unchanged');
  assert.equal(after.fn[0].prosecdef,false);assert.deepEqual(after.fn[0].proconfig,['search_path=pg_catalog, public']);
  assert.equal((await db.query(`SELECT convalidated FROM pg_constraint WHERE conname='VotingPassCandidate_live_state'`)).rows[0].convalidated,true);
  assert.deepEqual([(await row(pre[0])).confirmedDecision,(await row(pre[0])).withoutVote,(await row(pre[1])).confirmedDecision,(await row(pre[1])).withoutVote],['PASS',true,'HOLD',true],'existing rows unchanged');

  const r=await room('live',7);
  // Pass without vote with no ballots, from pending: flag set, no invented times.
  await db.exec(decide(r[0],'PASS'));
  assert.deepEqual(await row(r[0]),{ballotState:'CONFIRMED',withoutVote:true,confirmedDecision:'PASS',openedAt:null,closedAt:null,override:'PASS'});
  // Do not pass without vote, from pending.
  await active('live',r[1]);await db.exec(decide(r[1],'NOT_PASS'));
  assert.deepEqual([(await row(r[1])).withoutVote,(await row(r[1])).confirmedDecision,(await row(r[1])).openedAt],[true,'NOT_PASS',null]);
  // Voting opened, zero ballots: flag set, real openedAt kept, closedAt recorded.
  await active('live',r[2]);await open(r[2]);const opened=(await row(r[2])).openedAt;
  await rejectsTx(decide(r[2],'NOT_PASS'),/live_state/);// closedAt is required once voting was opened
  await db.exec(decide(r[2],'NOT_PASS',`,"closedAt"=NOW()`));
  const o=await row(r[2]);assert.equal(o.withoutVote,true);assert.deepEqual(o.openedAt,opened);assert.ok(o.closedAt>=o.openedAt);
  // Any ballot for that applicant in that pass forbids the flag, directly or via close-then-confirm.
  await active('live',r[3]);await open(r[3]);await ballot('live',r[3],'b3');
  await rejectsTx(decide(r[3],'PASS',`,"closedAt"=NOW()`),/Invalid ballot transition/);
  await rejectsTx(`UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW() WHERE ${where(r[3])}; ${decide(r[3],'PASS')}`,/Invalid ballot transition/);
  await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW() WHERE ${where(r[3])}; ${decide(r[3],'NOT_PASS').replace(`"withoutVote"=true,`,'')}`);
  assert.deepEqual([(await row(r[3])).withoutVote,(await row(r[3])).override],[false,'NOT_PASS'],'override after ballots keeps the flag false');
  assert.equal((await db.query(`SELECT count(*)::int n FROM "VotingBallot" WHERE "sessionId"='live'`)).rows[0].n,1,'no ballots fabricated or removed');
  // Hold is never decided without a vote; times cannot be invented; only the active applicant; a vote that ran (CLOSED) is confirmed normally.
  await active('live',r[4]);
  await rejectsTx(decide(r[4],'HOLD'),/Invalid ballot transition/);
  await rejectsTx(decide(r[4],'PASS',`,"openedAt"=NOW()-interval '1 minute',"closedAt"=NOW()`),/Invalid ballot transition/);
  await rejectsTx(decide(r[5],'PASS'),/Invalid ballot transition/);
  await open(r[4]);await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW() WHERE ${where(r[4])}`);
  await rejectsTx(decide(r[4],'PASS'),/Invalid ballot transition/);
  // A paused room accepts no decision without a vote.
  await active('live',r[5]);await db.exec(`UPDATE "VotingSession" SET state='PAUSED' WHERE id='live'`);
  await rejectsTx(decide(r[5],'NOT_PASS'),/Invalid ballot transition/);
  await db.exec(`UPDATE "VotingSession" SET state='OPEN' WHERE id='live'`);
  // A flagged outcome cannot be unflagged in place; Correct to Hold keeps the original method.
  await rejectsTx(`UPDATE "VotingPassCandidate" SET "withoutVote"=false WHERE ${where(r[1])}`,/Invalid ballot transition/);
  await db.exec(`UPDATE "VotingPassCandidate" SET "confirmedDecision"='HOLD',override=NULL WHERE ${where(r[1])}`);
  assert.deepEqual([(await row(r[1])).withoutVote,(await row(r[1])).confirmedDecision],[true,'HOLD']);
  // Inserting a flagged row is still refused.
  await rejectsTx(`INSERT INTO "VotingPass"("sessionId",number) VALUES('pre',2); INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position,"withoutVote") VALUES('pre',2,'${pre[0]}',0,true)`,/must confirm a pending instance|frozen/);

  // Undo of a never-opened Do not pass without vote: back to PENDING with the flag cleared.
  const u=await room('undo',2);
  await db.exec(decide(u[0],'NOT_PASS'));await active('undo',u[1]);
  const asUndo=await undo('undo',u[0],'undo-1');
  await rejectsTx(asUndo(resetTo(u[0],'PENDING',true)),/Invalid ballot transition|live_state/);
  await rejectsTx(asUndo(resetTo(u[0],'CLOSED')),/Invalid ballot transition|live_state/);
  await rejectsTx(resetTo(u[0],'PENDING'),/Invalid ballot transition/);// no authorized Undo request
  await db.exec(`BEGIN; ${asUndo(resetTo(u[0],'PENDING'))}; COMMIT;`);
  assert.deepEqual(await row(u[0]),{ballotState:'PENDING',withoutVote:false,confirmedDecision:null,openedAt:null,closedAt:null,override:null});
  // Undo of a decision made after voting opened with zero ballots: back to CLOSED with its real times.
  const v=await room('undo_open',2);
  await open(v[0]);await db.exec(decide(v[0],'PASS',`,"closedAt"=NOW()`));const times=await row(v[0]);await active('undo_open',v[1]);
  const asUndo2=await undo('undo_open',v[0],'undo-2');
  await rejectsTx(asUndo2(resetTo(v[0],'PENDING')),/Invalid ballot transition|live_state/);
  await db.exec(`BEGIN; ${asUndo2(resetTo(v[0],'CLOSED'))}; COMMIT;`);
  const back=await row(v[0]);assert.deepEqual([back.ballotState,back.withoutVote,back.confirmedDecision],['CLOSED',false,null]);assert.deepEqual([back.openedAt,back.closedAt],[times.openedAt,times.closedAt]);
  // Undo of a pre-migration Pass without vote behaves as before.
  await db.exec(`UPDATE "VotingSession" SET "activeApplicationId"=NULL WHERE id='pre'`);
  const asUndo3=await undo('pre',pre[1],'undo-3');
  await db.exec(`BEGIN; ${asUndo3(resetTo(pre[1],'PENDING'))}; COMMIT;`);
  assert.deepEqual([(await row(pre[1])).ballotState,(await row(pre[1])).withoutVote],['PENDING',false]);
 }finally{await db.close();}
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
const dir='prisma/migrations',target='20261117090000_voting_open_electorate';
const sql=n=>fs.readFileSync(path.join(dir,n,'migration.sql'),'utf8');

test('open-electorate sessions take late joiners and a closing snapshot; saved-list sessions keep the frozen roster',{timeout:240000},async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
  for(const n of fs.readdirSync(dir).filter(n=>n<target&&fs.existsSync(path.join(dir,n,'migration.sql'))).sort())await db.exec(sql(n));
  await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu'),('early','early@virginia.edu'),('late','late@virginia.edu'),('other','other@virginia.edu'),('applicant','applicant@virginia.edu');
   INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'),('club2','club2','QA2','','','#142d45','Other');
   INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('early','club','early','GENERAL_MEMBER'),('late','club','late','GENERAL_MEMBER'),('foreign','club2','other','GENERAL_MEMBER');
   INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);
   INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('app','club','applicant','round','cycle','IN_REVIEW');`);
  const rule=JSON.stringify({mode:'THRESHOLD',threshold:{numerator:1,denominator:2},denominator:'ELIGIBLE_VOTERS',minimumParticipation:{numerator:1,denominator:2},belowThreshold:'HOLD',reviewed:true});
  // One room per scenario, started with its first applicant open. `open` marks the open electorate.
  const room=async(id,open)=>db.exec(`INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt","presentationOptions") VALUES('${id}','club','round','cycle','LIVE',ARRAY['lead'],1,'owner',NOW(),'${open?'{"electorate":"OPEN"}':'{}'}');
    INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('${id}','app',0,'IN_REVIEW');
    INSERT INTO "VotingParticipant"("sessionId","memberId","joinedAt") VALUES('${id}','lead',NOW()),('${id}','early',${open?'NOW()':'NULL'});
    INSERT INTO "VotingPass"("sessionId",number) VALUES('${id}',1);
    INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES('${id}',1,'app',0);
    UPDATE "VotingSession" SET state='OPEN',"currentPass"=1,"activeApplicationId"='app',"startedAt"=NOW(),"joinOpenedAt"=NOW() WHERE id='${id}';
    UPDATE "VotingPassCandidate" SET "ballotState"='OPEN',"openedAt"=NOW() WHERE "sessionId"='${id}';`);
  const join=(id,member,at='NOW()')=>db.exec(`INSERT INTO "VotingParticipant"("sessionId","memberId","joinedAt") VALUES('${id}','${member}',${at})`);
  const snap=(id,v,electorate,reason=null,r=rule)=>db.query(`INSERT INTO "VotingBallotRule"("sessionId","passNumber","applicationId",version,rules,electorate,reason,"createdBy") VALUES($1,1,'app',$2,$3::jsonb,$4,$5,'owner')`,[id,v,r,electorate,reason]);
  const ballot=(id,member)=>db.exec(`INSERT INTO "VotingBallot"(id,"sessionId","passNumber","applicationId","memberId",decision) VALUES('${id}-${member}','${id}',1,'app','${member}','PASS')`);

  await room('before',true);
  // Before the migration even an open session's roster is frozen once started.
  await assert.rejects(join('before','late'),/frozen/);
  const fns=`SELECT proname,prosecdef,proconfig,proacl::text acl,proowner FROM pg_proc WHERE proname IN ('outclass_live_voting_roster_guard','outclass_voting_ballot_rule_guard') ORDER BY proname`;
  const acl=`SELECT relname,relacl::text acl,relrowsecurity FROM pg_class WHERE relname IN ('VotingParticipant','VotingBallotRule','VotingSession') ORDER BY relname`;
  const policies=`SELECT tablename,policyname FROM pg_policies ORDER BY 1,2`,triggers=`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1`;
  const columns=`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY 1,2`;
  const before={fns:(await db.query(fns)).rows,acl:(await db.query(acl)).rows,policies:(await db.query(policies)).rows,triggers:(await db.query(triggers)).rows,columns:(await db.query(columns)).rows};

  await db.exec(sql(target));
  const after={fns:(await db.query(fns)).rows,acl:(await db.query(acl)).rows,policies:(await db.query(policies)).rows,triggers:(await db.query(triggers)).rows,columns:(await db.query(columns)).rows};
  assert.deepEqual(after,before,'function bodies only: owners, SECURITY INVOKER, pinned search_path, ACLs, RLS, policies, triggers and columns unchanged');
  for(const f of after.fns){assert.equal(f.prosecdef,false);assert.deepEqual(f.proconfig,['search_path=pg_catalog, public']);}

  // Open session: a late joiner is added as a join; an unjoined row, a foreign member or a moved join time are refused.
  await join('before','late');
  await assert.rejects(db.exec(`INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('before','early2')`),/frozen|scope|foreign key/i);
  await room('open',true);
  await assert.rejects(join('open','late','NULL'),/frozen/);
  await assert.rejects(join('open','foreign'),/scope mismatch|foreign key/i);
  await assert.rejects(db.exec(`UPDATE "VotingParticipant" SET "joinedAt"=NOW()-interval '1 hour' WHERE "sessionId"='open' AND "memberId"='early'`),/join time cannot change/);
  await assert.rejects(db.exec(`DELETE FROM "VotingParticipant" WHERE "sessionId"='open' AND "memberId"='early'`),/frozen/);

  // Ballot rules in an open session name only members who joined, once each.
  await assert.rejects(snap('open',1,['lead','late']),/only members who joined/);
  await assert.rejects(snap('open',1,['lead','lead']),/only members who joined/);
  await snap('open',1,['early','lead']);
  await ballot('open','early');
  await join('open','late');await ballot('open','late');
  // The closing snapshot keeps the rule and gives a reason, and may add anyone who joined after voting opened.
  await assert.rejects(snap('open',2,['early','late','lead']),/keep the rule and give a reason/);
  await assert.rejects(snap('open',2,['early','late','lead'],'Members in the room when voting closed',JSON.stringify({mode:'LEADER_CONFIRMS'})),/keep the rule and give a reason/);
  await assert.rejects(snap('open',2,['early','late','lead','foreign'],'Members in the room when voting closed'),/only members who joined/);
  await snap('open',2,['early','late','lead'],'Members in the room when voting closed');
  assert.deepEqual((await db.query(`SELECT version,electorate FROM "VotingBallotRule" WHERE "sessionId"='open' ORDER BY version`)).rows.map(r=>[r.version,r.electorate]),[[1,['early','lead']],[2,['early','late','lead']]]);
  // Once the ballot closes, nothing about who counted can change, and nobody joins a completed session.
  await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW() WHERE "sessionId"='open'`);
  await assert.rejects(snap('open',3,['early','late','lead'],'again'),/only while that ballot is open/);
  await assert.rejects(db.exec(`UPDATE "VotingBallotRule" SET electorate=ARRAY['lead'] WHERE "sessionId"='open'`),/immutable/);
  await db.exec(`UPDATE "VotingSession" SET state='COMPLETED',"endedAt"=NOW() WHERE id='open'`);
  await db.exec(`INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('later','club','applicant','GENERAL_MEMBER')`);
  await assert.rejects(join('open','later'),/frozen/);

  // Saved-list (legacy) session: unchanged. No joins after start; resolutions only remove voters, with a reason.
  await room('legacy',false);
  await assert.rejects(join('legacy','late'),/frozen/);
  // A started saved-list session cannot be switched to the open electorate (the existing presentation lock).
  await assert.rejects(db.exec(`UPDATE "VotingSession" SET "presentationOptions"='{"electorate":"OPEN"}' WHERE id='legacy'`),/presentation setup is locked/);
  await db.exec(`UPDATE "VotingParticipant" SET "joinedAt"=NOW() WHERE "sessionId"='legacy' AND "memberId"='early'`);
  await snap('legacy',1,['early','lead']);
  await assert.rejects(snap('legacy',2,['early','late','lead'],'add'),/only remove voters/);
  await assert.rejects(snap('legacy',2,['lead']),/only remove voters/);
  await snap('legacy',2,['lead'],'Lost voting access');
 }finally{await db.close();}
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
const dir='prisma/migrations',target='20261111120000_voting_setup_edit_prepared';
const sql=n=>fs.readFileSync(path.join(dir,n,'migration.sql'),'utf8');
const flag=`SELECT set_config('outclass.voting_setup_edit','confirmed',true);`;

test('a confirmed unstarted setup edit can renumber kept applicants and discard removed applicants prepared slides; everything else stays refused',{timeout:240000},async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
  for(const n of fs.readdirSync(dir).filter(n=>n<target&&fs.existsSync(path.join(dir,n,'migration.sql'))).sort())await db.exec(sql(n));
  await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu');
   INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other');
   INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT');
   INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);`);
  // One LIVE room with three applicants <id>_0.._2, each with a prepared slide.
  const room=async id=>{
   const apps=[0,1,2].map(i=>`${id}_${i}`);
   await db.exec(`${apps.map(a=>`INSERT INTO "User"(id,email) VALUES('u_${a}','${a}@virginia.edu'); INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('${a}','club','u_${a}','round','cycle','IN_REVIEW');`).join('\n')}
    INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('${id}','club','round','cycle','LIVE',ARRAY['lead'],1,'owner',NOW());
    ${apps.map((a,i)=>`INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('${id}','${a}',${i},'IN_REVIEW');
    INSERT INTO "VotingSlidePreparation"("sessionId","applicationId",highlights,"updatedBy") VALUES('${id}','${a}','[{"id":"h${i}"}]','owner');`).join('\n')}`);
   return apps;
  };
  const start=id=>db.exec(`INSERT INTO "VotingPass"("sessionId",number) VALUES('${id}',1); UPDATE "VotingSession" SET state='OPEN',"currentPass"=1,"startedAt"=NOW(),"joinOpenedAt"=NOW() WHERE id='${id}';`);
  const rejectsTx=async(body,re)=>{await assert.rejects(db.exec(`BEGIN; ${body}; COMMIT;`),re);await db.exec('ROLLBACK');};
  const reorder=(id,a)=>`UPDATE "VotingCandidate" SET position=position+100 WHERE "sessionId"='${id}'; UPDATE "VotingCandidate" SET position=0,"expectedStatus"='WAITLISTED' WHERE "sessionId"='${id}' AND "applicationId"='${a}'`;
  // Each discard names its applicant in the removal list, so refusals below come from the flag or session state.
  const removing=ids=>`SELECT set_config('outclass.voting_setup_discard','${ids.join(',')}',true);`;
  const remove=(id,a)=>`DELETE FROM "VotingSlidePreparation" WHERE "sessionId"='${id}' AND "applicationId"='${a}'`,discard=(id,a)=>`${removing([a])} ${remove(id,a)}`;
  const candidates=async id=>(await db.query(`SELECT "applicationId",position,"expectedStatus" FROM "VotingCandidate" WHERE "sessionId"='${id}' ORDER BY position`)).rows;
  const prepared=async id=>(await db.query(`SELECT "applicationId",highlights,revision FROM "VotingSlidePreparation" WHERE "sessionId"='${id}' ORDER BY "applicationId"`)).rows;

  // Negative control: before the migration the edit that setup needs is refused even under the flag.
  const ctl=await room('ctl');
  await rejectsTx(`${flag} ${discard('ctl',ctl[1])}`,/history is retained/);
  await rejectsTx(`${flag} ${reorder('ctl',ctl[2])}`,/Replace the unstarted candidate selection explicitly/);
  // The reported defect: delete-and-recreate trips the RESTRICT foreign key.
  await rejectsTx(`${flag} DELETE FROM "VotingCandidate" WHERE "sessionId"='ctl'`,/foreign key/);

  const fns=`SELECT proname,prosecdef,proconfig,proowner,proacl::text acl,prosrc FROM pg_proc WHERE proname IN ('outclass_voting_candidate_setup_guard','outclass_voting_slide_preparation_guard') ORDER BY proname`;
  const acl=`SELECT relname,relowner,relacl::text acl,relrowsecurity FROM pg_class WHERE relname IN ('VotingCandidate','VotingSlidePreparation','VotingSlideLock') ORDER BY relname`;
  const policies=`SELECT tablename,policyname,cmd,roles::text,qual,with_check FROM pg_policies ORDER BY tablename,policyname`;
  const constraints=`SELECT conname,confdeltype,confupdtype FROM pg_constraint WHERE conrelid='"VotingSlidePreparation"'::regclass ORDER BY conname`;
  const triggers=`SELECT tgname,tgrelid::regclass::text rel,tgtype FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('"VotingCandidate"'::regclass,'"VotingSlidePreparation"'::regclass) ORDER BY tgname`;
  const snapshot=async()=>{const f=(await db.query(fns)).rows;return {fn:f.map(({prosrc,...r})=>r),acl:(await db.query(acl)).rows,policies:(await db.query(policies)).rows,constraints:(await db.query(constraints)).rows,triggers:(await db.query(triggers)).rows};};
  const privs=`SELECT r.rolname,t.relname,p.priv,has_table_privilege(r.rolname,format('%I',t.relname),p.priv) ok FROM (VALUES ('anon'),('authenticated'),('outclass_production_app')) r(rolname) CROSS JOIN (VALUES ('VotingCandidate'),('VotingSlidePreparation'),('VotingSlideLock')) t(relname) CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv) ORDER BY 1,2,3`;
  const granted=async()=>(await db.query(privs)).rows.filter(r=>r.ok).map(r=>`${r.rolname}:${r.relname}:${r.priv}`);
  const before=await snapshot(),bodies=(await db.query(fns)).rows.map(r=>r.prosrc),grantsBefore=await granted();

  await db.exec(sql(target));
  const after=await snapshot(),grantsAfter=await granted();
  const runtimeDelete={tablename:'VotingSlidePreparation',policyname:'voting_slide_preparation_runtime_delete',cmd:'DELETE',roles:'{outclass_production_app}',qual:'true',with_check:null};
  assert.deepEqual(after.policies,[...before.policies,runtimeDelete].sort((a,b)=>a.tablename.localeCompare(b.tablename)||a.policyname.localeCompare(b.policyname)),'exactly one new policy: runtime DELETE on VotingSlidePreparation');
  assert.deepEqual(grantsAfter,[...grantsBefore,'outclass_production_app:VotingSlidePreparation:DELETE'].sort(),'exactly one new grant: runtime DELETE on VotingSlidePreparation');
  assert.ok(!grantsAfter.some(g=>/^(anon|authenticated):/.test(g)),'nothing for browser roles');
  assert.equal((await db.query(`SELECT has_table_privilege('public','"VotingSlidePreparation"','DELETE') d`).catch(()=>({rows:[{d:false}]}))).rows[0].d,false);
  const prepAcl=a=>a.acl.find(r=>r.relname==='VotingSlidePreparation');
  assert.deepEqual({...after,policies:null,acl:after.acl.filter(r=>r.relname!=='VotingSlidePreparation')},{...before,policies:null,acl:before.acl.filter(r=>r.relname!=='VotingSlidePreparation')},'SECURITY, search_path, owners, function ACLs, other table ACLs, RLS, FK actions and triggers unchanged');
  assert.deepEqual({...prepAcl(after),acl:null},{...prepAcl(before),acl:null},'owner and RLS of VotingSlidePreparation unchanged');
  for(const f of after.fn){assert.equal(f.prosecdef,false,f.proname);assert.deepEqual(f.proconfig,['search_path=pg_catalog, public'],f.proname);}
  assert.notDeepEqual((await db.query(fns)).rows.map(r=>r.prosrc),bodies,'bodies replaced');
  assert.deepEqual(after.constraints.filter(c=>c.confdeltype!==' ').map(c=>c.confdeltype),['r'],'RESTRICT foreign key kept');
  assert.equal((await db.query(`SELECT has_table_privilege('anon','"VotingSlidePreparation"','DELETE') d`)).rows[0].d,false);

  // Under the flag, unstarted: discard a removed applicant's slide and candidate, renumber and re-snapshot the kept ones.
  const r=await room('edit');
  await db.exec(`BEGIN; ${flag} ${discard('edit',r[1])}; DELETE FROM "VotingCandidate" WHERE "sessionId"='edit' AND "applicationId"='${r[1]}';
   UPDATE "VotingCandidate" SET position=position+100 WHERE "sessionId"='edit';
   UPDATE "VotingCandidate" c SET position=v.position,"expectedStatus"=v.status::"AppStatus" FROM (VALUES ('${r[2]}',0,'WAITLISTED'),('${r[0]}',1,'IN_REVIEW')) v("applicationId",position,status) WHERE c."sessionId"='edit' AND c."applicationId"=v."applicationId";
   INSERT INTO "User"(id,email) VALUES('u_new','new@virginia.edu'); INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('edit_new','club','u_new','round','cycle','IN_REVIEW');
   INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('edit','edit_new',2,'IN_REVIEW'); COMMIT;`);
  assert.deepEqual(await candidates('edit'),[{applicationId:r[2],position:0,expectedStatus:'WAITLISTED'},{applicationId:r[0],position:1,expectedStatus:'IN_REVIEW'},{applicationId:'edit_new',position:2,expectedStatus:'IN_REVIEW'}]);
  assert.deepEqual((await prepared('edit')).map(p=>[p.applicationId,p.highlights[0].id,p.revision]),[[r[0],'h0',1],[r[2],'h2',1]],'kept highlights untouched');
  // Production ownership: the runtime role owns the session tables; preparations stay postgres-owned with SELECT/INSERT/UPDATE only.
  await db.exec(`ALTER TABLE "VotingSession" OWNER TO outclass_production_app; ALTER TABLE "VotingCandidate" OWNER TO outclass_production_app; ALTER TABLE "VotingPass" OWNER TO outclass_production_app;`);
  await db.exec(`BEGIN; SET LOCAL ROLE outclass_production_app; ${flag} ${reorder('edit',r[0])}; COMMIT;`);
  assert.equal((await candidates('edit'))[0].applicationId,r[0],'the runtime role can renumber kept applicants');
  // The runtime role can discard a removed applicant's preparation only through the guard's narrow path.
  const asApp=body=>`SET LOCAL ROLE outclass_production_app; ${body}`;
  await rejectsTx(asApp(discard('edit',r[2])),/history is retained/);
  await db.exec(`BEGIN; ${asApp(`${flag} ${discard('edit',r[2])}; DELETE FROM "VotingCandidate" WHERE "sessionId"='edit' AND "applicationId"='${r[2]}'`)}; COMMIT;`);
  assert.deepEqual((await prepared('edit')).map(p=>p.applicationId),[r[0]],'runtime discard removed only that applicant');
  const ra=await room('runtime_started');await start('runtime_started');
  await rejectsTx(asApp(`${flag} ${discard('runtime_started',ra[0])}`),/history is retained/);
  assert.equal((await prepared('runtime_started')).length,3);

  // Under the flag the candidate's identity and publication stay fixed.
  await rejectsTx(`${flag} UPDATE "VotingCandidate" SET "publishedStatus"='ACCEPTED' WHERE "sessionId"='edit' AND "applicationId"='${r[0]}'`,/Replace the unstarted candidate selection explicitly/);
  await rejectsTx(`${flag} UPDATE "VotingCandidate" SET "applicationId"='edit_new' WHERE "sessionId"='edit' AND "applicationId"='${r[0]}'`,/Replace the unstarted candidate selection explicitly/);
  // A stray candidate delete with its preparation still present fails on the RESTRICT foreign key.
  await rejectsTx(`${flag} DELETE FROM "VotingCandidate" WHERE "sessionId"='edit' AND "applicationId"='${r[0]}'`,/foreign key/);

  // Without the flag both stay refused.
  await rejectsTx(discard('edit',r[0]),/history is retained/);
  // Under the flag, only applicants in the removal list: a kept applicant's preparation is refused, as is an empty or missing list.
  await rejectsTx(`${flag} ${removing(['edit_new',r[1]])} ${remove('edit',r[0])}`,/history is retained/);
  await rejectsTx(`${flag} ${removing([])} ${remove('edit',r[0])}`,/history is retained/);
  await rejectsTx(`${flag} ${remove('edit',r[0])}`,/history is retained/);
  await rejectsTx(`${flag} ${removing([`${r[0]}x`,`x${r[0]}`])} ${remove('edit',r[0])}`,/history is retained/);
  await assert.rejects(db.exec(reorder('edit',r[2])),/frozen/);
  await rejectsTx(`SELECT set_config('outclass.voting_setup_edit','yes',true); ${discard('edit',r[0])}`,/history is retained/);

  // A pass that exists before start, and a started session: refused even with the flag; history kept.
  const p=await room('pass');
  await db.exec(`INSERT INTO "VotingPass"("sessionId",number) VALUES('pass',1)`);
  await rejectsTx(`${flag} ${discard('pass',p[0])}`,/history is retained/);
  await rejectsTx(`${flag} ${reorder('pass',p[1])}`,/frozen/);
  const st=await room('started');
  await start('started');
  await rejectsTx(`${flag} ${discard('started',st[0])}`,/history is retained/);
  await rejectsTx(`${flag} ${reorder('started',st[1])}`,/frozen/);
  await rejectsTx(`${flag} DELETE FROM "VotingCandidate" WHERE "sessionId"='started'`,/frozen|foreign key/);
  assert.equal((await prepared('started')).length,3);assert.equal((await prepared('pass')).length,3);
  // Locked slides remain immutable.
  await db.exec(`INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES('started',1,'${st[0]}',0);
   INSERT INTO "VotingSlideLock"("sessionId","passNumber","applicationId",highlights,"preparationRevision") VALUES('started',1,'${st[0]}','[{"id":"h0"}]',1);`);
  await rejectsTx(`${flag} DELETE FROM "VotingSlideLock" WHERE "sessionId"='started'`,/immutable/);
  // Inserts and edits of preparations follow the unchanged rules.
  await assert.rejects(db.exec(`UPDATE "VotingSlidePreparation" SET highlights='[]' WHERE "sessionId"='edit' AND "applicationId"='${r[0]}'`),/concurrently/);
  await db.exec(`UPDATE "VotingSlidePreparation" SET highlights='[]',revision=2 WHERE "sessionId"='edit' AND "applicationId"='${r[0]}'`);
  // A completed (cancelled) session that never started is not a setup edit either.
  const c=await room('done');
  await db.exec(`UPDATE "VotingSession" SET state='COMPLETED',"endedAt"=NOW() WHERE id='done'`);
  await rejectsTx(`${flag} ${discard('done',c[0])}`,/history is retained/);
  await rejectsTx(`${flag} ${reorder('done',c[1])}`,/frozen/);
 }finally{await db.close();}
});

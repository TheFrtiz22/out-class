const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('migrated invoker session view preserves base ACLs, RLS and locking without Auth schema usage',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE outclass_production_app;
 CREATE SCHEMA auth;CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz,updated_at timestamptz);
 INSERT INTO auth.sessions VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',NULL,NOW());
 ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
 CREATE POLICY session_read ON auth.sessions FOR SELECT TO outclass_production_app USING(true);
 CREATE POLICY session_lock ON auth.sessions FOR UPDATE TO outclass_production_app USING(true) WITH CHECK(false);
 CREATE POLICY session_no_write ON auth.sessions AS RESTRICTIVE FOR UPDATE TO outclass_production_app USING(true) WITH CHECK(false);
 GRANT SELECT(id,user_id,not_after),UPDATE(updated_at) ON auth.sessions TO outclass_production_app;`);
 await db.exec(fs.readFileSync('prisma/migrations/20261019175843_outclass_auth_session_view/migration.sql','utf8'));
 const before=(await db.query('SELECT * FROM auth.sessions')).rows;
 await db.exec('SET ROLE outclass_production_app');
 await assert.rejects(db.query('SELECT id FROM public.outclass_auth_sessions'),/permission denied/);
 await db.exec('RESET ROLE;GRANT SELECT,UPDATE(id) ON public.outclass_auth_sessions TO outclass_production_app;SET ROLE outclass_production_app');
 assert.equal((await db.query("SELECT has_schema_privilege(current_user,'auth','USAGE') AS allowed")).rows[0].allowed,false);
 assert.equal((await db.query('SELECT id FROM public.outclass_auth_sessions WHERE not_after IS NULL FOR SHARE')).rows.length,1);
 for(const sql of ['SELECT id FROM auth.sessions','UPDATE public.outclass_auth_sessions SET id=id','DELETE FROM public.outclass_auth_sessions'])await assert.rejects(db.exec(sql),/permission denied|row-level security/);
 await db.exec('RESET ROLE;REVOKE SELECT(id) ON auth.sessions FROM outclass_production_app;SET ROLE outclass_production_app');
 await assert.rejects(db.query('SELECT id FROM public.outclass_auth_sessions'),/permission denied/,'View must not borrow its owner privileges');
 await db.exec('RESET ROLE;GRANT SELECT(id) ON auth.sessions TO outclass_production_app;ALTER POLICY session_read ON auth.sessions USING(false);SET ROLE outclass_production_app');
 assert.equal((await db.query('SELECT id FROM public.outclass_auth_sessions')).rows.length,0,'Caller RLS applies through the view');
 await db.exec('RESET ROLE');
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(db.query('SELECT id FROM public.outclass_auth_sessions'),/permission denied/);await db.exec('RESET ROLE');}
 assert.deepEqual((await db.query('SELECT * FROM auth.sessions')).rows,before);
 // Mirror the hosted operator: it can UPDATE, but cannot delegate that ACL.
 // The reviewed candidate must fail atomically instead of committing only its
 // SELECT policies and silently leaving Admin session locks unusable.
 await db.exec('CREATE ROLE fixture_operator;GRANT USAGE ON SCHEMA auth TO fixture_operator;GRANT UPDATE(updated_at) ON auth.sessions TO fixture_operator;SET ROLE fixture_operator');
 await assert.rejects(db.exec(fs.readFileSync('docs/production-audit-2026-10-18/runtime-role/access-proposal.sql','utf8')),/Operator cannot delegate the session-lock ACL/);
 await db.exec('ROLLBACK;RESET ROLE');
 assert.deepEqual((await db.query('SELECT * FROM auth.sessions')).rows,before);
});

test('provider prerequisite rejects a warning-only GRANT and verifies owner-issued delegation',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 // PGlite reserves postgres as its bootstrap superuser; use a non-superuser
 // recipient for the same operator ACL semantics exercised on hosted Postgres.
 await db.exec(`CREATE ROLE fixture_provider;CREATE ROLE fixture_operator;CREATE ROLE fixture_postgres;
 CREATE SCHEMA auth;CREATE TABLE auth.sessions(updated_at timestamptz);
 INSERT INTO auth.sessions VALUES('2026-10-19T12:00:00Z');
 ALTER TABLE auth.sessions OWNER TO fixture_provider;
 GRANT USAGE ON SCHEMA auth TO fixture_provider,fixture_operator,fixture_postgres;
 GRANT UPDATE(updated_at) ON auth.sessions TO fixture_postgres,fixture_operator;
 SET ROLE fixture_operator;`);
 const sql=fs.readFileSync('docs/production-audit-2026-10-18/rollout-blockers/provider-lock-grant.sql','utf8').replace(/\bpostgres\b/g,'fixture_postgres');
 await assert.rejects(db.exec(sql),/Provider grant did not take effect/);
 await db.exec('ROLLBACK;RESET ROLE');
 assert.equal((await db.query("SELECT has_column_privilege('fixture_postgres','auth.sessions','updated_at','UPDATE WITH GRANT OPTION') AS allowed")).rows[0].allowed,false);
 await db.exec('SET ROLE fixture_provider');
 const before=(await db.query('SELECT * FROM auth.sessions')).rows;
 await db.exec(sql);
 assert.equal((await db.query("SELECT has_column_privilege('fixture_postgres','auth.sessions','updated_at','UPDATE WITH GRANT OPTION') AS allowed")).rows[0].allowed,true);
 assert.deepEqual((await db.query('SELECT * FROM auth.sessions')).rows,before);
 await db.exec('RESET ROLE;SET ROLE fixture_postgres;GRANT UPDATE(updated_at) ON auth.sessions TO fixture_operator');
 assert.equal((await db.query("SELECT has_column_privilege('fixture_operator','auth.sessions','updated_at','UPDATE WITH GRANT OPTION') AS allowed")).rows[0].allowed,false);
});

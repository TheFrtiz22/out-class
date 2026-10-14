"""Validate a generated connector package ONLY on the dedicated loopback fixture.
Requires psycopg (existing local probe venv is suitable); starts no hosted work.
"""
import argparse, hashlib, json, os, subprocess
from pathlib import Path
import psycopg
from psycopg import sql
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(); parser.add_argument('package'); args = parser.parse_args()
P = Path(args.package).resolve(); manifest = json.loads((P/'manifest.json').read_text())
URL = 'postgresql://postgres@127.0.0.1:58442/postgres?sslmode=disable'
def connection(user='postgres'): return psycopg.connect(host='127.0.0.1', port=58442, dbname='postgres', user=user, autocommit=True)
def cli(command, folder, user='postgres', expected=0):
    env = dict(os.environ, DATABASE_URL=URL.replace('postgres@', user+'@'), POSTGRES_PRISMA_URL=URL.replace('postgres@', user+'@'))
    r = subprocess.run(['node', str(ROOT/'node_modules/prisma/build/index.js'), 'migrate', command, '--schema', str(P/folder/'prisma/schema.prisma')], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    (P/(folder+'-'+command+'.log')).write_text(r.stdout)
    assert r.returncode == expected, (folder, command, r.returncode)
    return r.stdout
passed=[]
def ok(name): passed.append(name); print('PASS: '+name, flush=True)
with connection('fixture_superuser') as c:
    c.execute('CREATE ROLE postgres LOGIN NOSUPERUSER NOBYPASSRLS CREATEDB CREATEROLE INHERIT; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION')
# Match the four verified historical production line endings in baseline deploy.
for name, lf, crlf in manifest['baseline']:
    if lf != crlf:
        path=P/'baseline/prisma/migrations'/name/'migration.sql'; path.write_bytes(path.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
cli('deploy', 'baseline', 'fixture_superuser'); ok('Prisma applies all 43 production-equivalent baseline migrations')
with connection('fixture_superuser') as c:
    for (name,) in c.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'").fetchall():
        c.execute(sql.SQL('ALTER TABLE public.{} OWNER TO {}').format(sql.Identifier(name), sql.Identifier('postgres' if name=='_prisma_migrations' else 'outclass_production_app')))
    c.execute('GRANT outclass_production_app TO postgres WITH ADMIN TRUE, INHERIT TRUE, SET TRUE; REVOKE CREATE ON SCHEMA public FROM PUBLIC; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres')
    for (name, args) in c.execute("SELECT proname,pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname LIKE 'outclass_%'").fetchall():
        c.execute(sql.SQL('ALTER FUNCTION public.{}('+args+') OWNER TO postgres').format(sql.Identifier(name)))
with connection() as c:
    c.execute('''INSERT INTO "User"(id,email)VALUES('package-user','package@demo.invalid');
    INSERT INTO "Club"(id,slug,name,tagline,description,color,category)VALUES('package-club','package-club','Package','','','#142d45','Other');
    INSERT INTO "ClubMember"(id,"clubId","userId",cohort,groups)VALUES('package-member','package-club','package-user','Fall 2026',ARRAY['Finance']);
    INSERT INTO "PipelineRound"(id,"clubId",name,"order")VALUES('package-round','package-club','Review',0);
    INSERT INTO "Application"(id,"clubId","roundId","studentId",status,"decisionVersion")VALUES('package-app','package-club','package-round','package-user','REJECTED',1);
    INSERT INTO "DecisionLetter"(id,"applicationId","clubId",version,decision,content)VALUES('package-letter','package-app','package-club',1,'REJECTED','{"body":"Preserve"}');
    INSERT INTO "UserNotification"(id,"userId","clubId","eventKey",type,title,body,href)VALUES('package-notice','package-user','package-club','package-event','INTERVIEW','Keep','Keep','/settings/interviews');
    INSERT INTO "UserNotificationPreference"("userId","emailFrequency","updatedAt")VALUES('package-user','OFF',NOW());
    INSERT INTO "AdminElevation"(id,"actorId","tokenHash","authSessionId","factorId","passwordVerifiedAt","mfaVerifiedAt","createdAt","expiresAt")VALUES('package-elevation','package-user',repeat('a',64),'fixture-session','fixture-factor','2026-10-13 10:00','2026-10-13 10:00','2026-10-13 10:00','2026-10-13 10:30');''')
    tables=['UserNotification','UserNotificationPreference','NotificationEmailOutbox','NotificationEmailDelivery','DecisionLetter','ClubMember','AdminElevation']
    def snapshot(): return {t:c.execute(sql.SQL('SELECT to_jsonb(t)::text FROM public.{} t ORDER BY 1').format(sql.Identifier(t))).fetchall() for t in tables}
    before=snapshot()
    preflight=c.execute((P/'preflight.sql').read_text()).fetchone()[0]
    assert preflight['ledger_count']==43 and preflight['mismatches']==0
    for index, migration in enumerate(manifest['migrations']):
        source=(P/(migration['name']+'.source.sql')).read_bytes(); payload=(P/migration['payload_file']).read_bytes()
        assert hashlib.sha256(source).hexdigest()==migration['source_sha256']
        assert hashlib.sha256(payload).hexdigest()==migration['payload_sha256']
        ledger=c.execute('SELECT * FROM _prisma_migrations ORDER BY migration_name').fetchall()
        def schema_state():
            return c.execute("SELECT c.oid::regclass::text,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1,2").fetchall()
        schema_before=schema_state()
        # Every migration rolls back BOTH source effects and history on source or ledger failure.
        for label,bad in [('source',payload.replace(b'-- Record success only',b'SELECT 1/0;\n-- Record success only',1)),('ledger',payload.replace(b'VALUES(gen_random_uuid()::text',b'VALUES(NULL::text',1))]:
            try: c.execute(bad.decode(),prepare=False)
            except psycopg.Error: c.execute('ROLLBACK')
            else: raise AssertionError('Injected failure must abort')
            assert c.execute('SELECT * FROM _prisma_migrations ORDER BY migration_name').fetchall()==ledger
            assert snapshot()==before
            assert schema_state()==schema_before
            assert not c.execute("SELECT has_schema_privilege('outclass_production_app','public','CREATE')").fetchone()[0]
        # Checksum drift is a stale-baseline failure, not a reason to resolve history.
        with c.transaction():
            c.execute("UPDATE _prisma_migrations SET checksum=repeat('0',64) WHERE migration_name=%s",(manifest['baseline'][0][0],))
            try:
                with c.transaction(): c.execute(payload.decode(),prepare=False)
            except psycopg.Error: pass
            else: raise AssertionError('Checksum drift must stop')
            c.execute('ROLLBACK')
        c.execute(payload.decode(),prepare=False)
        assert snapshot()==before
        row=c.execute('SELECT checksum,finished_at>=started_at,logs,rolled_back_at,applied_steps_count FROM _prisma_migrations WHERE migration_name=%s',(migration['name'],)).fetchone()
        assert row==(migration['source_sha256'],True,None,None,1)
        try: c.execute(payload.decode(),prepare=False)
        except psycopg.Error: c.execute('ROLLBACK')
        else: raise AssertionError('Repeat must reject stale baseline')
        ok(migration['name']+': exact SQL/history atomicity, rollback, drift rejection, safe retry and preservation')
    postflight=c.execute((P/'postflight.sql').read_text()).fetchone()[0]
    assert postflight['ledger_count']==51 and postflight['mismatches']==0
    assert all(r['owner']=='outclass_production_app' and r['rls'] and not r['force'] and not r['browser_access'] and r['restrictive_policy'] for r in postflight['security'])
    assert 'Database schema is up to date' in cli('status','reviewed')
    ledger=c.execute('SELECT * FROM _prisma_migrations ORDER BY migration_name').fetchall()
    assert 'No pending migrations to apply' in cli('deploy','reviewed')
    assert c.execute('SELECT * FROM _prisma_migrations ORDER BY migration_name').fetchall()==ledger
    assert snapshot()==before
    ok('Prisma status accepts all 51 checksums; migrate deploy is a history-preserving no-op')
    for table in ['RecipientGroup','RecipientGroupEntry','ScheduledCommunication','RecruitmentCycle']:
        assert c.execute("SELECT relowner::regrole::text,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=%s::regclass",('public."'+table+'"',)).fetchone()==('outclass_production_app',True,False)
        for role in ['anon','authenticated']:
            assert not c.execute('SELECT has_table_privilege(%s,%s,\'SELECT,INSERT,UPDATE,DELETE\')',(role,'public."'+table+'"')).fetchone()[0]
    with connection('outclass_production_app') as runtime:
        assert runtime.execute('SELECT count(*) FROM "DecisionLetter"').fetchone()[0]==1
        runtime.execute('INSERT INTO "RecipientGroup"(id,"clubId",name,kind,"updatedAt")VALUES(\'package-group\',\'package-club\',\'Finance\',\'MANUAL\',NOW())')
        assert runtime.execute('SELECT count(*) FROM "RecipientGroup"').fetchone()[0]==1
    with connection('fixture_superuser') as browser:
        for role in ['anon','authenticated']:
            browser.execute('SET ROLE '+role)
            for table in ['RecipientGroup','RecipientGroupEntry','ScheduledCommunication','RecruitmentCycle']:
                try: browser.execute(sql.SQL('SELECT * FROM {}').format(sql.Identifier(table)))
                except psycopg.errors.InsufficientPrivilege: pass
                else: raise AssertionError('Browser read unexpectedly succeeded')
            browser.execute('RESET ROLE')
    ok('Actual bounded runtime owner reads/writes; restrictive RLS/browser denial and schema privilege retained')
(P/'test-results.json').write_text(json.dumps({'passed':len(passed),'failed':0,'checks':passed,'production_writes':False,'source':manifest['source']},indent=2)+'\n')

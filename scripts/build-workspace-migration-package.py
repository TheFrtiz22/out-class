"""Build (never execute) exact-source Supabase connector release payloads."""
import argparse, hashlib, json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'htlgjluegmdwfjkzzwic'
BASE = '2ceb87487b18c2e7daa17585721f2a3b0d4ba0b4'
NAMES = ['20261012171752_admin_session_bound_elevation', '20261013002253_recipient_audiences', '20261013005624_scheduled_communications', '20261013014837_decision_letter_controls', '20261013014950_recruitment_cycles', '20261013015200_scheduled_decisions', '20261013140024_scheduled_invitation_emails', '20261013141510_scheduled_availability_requests']
CRLF = {'20261005010000_public_corkboard', '20261006010000_admin_workspace', '20261006020000_profile_recruitment_visibility', '20261007010000_profile_gpa_private_photos'}
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT)
def sha(data): return hashlib.sha256(data).hexdigest()
def build(source, output, ledger_json):
    revision = git('rev-parse', source).decode().strip()
    output = Path(output).resolve()
    if output.exists(): raise SystemExit('Output already exists; preserve prior evidence.')
    if output.is_relative_to(ROOT): raise SystemExit('Package/evidence must remain outside repository.')
    output.mkdir(parents=True)
    paths = {}
    for rev, folder in [(BASE, 'baseline'), (revision, 'reviewed')]:
        paths[folder] = [p for p in git('ls-tree', '-r', '--name-only', rev, 'prisma').decode().splitlines() if p.endswith(('/migration.sql', 'schema.prisma', 'migration_lock.toml'))]
        for path in paths[folder]:
            target = output / folder / path; target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(git('show', rev + ':' + path))
    pending = sorted(set(paths['reviewed']) - set(paths['baseline']))
    assert pending == ['prisma/migrations/' + n + '/migration.sql' for n in NAMES]
    expected = []
    for path in paths['baseline']:
        if not path.endswith('/migration.sql'): continue
        raw = git('show', BASE + ':' + path)
        assert raw == git('show', revision + ':' + path), 'Existing migration rewritten'
        name = path.split('/')[2]; lf = raw.replace(b'\r\n', b'\n')
        expected.append((name, sha(raw), sha(lf.replace(b'\n', b'\r\n')) if name in CRLF else sha(raw)))
    assert len(expected) == 43
    ledger_bytes = Path(ledger_json).read_bytes()
    live = json.loads(ledger_bytes)
    assert live['project_id'] == PROJECT and live['database'] == 'postgres' and live['operator'] == 'postgres', 'Wrong project/database/operator'
    by_name = {name: (lf, crlf) for name, lf, crlf in expected}
    assert len(live['ledger']) == len(expected) and {r['name'] for r in live['ledger']} == set(by_name), 'Live ledger differs from baseline: review all pending prerequisites'
    assert all(r['completed'] and r['checksum'] in by_name[r['name']] for r in live['ledger']), 'Incomplete or changed live history'
    assert not any(live['runtime'][key] for key in ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication','schema_create']), 'Runtime security changed'
    manifest = {'source': revision, 'base': BASE, 'project_id': PROJECT, 'live_ledger_sha256': sha(ledger_bytes), 'baseline': expected.copy(), 'migrations': []}
    (output / 'live-ledger.json').write_bytes(ledger_bytes)
    for index, name in enumerate(NAMES):
        raw = git('show', revision + ':prisma/migrations/' + name + '/migration.sql')
        assert raw.startswith(b'BEGIN;\n') and raw.endswith(b'COMMIT;\n')
        checksum = sha(raw)
        values = ','.join("('" + "','".join(row) + "')" for row in expected)
        guard = f'''-- Adapter guard. Original migration statements remain byte-identical.
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(72707369);
LOCK TABLE public._prisma_migrations IN EXCLUSIVE MODE;
SELECT set_config('outclass.migration_started_at',clock_timestamp()::text,true);
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected database/operator'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='outclass_production_app' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) OR has_schema_privilege('outclass_production_app','public','CREATE') OR NOT pg_has_role(current_user,'outclass_production_app','USAGE') THEN RAISE EXCEPTION 'Bounded runtime assumptions changed'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations)<>{len(expected)} THEN RAISE EXCEPTION 'Stale migration baseline'; END IF;
 IF EXISTS(WITH expected(name,lf,crlf) AS (VALUES {values}) SELECT FROM expected e FULL JOIN public._prisma_migrations m ON m.migration_name=e.name WHERE e.name IS NULL OR m.migration_name IS NULL OR m.checksum NOT IN(e.lf,e.crlf) OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL) THEN RAISE EXCEPTION 'Migration baseline mismatch'; END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='public."DecisionLetter"'::regclass AND relowner='outclass_production_app'::regrole AND relrowsecurity AND NOT relforcerowsecurity) THEN RAISE EXCEPTION 'Existing ownership/RLS changed'; END IF;
END $guard$;
'''.encode()
        tables = ['DecisionLetter'] + (['RecipientGroup', 'RecipientGroupEntry'] if index >= 1 else []) + (['ScheduledCommunication'] if index >= 2 else []) + (['RecruitmentCycle'] if index >= 4 else [])
        array = ','.join("'" + t + "'" for t in tables)
        post = f'''-- Record success only after source SQL and security assertions succeed.
DO $verify$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY[{array}] LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=format('public.%I',n)::regclass AND relowner='outclass_production_app'::regrole AND relrowsecurity AND NOT relforcerowsecurity) THEN RAISE EXCEPTION 'Runtime ownership/RLS verification failed'; END IF;
  IF has_table_privilege('anon',format('public.%I',n),'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',format('public.%I',n),'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Unexpected browser privilege'; END IF;
  IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=format('public.%I',n)::regclass AND NOT polpermissive AND pg_get_expr(polqual,polrelid)='false' AND pg_get_expr(polwithcheck,polrelid)='false') THEN RAISE EXCEPTION 'Restrictive policy missing'; END IF;
 END LOOP;
 IF has_schema_privilege('outclass_production_app','public','CREATE') THEN RAISE EXCEPTION 'Runtime schema privilege changed'; END IF;
END $verify$;
INSERT INTO public._prisma_migrations(id,checksum,started_at,finished_at,migration_name,logs,rolled_back_at,applied_steps_count)
VALUES(gen_random_uuid()::text,'{checksum}',current_setting('outclass.migration_started_at')::timestamptz,clock_timestamp(),'{name}',NULL,NULL,1);
'''.encode()
        payload = raw[:7] + guard + raw[7:-8] + post + raw[-8:]
        assert payload.replace(guard, b'', 1).replace(post, b'', 1) == raw
        (output / (name + '.source.sql')).write_bytes(raw)
        (output / (name + '.connector.sql')).write_bytes(payload)
        (output / (name + '.tool.json')).write_text(json.dumps({'project_id': PROJECT, 'query': payload.decode()}, indent=2) + '\n')
        manifest['migrations'].append({'name': name, 'source_sha256': checksum, 'payload_sha256': sha(payload), 'expected_before': len(expected), 'payload_file': name + '.connector.sql'})
        expected.append((name, checksum, checksum))
    def verification(rows):
        values = ','.join("('" + "','".join(row) + "')" for row in rows)
        table_names = "'DecisionLetter'" + (",'RecipientGroup','RecipientGroupEntry','ScheduledCommunication','RecruitmentCycle'" if len(rows)==51 else "")
        return f"""SELECT jsonb_build_object('database',current_database(),'operator',current_user,
 'ledger_count',(SELECT count(*) FROM public._prisma_migrations),
 'mismatches',(WITH expected(name,lf,crlf) AS (VALUES {values}) SELECT count(*) FROM expected e FULL JOIN public._prisma_migrations m ON m.migration_name=e.name WHERE e.name IS NULL OR m.migration_name IS NULL OR m.checksum NOT IN(e.lf,e.crlf) OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL),
 'inherits_runtime',pg_has_role(current_user,'outclass_production_app','USAGE'),
 'runtime_schema_create',has_schema_privilege('outclass_production_app','public','CREATE'),
 'security',(SELECT jsonb_agg(jsonb_build_object('table',relname,'owner',relowner::regrole::text,'rls',relrowsecurity,'force',relforcerowsecurity,'browser_access',has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'),'restrictive_policy',EXISTS(SELECT FROM pg_policy WHERE polrelid=c.oid AND NOT polpermissive AND pg_get_expr(polqual,polrelid)='false' AND pg_get_expr(polwithcheck,polrelid)='false'))) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN ({table_names}))) verification;
"""
    (output/'preflight.sql').write_text(verification(manifest['baseline']))
    (output/'postflight.sql').write_text(verification(expected))
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'source': revision, 'package': str(output), 'migrations': len(NAMES)}))
if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--source', default='HEAD'); parser.add_argument('--output', required=True); parser.add_argument('--ledger-json', required=True)
    args = parser.parse_args(); build(args.source, args.output, args.ledger_json)

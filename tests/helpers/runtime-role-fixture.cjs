// Used only by the reserved onboarding fixture, never by deployment scripts.
const fs = require('node:fs'), path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { readConfig } = require('./onboarding-e2e.cjs');
exports.prepareRuntimeRole = filename => {
 const config = readConfig(filename);
 const password = randomBytes(32).toString('hex');
 const sql = `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='outclass_production_app') THEN
 CREATE ROLE outclass_production_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
 END IF; END $$;
 GRANT USAGE, CREATE ON SCHEMA public TO outclass_production_app;
 DO $$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables
 WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP
 EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app',t); END LOOP; END $$;
 REVOKE CREATE ON SCHEMA public FROM outclass_production_app;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC;
 -- Mirror existing production EXECUTE grants. A restored fixture may have run
 -- these conditional migrations before the runtime role existed.
 GRANT EXECUTE ON FUNCTION public.outclass_collaboration_scope(),
 public.outclass_notification_email_outbox(), public.outclass_notify(text,text,text,text,text,text,text),
 public.outclass_application_notification(), public.outclass_booking_notification(),
 public.outclass_task_notification(), public.outclass_invitation_notification(),
 public.outclass_valid_availability_ranges(jsonb), public.outclass_valid_availability(jsonb),
 public.outclass_validate_panel_proposal(), public.outclass_reject_panel_preview_write(),
 public.outclass_panel_publication_guard(), public.outclass_official_slot_panel_guard(),
 public.outclass_round_panel_revision_guard(), public.outclass_valid_availability_override(text,text,text,text,text),
 public.outclass_availability_override_guard() TO outclass_production_app;
 ` + ['role-setup.sql','role-rollback.sql','role-setup.sql'].map(name=>fs.readFileSync(path.resolve(__dirname,'../../docs/production-audit-2026-10-18/rollout-blockers',name),'utf8')).join('\n')
 + `ALTER ROLE outclass_web_runtime LOGIN PASSWORD '${password}';\n`
 + fs.readFileSync(path.resolve(__dirname,'../../docs/production-audit-2026-10-18/runtime-role/access-proposal.sql'),'utf8');
 // Secret stays in stdin; SQL and provider credentials never enter argv/stdout.
 const result = spawnSync('docker',['exec','-i','supabase_db_outclass-onboarding-e2e','psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});
 if(result.status!==0) throw Error('Reserved runtime-role setup failed; no SQL/credentials were printed. Inspect the local catalog with a redacted query.');
 const url = new URL(config.status.DB_URL); url.username='outclass_web_runtime';url.password=password;
 config.runtimeDatabaseUrl=url.href;
 fs.writeFileSync(filename,JSON.stringify(config),{mode:0o600});
 return url.href;
};

const { Prisma, PrismaClient } = require('@prisma/client')

// Catalog reads only. Runtime roles intentionally cannot read migration history;
// inspect that separately with the approved migration/operator connection.
const catalogQuery = `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
// No session rows, identifiers or credentials are returned by these probes.
const runtimeAccessQuery = `SELECT current_user AS role,
  NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
    AND pg_has_role(current_user,'outclass_production_app','USAGE')
    AND NOT pg_has_role(current_user,'postgres','MEMBER')
    AND NOT pg_has_role(current_user,'supabase_auth_admin','MEMBER')
    AND NOT pg_has_role(current_user,'supabase_storage_admin','MEMBER')
    AND NOT has_schema_privilege(current_user,'public','CREATE')
    AND NOT has_schema_privilege(current_user,'auth','CREATE')
    AND NOT has_schema_privilege(current_user,'storage','CREATE') AS bounded,
  NOT has_schema_privilege(current_user,'auth','USAGE')
    AND has_column_privilege(current_user,sessions.oid,'id','SELECT')
    AND has_column_privilege(current_user,sessions.oid,'user_id','SELECT')
    AND has_column_privilege(current_user,sessions.oid,'not_after','SELECT')
    AND has_column_privilege(current_user,sessions.oid,'updated_at','UPDATE') AS session_grants,
  NOT has_any_column_privilege(current_user,users.oid,'SELECT')
    AND NOT has_table_privilege(current_user,'public._prisma_migrations','SELECT') AS secrets_denied,
  sessions.relrowsecurity AS session_rls,
  EXISTS(SELECT FROM pg_class v JOIN pg_namespace n ON n.oid=v.relnamespace
    WHERE n.nspname='public' AND v.relname='outclass_auth_sessions' AND v.relkind='v'
    AND 'security_invoker=true'=ANY(v.reloptions)) AS invoker_view,
  EXISTS(SELECT FROM pg_policies WHERE schemaname='auth' AND tablename='sessions'
    AND policyname='outclass_runtime_session_read' AND cmd='SELECT' AND permissive='PERMISSIVE'
    AND roles=ARRAY['outclass_production_app']::name[] AND qual='true') AS session_read_policy,
  EXISTS(SELECT FROM pg_policies WHERE schemaname='auth' AND tablename='sessions'
    AND policyname='outclass_runtime_session_lock' AND cmd='UPDATE' AND permissive='PERMISSIVE'
    AND roles=ARRAY['outclass_production_app']::name[] AND qual='true' AND with_check='false') AS session_lock_policy,
  EXISTS(SELECT FROM pg_policies WHERE schemaname='auth' AND tablename='sessions'
    AND policyname='outclass_runtime_session_no_write' AND cmd='UPDATE' AND permissive='RESTRICTIVE'
    AND roles=ARRAY['outclass_production_app']::name[] AND qual='true' AND with_check='false') AS session_write_guard,
  EXISTS(SELECT FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='outclass_runtime_club_asset_scope' AND cmd='SELECT' AND permissive='RESTRICTIVE'
    AND roles=ARRAY['outclass_production_app']::name[] AND qual='(bucket_id = ''club-assets''::text)') AS storage_scope
  FROM pg_roles
  JOIN pg_namespace auth ON auth.nspname='auth'
  JOIN pg_class sessions ON sessions.relnamespace=auth.oid AND sessions.relname='sessions'
  JOIN pg_class users ON users.relnamespace=auth.oid AND users.relname='users'
  WHERE rolname=current_user`
const sessionQuery = `SELECT EXISTS(SELECT 1 FROM public.outclass_auth_sessions
  WHERE id='00000000-0000-0000-0000-000000000000'::uuid
  AND user_id='00000000-0000-0000-0000-000000000000'::uuid
  AND (not_after IS NULL OR not_after>clock_timestamp())) AS live`

function runtimeIssues(row) {
  return [
    ...(row?.role === 'outclass_web_runtime' ? [] : ['runtime role identity']),
    ...['bounded', 'session_grants', 'secrets_denied', 'session_rls', 'invoker_view', 'session_read_policy', 'session_lock_policy', 'session_write_guard', 'storage_scope'].filter(key => row?.[key] !== true),
  ]
}

function missingColumns(columns) {
  const present = new Set(columns.map(row => `${row.table_name}.${row.column_name}`))
  return Prisma.dmmf.datamodel.models.flatMap(model => model.fields
    .filter(field => field.kind !== 'object')
    .map(field => `${model.dbName || model.name}.${field.dbName || field.name}`)
    .filter(column => !present.has(column)))
}

function releaseTarget(env, args) {
  const productionBuild = args.includes('--vercel-production-build')
  if (productionBuild && (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production')) return { skip: true }
  // Hosted production uses the exact runtime precedence from utils/prisma.ts.
  // Manual checks require an explicit target and never use a developer default.
  return { datasourceUrl: productionBuild || args.includes('--runtime-env') ? env.OUTCLASS_RUNTIME_DATABASE_URL || env.POSTGRES_PRISMA_URL || env.DATABASE_URL : env.OUTCLASS_DATABASE_CHECK_URL, productionBuild }
}

async function main() {
  const { datasourceUrl, skip, productionBuild } = releaseTarget(process.env, process.argv.slice(2))
  if (skip) {
    console.log('Release database check applies only to Vercel production builds; skipping in this environment.')
    return
  }
  if (!datasourceUrl) {
    console.error(productionBuild
      ? 'Production release blocked: the runtime database connection is missing. Configure POSTGRES_PRISMA_URL or DATABASE_URL before publishing.'
      : 'Set OUTCLASS_DATABASE_CHECK_URL securely to the intended runtime database connection. This check is read-only.')
    process.exitCode = 1
    return
  }
  const prisma = new PrismaClient({ datasourceUrl, log: [] })
  try {
    const { columns, issues, identity } = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout='5s'")
      const columns = await tx.$queryRawUnsafe(catalogQuery)
      const [access] = await tx.$queryRawUnsafe(runtimeAccessQuery)
      const issues = runtimeIssues(access)
      if (!issues.length) await tx.$queryRawUnsafe(sessionQuery)
      const identity = ['postgres', 'outclass_web_runtime'].includes(access?.role) ? access.role : 'other'
      return { columns, issues, identity }
    })
    const missing = missingColumns(columns)
    if (missing.length) {
      console.error(`Release blocked: ${missing.length} required database columns are unavailable:\n${missing.join('\n')}`)
      console.error('Inspect Prisma migration status and the approved migration plan before publishing. No migration was executed.')
      process.exitCode = 1
      return
    }
    if (issues.length) {
      console.error(`Runtime identity: ${identity}.`)
      console.error(`Release blocked: runtime access requirements failed (${issues.join(', ')}). Use the reviewed runtime-role proposal and approved credential/operator path. No permissions or credentials were changed.`)
      process.exitCode = 1
      return
    }
    console.log('Runtime identity is outclass_web_runtime; schema, session access and secret-denial checks passed. This read-only check is not a substitute for hosted authenticated smoke tests or migration verification.')
  } catch (error) {
    // Provider errors can contain connection details. Emit only a bounded code.
    const code = /^P\d{4}$/.test(error?.code || error?.errorCode || '') ? error.code || error.errorCode : 'DATABASE_CHECK_FAILED'
    console.error(`Release database check failed (${code}). Check the intended connection and its read permissions. No migration was executed.`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

module.exports = { catalogQuery, runtimeAccessQuery, sessionQuery, runtimeIssues, missingColumns, releaseTarget }
if (require.main === module) void main()

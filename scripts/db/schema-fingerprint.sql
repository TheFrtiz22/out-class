-- Read-only schema fingerprint. Catalog metadata only: no application rows, no secrets.
-- Emits (category, object, detail) rows that can be diffed between a clean replay of
-- prisma/migrations and a hosted database. Safe to run in a read-only transaction.
-- Usage: psql "$URL" -X -At -F ' | ' -v ON_ERROR_STOP=1 -f scripts/db/schema-fingerprint.sql > fingerprint.txt
-- See docs/agent-ops/migration-reconciliation-2026-11-09.md.
WITH fp AS (
  SELECT 'migration' AS category, m.migration_name AS object,
         m.checksum || ' finished=' || (m.finished_at IS NOT NULL) || ' rolled_back=' || (m.rolled_back_at IS NOT NULL)
           || ' steps=' || m.applied_steps_count AS detail
  FROM public._prisma_migrations m
  UNION ALL
  SELECT 'column', c.relname || '.' || a.attname,
         format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
           || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '')
           || CASE WHEN a.attgenerated <> '' THEN ' GENERATED' ELSE '' END
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid AND c.relkind IN ('r','p','v','m')
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'relation', c.relname,
         'kind=' || c.relkind::text || ' owner=' || pg_get_userbyid(c.relowner) || ' rls=' || c.relrowsecurity || ' force=' || c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind IN ('r','p','v','m','S')
  UNION ALL
  SELECT 'view', c.relname, md5(pg_get_viewdef(c.oid)) || ' options=' || coalesce(array_to_string(c.reloptions, ','), '')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind IN ('v','m')
  UNION ALL
  SELECT 'index', t.relname || '.' || i.relname, pg_get_indexdef(x.indexrelid) || CASE WHEN x.indisvalid THEN '' ELSE ' INVALID' END
  FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  UNION ALL
  SELECT 'constraint', t.relname || '.' || k.conname,
         k.contype::text || ' ' || pg_get_constraintdef(k.oid) || CASE WHEN k.convalidated THEN '' ELSE ' NOT VALID' END
  FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  UNION ALL
  SELECT 'enum', t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
  GROUP BY t.typname
  UNION ALL
  SELECT 'policy', p.schemaname || '.' || p.tablename || '.' || p.policyname,
         p.permissive || ' ' || p.cmd || ' TO ' || array_to_string(p.roles::text[], ',')
           || ' USING ' || coalesce(p.qual, '-') || ' CHECK ' || coalesce(p.with_check, '-')
  FROM pg_policies p WHERE p.schemaname IN ('public','storage','realtime')
  UNION ALL
  SELECT 'trigger', n.nspname || '.' || c.relname || '.' || g.tgname,
         pg_get_triggerdef(g.oid) || ' enabled=' || g.tgenabled::text
  FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT g.tgisinternal
    AND (n.nspname = 'public' OR g.tgfoid IN (SELECT p.oid FROM pg_proc p JOIN pg_namespace pn ON pn.oid = p.pronamespace WHERE pn.nspname = 'public'))
  UNION ALL
  SELECT 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         md5(p.prosrc) || ' returns=' || pg_get_function_result(p.oid) || ' secdef=' || p.prosecdef
           || ' owner=' || pg_get_userbyid(p.proowner) || ' config=' || coalesce(array_to_string(p.proconfig, ','), '')
           || ' acl=' || coalesce((SELECT string_agg(CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || ':' || a.privilege_type, ','
                                    ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)
                                   FROM aclexplode(p.proacl) a), 'default')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
  WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  UNION ALL
  SELECT 'grant', c.relname || ' -> ' || g.grantee, string_agg(g.privilege_type, ',' ORDER BY g.privilege_type)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  CROSS JOIN LATERAL (
    SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee, a.privilege_type
    FROM aclexplode(c.relacl) a
  ) g
  WHERE c.relkind IN ('r','p','v','m','S') AND g.grantee <> pg_get_userbyid(c.relowner)
  GROUP BY c.relname, g.grantee
  UNION ALL
  SELECT 'schema-grant', n.nspname || ' -> ' || CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
         string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
  FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
  WHERE n.nspname = 'public' GROUP BY 1, 2
  UNION ALL
  SELECT 'default-acl', coalesce(n.nspname, '*') || ' by ' || pg_get_userbyid(d.defaclrole) || ' type=' || d.defaclobjtype::text,
         array_to_string(d.defaclacl::text[], ',')
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  WHERE n.nspname = 'public' OR n.nspname IS NULL
  UNION ALL
  SELECT 'role', r.rolname,
         'login=' || r.rolcanlogin || ' super=' || r.rolsuper || ' bypassrls=' || r.rolbypassrls || ' inherit=' || r.rolinherit
           || ' createrole=' || r.rolcreaterole || ' memberof=' || coalesce((SELECT string_agg(pg_get_userbyid(m.roleid), ',' ORDER BY 1)
                                                                              FROM pg_auth_members m WHERE m.member = r.oid), '')
  FROM pg_roles r
  WHERE r.rolname IN ('postgres','anon','authenticated','service_role','authenticator','supabase_admin','supabase_storage_admin','supabase_realtime_admin','supabase_auth_admin')
     OR r.rolname LIKE 'outclass%' OR r.rolname LIKE 'prisma%' OR r.rolname = current_user
  UNION ALL
  SELECT 'extension', e.extname, e.extversion || ' schema=' || n.nspname
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  UNION ALL
  SELECT 'session', 'current_user', current_user || ' server=' || current_setting('server_version_num')
)
SELECT category, object, detail FROM fp ORDER BY category COLLATE "C", object COLLATE "C";

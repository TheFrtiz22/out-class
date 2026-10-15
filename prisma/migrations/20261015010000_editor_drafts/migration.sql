BEGIN;
CREATE TABLE "EditorDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "content" JSONB,
  "base" TEXT NOT NULL,
  "mutationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditorDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EditorDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EditorDraft_userId_key_key" ON "EditorDraft"("userId", "key");
ALTER TABLE "EditorDraft" ENABLE ROW LEVEL SECURITY;
-- Only trusted server actions access drafts. No public Data API grants or policies.
REVOKE ALL ON "EditorDraft" FROM PUBLIC, anon, authenticated;
CREATE POLICY outclass_editor_draft_server_only ON "EditorDraft" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
DO $migration$
DECLARE had_create BOOLEAN;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN RETURN; END IF;
 had_create := has_schema_privilege('outclass_production_app','public','CREATE');
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
 ALTER TABLE "EditorDraft" OWNER TO outclass_production_app;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $migration$;
COMMIT;

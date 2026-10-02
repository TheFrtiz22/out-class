BEGIN;
-- Preserve existing server-only RLS. Close suspension/promotion races at the DB boundary.
CREATE OR REPLACE FUNCTION outclass_membership_onboarding_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM id FROM "Club" WHERE id = COALESCE(NEW."clubId", OLD."clubId") FOR UPDATE;
  IF TG_OP <> 'INSERT' AND OLD."isOwner" AND (TG_OP = 'DELETE' OR NOT NEW."isOwner" OR NEW.status <> 'ACTIVE') AND
    NOT EXISTS (SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id = m."userId"
      WHERE m."clubId" = OLD."clubId" AND m.id <> OLD.id AND m."isOwner" AND m.status = 'ACTIVE' AND u."disabledAt" IS NULL)
  THEN RAISE EXCEPTION 'Assign another active owner first'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND (NEW."clubId" <> OLD."clubId" OR NEW."userId" <> OLD."userId") THEN
    RAISE EXCEPTION 'Membership identity is immutable';
  END IF;
  IF NEW."isOwner" THEN
    -- A concurrent suspension must serialize with ownership promotion.
    PERFORM id FROM "User" WHERE id = NEW."userId" FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = NEW."userId" AND "disabledAt" IS NULL) THEN
      RAISE EXCEPTION 'Ownership requires an active account';
    END IF;
    NEW."accessRole" := 'OWNER';
  ELSIF NEW."accessRole" = 'OWNER' THEN
    IF TG_OP = 'UPDATE' AND OLD."isOwner" THEN NEW."accessRole" := 'MEMBER';
    ELSE RAISE EXCEPTION 'Owner role requires explicit ownership'; END IF;
  END IF;
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;

CREATE FUNCTION outclass_owner_account_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE owned record;
BEGIN
  IF OLD."disabledAt" IS NULL AND NEW."disabledAt" IS NOT NULL THEN
    FOR owned IN SELECT "clubId" FROM "ClubMember"
      WHERE "userId" = OLD.id AND "isOwner" AND status = 'ACTIVE' ORDER BY "clubId"
    LOOP
      PERFORM id FROM "Club" WHERE id = owned."clubId" FOR UPDATE;
      IF NOT EXISTS (
        SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id = m."userId"
        WHERE m."clubId" = owned."clubId" AND m."userId" <> OLD.id
          AND m."isOwner" AND m.status = 'ACTIVE' AND u."disabledAt" IS NULL
      ) THEN RAISE EXCEPTION 'Assign another active owner before suspending this account'; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_owner_account_guard BEFORE UPDATE OF "disabledAt" ON "User"
  FOR EACH ROW EXECUTE FUNCTION outclass_owner_account_guard();
REVOKE ALL ON FUNCTION outclass_owner_account_guard() FROM PUBLIC;
-- Existing User/profile/Club tables already revoke browser grants. Make their
-- default-deny RLS resilient to future permissive policies, like onboarding tables.
DO $$ DECLARE tbl text; api_role text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['User','StudentProfile','Club'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY outclass_onboarding_server_only ON %I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)', tbl);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', tbl);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', tbl, api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;

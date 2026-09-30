-- Additive migration. Existing slots/bookings remain intact with NULL room/round IDs.
BEGIN;
CREATE TABLE "InterviewRoom" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clubId" TEXT NOT NULL REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "roundId" TEXT NOT NULL REFERENCES "PipelineRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL, "location" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('IN_PERSON','VIRTUAL')),
  "timezone" TEXT NOT NULL,
  "duration" INTEGER NOT NULL CHECK ("duration" BETWEEN 5 AND 180),
  "buffer" INTEGER NOT NULL DEFAULT 0 CHECK ("buffer" BETWEEN 0 AND 60),
  "isOpen" BOOLEAN NOT NULL DEFAULT TRUE,
  "panelMemberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "InterviewSlot" ADD COLUMN "roomId" TEXT REFERENCES "InterviewRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewBooking" ADD COLUMN "roundId" TEXT REFERENCES "PipelineRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InterviewBooking" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "InterviewRoom_clubId_roundId_idx" ON "InterviewRoom"("clubId", "roundId");
CREATE INDEX "InterviewSlot_roomId_startTime_idx" ON "InterviewSlot"("roomId", "startTime");
CREATE INDEX "InterviewSlot_clubId_startTime_idx" ON "InterviewSlot"("clubId", "startTime");
CREATE UNIQUE INDEX "InterviewBooking_applicationId_roundId_key" ON "InterviewBooking"("applicationId", "roundId");
-- NOT VALID preserves legacy rows while checking all newly inserted/updated rows.
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_positive_window" CHECK ("endTime" > "startTime" AND "capacity" BETWEEN 1 AND 20) NOT VALID;
ALTER TABLE "InterviewRoom" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InterviewRoom" FROM PUBLIC;
DO $$ DECLARE api_role TEXT; BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "InterviewRoom" FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
-- Defense in depth: room bookings cannot bypass round, capacity or conflict rules.
CREATE FUNCTION outclass_room_booking_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_slot "InterviewSlot"%ROWTYPE;
  target_room "InterviewRoom"%ROWTYPE;
  applicant "Application"%ROWTYPE;
BEGIN
  SELECT * INTO applicant FROM "Application" WHERE id = NEW."applicationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Application unavailable'; END IF;
  PERFORM id FROM "User" WHERE id = applicant."studentId" FOR UPDATE;
  SELECT * INTO target_slot FROM "InterviewSlot" WHERE id = NEW."slotId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot unavailable'; END IF;
  -- Keep pre-existing standalone slots compatible with their original workflow.
  IF target_slot."roomId" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO target_room FROM "InterviewRoom" WHERE id = target_slot."roomId";
  IF target_slot."clubId" <> applicant."clubId" OR target_room."clubId" <> applicant."clubId"
    OR target_room."roundId" <> applicant."roundId" OR applicant.status <> 'INTERVIEWING' THEN
    RAISE EXCEPTION 'An invitation to this club and round is required';
  END IF;
  IF NOT target_room."isOpen" OR target_slot."startTime" <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'This slot is no longer available';
  END IF;
  NEW."roundId" := target_room."roundId";
  IF (SELECT COUNT(*) FROM "InterviewBooking" WHERE "slotId" = NEW."slotId" AND id <> NEW.id) >= target_slot.capacity THEN
    RAISE EXCEPTION 'Interview capacity reached';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "InterviewBooking" b JOIN "InterviewSlot" s ON s.id = b."slotId"
      JOIN "Application" a ON a.id = b."applicationId"
    WHERE a."studentId" = applicant."studentId" AND b.id <> NEW.id
      AND s."startTime" < target_slot."endTime" AND s."endTime" > target_slot."startTime"
  ) THEN RAISE EXCEPTION 'You already have an interview at this time'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_room_booking_guard BEFORE INSERT OR UPDATE ON "InterviewBooking"
  FOR EACH ROW EXECUTE FUNCTION outclass_room_booking_guard();
REVOKE ALL ON FUNCTION outclass_room_booking_guard() FROM PUBLIC;
COMMIT;

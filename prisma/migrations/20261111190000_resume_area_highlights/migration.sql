BEGIN;
SET LOCAL lock_timeout = '5s';
-- Résumé area highlights: an interviewer marks a region of a scanned (image-only) page.
-- Reuses InterviewResumeAnnotation (same revisions, audit, moderation, triggers, RLS and
-- grants) with kind AREA_HIGHLIGHT and anchor {"page": n, "rect": {x, y, width, height}},
-- page-relative 0-1 values. An area anchor carries no quote/offset keys, so it can never
-- pass as quoted résumé text. Widens the two anonymous foundation checks; existing
-- TEXT_HIGHLIGHT/GENERAL_NOTE rows satisfy the replacements unchanged. No new table,
-- column, grant, policy, trigger or backfill.
DO $$
DECLARE c RECORD; dropped INTEGER := 0;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = '"InterviewResumeAnnotation"'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%TEXT_HIGHLIGHT%'
  LOOP
    EXECUTE format('ALTER TABLE "InterviewResumeAnnotation" DROP CONSTRAINT %I', c.conname);
    dropped := dropped + 1;
  END LOOP;
  IF dropped <> 2 THEN RAISE EXCEPTION 'Expected the two foundation annotation checks, found %', dropped; END IF;
END $$;
ALTER TABLE "InterviewResumeAnnotation"
  ADD CONSTRAINT "InterviewResumeAnnotation_kind_check"
    CHECK (kind IN ('TEXT_HIGHLIGHT', 'GENERAL_NOTE', 'AREA_HIGHLIGHT')),
  ADD CONSTRAINT "InterviewResumeAnnotation_anchor_check" CHECK (COALESCE(
    (kind = 'GENERAL_NOTE' AND anchor IS NULL)
    OR (kind = 'TEXT_HIGHLIGHT' AND anchor IS NOT NULL AND jsonb_typeof(anchor) = 'object'
      AND (anchor->>'page')::integer > 0 AND (anchor->>'start')::integer >= 0
      AND (anchor->>'end')::integer > (anchor->>'start')::integer
      AND length(anchor->>'quote') > 0)
    OR (kind = 'AREA_HIGHLIGHT' AND anchor IS NOT NULL AND jsonb_typeof(anchor) = 'object'
      AND anchor->'quote' IS NULL AND anchor->'start' IS NULL AND anchor->'end' IS NULL
      AND jsonb_typeof(anchor->'page') = 'number' AND (anchor->>'page')::integer > 0
      AND jsonb_typeof(anchor->'rect') = 'object'
      AND jsonb_typeof(anchor->'rect'->'x') = 'number' AND jsonb_typeof(anchor->'rect'->'y') = 'number'
      AND jsonb_typeof(anchor->'rect'->'width') = 'number' AND jsonb_typeof(anchor->'rect'->'height') = 'number'
      AND (anchor->'rect'->>'x')::numeric >= 0 AND (anchor->'rect'->>'y')::numeric >= 0
      AND (anchor->'rect'->>'width')::numeric > 0 AND (anchor->'rect'->>'height')::numeric > 0
      AND (anchor->'rect'->>'x')::numeric + (anchor->'rect'->>'width')::numeric <= 1
      AND (anchor->'rect'->>'y')::numeric + (anchor->'rect'->>'height')::numeric <= 1),
    FALSE));
COMMIT;

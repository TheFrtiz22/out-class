BEGIN;
ALTER TABLE public."Club" ADD COLUMN "sendFormalDecisionLetters" BOOLEAN NOT NULL DEFAULT true;
COMMIT;

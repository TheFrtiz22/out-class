# Anonymous recruiting review and standardized tests

## Deployment and compatibility

Apply `20260924010000_anonymous_review_tests` after the prior authorization/claim migrations. Existing rounds default to identified review, existing clubs default to optional tests, existing SAT values are unchanged, and all ACT fields start null. No applications or scores are converted or deleted. The migration adds database constraints for ACT ranges and allowed requirement values. Production deployment still requires the configured Prisma `DATABASE_URL` and the baseline procedure in `authorization.md` for older databases.

## Round privacy

Managers with recruitment and identified-applicant permissions configure each round under **Review privacy and test requirements** in the recruitment workspace. Changes are audited. Anonymous-only reviewers need `applications.review`; their pipeline query only selects applications currently in anonymous rounds. Existing identified reviewers still receive redacted responses for anonymous rounds, including owners. Moving between rounds clears the current detail context and reloads the server projection.

An allowlist projection removes original user/profile IDs, names, photos, email, computing IDs, links, résumé/attachment URLs and filenames, timestamps, bookings, original responses, free-text major/bio/experience fields, and evaluation notes. Stable application-specific labels replace identities. GPA, graduation year, SAT/ACT metrics, and numeric evaluation scores remain. Do not treat numeric metrics or contextual facts as a mathematical guarantee against inference in a small cohort.

Raw essays, résumés and free text are **not automatically anonymized**. Reliable de-identification cannot be achieved by removing a name or header alone. Files are withheld entirely, so embedded metadata and document headers cannot leak through review payloads.

To evaluate written content, an authorized manager explicitly reveals an applicant with a reason (audited), then prepares an anonymous text packet containing relevant essay passages and experience facts. Publication requires recruitment plus identity permission, a prior audited reveal, and explicit confirmation of manual privacy review. Known name/computing-ID tokens, contact patterns and links are rejected as defense in depth. This is a human-reviewed editorial boundary: managers must remove indirect identifiers and contextual clues that pattern checks cannot detect. Blank publication clears the packet. Anonymous clients receive only this separately prepared content, never original source text/files. Packets are shared across that application's anonymous rounds and changes are audited.

Identity reveal returns scoped original data only after authorization and an audit write succeed. It does not change other reviewers' projections. Platform admins retain their separately protected, audited platform access. Identified search excludes anonymous-round applicants, event attendance reads omit current anonymous applicants, and evaluation-history reads return no original notes for anonymous rounds. Mutation results mask student IDs in anonymous rounds. Anonymous evaluation saves return no historical notes; saving a score with blank notes preserves existing withheld notes instead of silently erasing them.

Enable privacy before inviting reviewers: data previously delivered to an authorized browser cannot be recalled. In-progress/open views need reload after policy changes; there is no new realtime revocation infrastructure. Grant identity/recruitment permissions only to people allowed to handle exceptions. Anonymous review during an in-person interview cannot hide the identity physically visible to the interviewer.

## SAT and ACT

Profile education supports independent nullable SAT total (400–1600), ACT composite, English, Math, Reading and Science (each 1–36). ACT sections are optional, including Science; the composite is entered by the student and is not calculated. Onboarding accepts SAT, ACT composite, both or neither. Profile editing exposes optional ACT sections. Student profiles and live applicant/interview/decision views display reported scores; live recruiting filters support independent SAT and ACT composite thresholds. Missing scores never count as zero. No concordance or conversion is performed.

Club policy supports optional, SAT-or-ACT, SAT-required, ACT-required, and both-required. Only the composite satisfies an ACT requirement. Policy is shown on club profiles/application forms and checked server-side on submission. Drafts remain saveable without required scores. Changes do not retroactively invalidate submitted applications. Scores continue using the existing shared-profile data model, not frozen submission snapshots.

Demo profiles contain SAT-only, ACT-only, both and neither combinations. Privacy controls/test policies use the isolated demo adapter; older saved demo sessions are upgraded with safe defaults. Demo content is fictional and locally available; it is not a production security boundary or a durable audit service. Legacy local-preview screening tools remain illustrative; live recruiting uses the persisted fields and server policy above.

## Validation

Regression tests cover the complete anonymous payload against identity sentinel values, owner redaction, anonymous-reviewer query scoping, explicit reveal/audit ordering, manually prepared content publication boundaries, score ranges, and every score requirement combination including server submission enforcement. Isolated PostgreSQL migration tests check preserved defaults and score/policy constraints. Live Supabase/MFA flows still require deployment credentials.

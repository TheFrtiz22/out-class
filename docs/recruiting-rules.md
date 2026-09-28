# Persisted recruiting rules

Rules are optional, round-scoped minimum GPA/SAT/ACT thresholds. The club's current test requirement controls valid thresholds. Blank thresholds disable that metric; all blank disables screening. No worker or submission hook changes decisions.

## Workflow and score semantics

1. Save a versioned configuration in Review Tools → Auto-Reject Rules.
2. Preview current submitted, in-review, and interviewing applications in that round.
3. Explicitly apply the suggested review flags, replacing that round's prior flags.
4. Open a flagged applicant in the existing drawer for human review. Existing decision actions and their permissions remain unchanged. Flags can be cleared.

Drafts and accepted/rejected/waitlisted applications are excluded. Missing or invalid scores are listed for manual review, never counted as failures. A separate observed below-threshold metric can still produce a flag.

SAT-only and ACT-only recruiting reject incompatible threshold configuration. Both evaluates each configured test independently. SAT-or-ACT requires both thresholds or neither; either qualifying score passes. If neither passes and one score is missing, testing requires manual review. Optional testing uses the same either-test semantics when both thresholds are configured. No score conversion is performed.

## Authorization and privacy

- Read/save configuration: recruitment.manage.
- Preview/read flags: additionally applications.review.
- Apply/clear flags: additionally decisions.manage.
- Applicant reads in non-anonymous rounds additionally require applicants.identify.
- Results always use the established pseudonymous applicant label. The rules API never returns contact details, profile identity, essays, files, or appointments.
- Existing authentication blocks live access from Demo Mode and read-only platform impersonation.

RecruitingRule stores thresholds and a revision, keyed by round. RecruitingRuleFlag stores candidate IDs, reasons, rule revision, actor ID, and timestamp separately from application status. Both tables enable RLS and deny all browser-role CRUD; server actions use current database membership checks and club/round predicates.

Saving clears obsolete flags. Save/apply transactions use serializable isolation. Apply recomputes a SHA-256 fingerprint over the scope, configuration version, requirement, and eligible candidate statuses/scores; stale previews fail before writing. Fingerprints are consistency checks, not authorization tokens. Conflicts require a fresh preview rather than automatic retry. AuditLog records configuration before/after, applied candidate IDs/fingerprint, and clear actions in the same transaction.

Flags are review snapshots, not current eligibility claims. Moved/decided applicants disappear from the active flag list. Preview again to refresh scores. Configuration changes clear prior flags; append-only audit records remain.

## Migration and Demo

Deploy 20260927000000_recruiting_rules with the existing Prisma migration workflow before deploying UI/server actions. It creates two private tables without updating existing application statuses or creating any default rule.

Demo uses the same evaluator and schemas with isolated browser persistence, MII leader scope, version/stale checks, and a local audit trail. Reset clears rules, flags, and audit entries. No real action is called from the Demo adapter.

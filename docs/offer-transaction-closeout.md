# Offer response transaction and icon packaging closeout

Offer response and rescind actions now use the existing support-aware transaction wrapper. Provider authentication resolves before transaction acquisition; live support authority is checked before audited writes and before commit. Operational Club locking, recipient ownership, account status, offer state, least-privilege membership creation, immutable letters and idempotent notification production remain in the domain helper.

The previous limits are explicit and unchanged: 2,000 ms acquisition and 5,000 ms execution. Lock and statement limits come from the established wrapper. No automatic retry, new privilege, schema change or external delivery is introduced.

Native PostgreSQL coverage compares the prior raw action with the repaired action under identical 5,500 ms provider latency, exercises ordinary/support acceptance and decline with concurrent retries, proves atomic rollback after support revocation, verifies the five-second business-work timeout, and covers rescind attribution. Existing offer race and security tests remain required.

The runtime tracing configuration also includes the existing favicon SVG and Apple icon PNG. Metadata handlers read these files at runtime; public static serving alone does not ensure they are packaged inside the function.

Local execution was unavailable during preparation. Final-source CI and preview are required before merge. Hosted offer response must be checked with a controlled applicant, with email disabled. This change does not establish a cause for other historical transaction failures or clear all production-readiness gaps.

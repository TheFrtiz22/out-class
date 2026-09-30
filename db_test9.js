// Retired: this script previously replaced public.User IDs by matching email.
// Review prisma/setup_auth_trigger.sql for the canonical identity-preserving SQL.
// Applying that SQL requires a separately authorized deployment.
throw new Error("Retired unsafe Auth trigger installer. No database connection was opened.");

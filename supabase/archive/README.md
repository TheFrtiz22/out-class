# Historical evidence — never replay

20260923181745_remote_schema.sql is an unchanged remote snapshot retained for drift/history comparison. It overlaps Prisma's baseline, contains differently named duplicate enums and broad legacy policies, and is not a supported fresh install or deployment path.

Do not move it back into supabase/migrations, apply it with psql, or mark Prisma migrations applied merely because this snapshot was recorded by Supabase. See ../../docs/database-deployment.md.

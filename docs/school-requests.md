# Public school requests

The shared public navigation links to `/request-school`. Anyone can submit interest as a student, club leader, or university administrator. The homepage’s existing Get Started action still opens the student onboarding modal (or the club experience for the selected club perspective); information pages link to `/?signup=student` to open that same student modal. Log In uses the existing `/login` route and its existing redirect handling.

FAQ links to the expanded existing accessible accordion at `/uva#faq`. How It Works uses `/#about` with the existing sticky-header scroll offset. About remains `/about`.

Apply `20261008000000_school_requests` before deploying this application, following [database-deployment.md](./database-deployment.md). Generate Prisma Client after migration. No remote database migration is implied by local implementation or validation.

`POST /api/school-requests` requires the browser’s same origin, bounds the request to 16 KiB, validates fields with Zod, and accepts any valid contact email. A honeypot filters basic automated submissions. A PostgreSQL transaction advisory lock serializes submission limits across instances: three requests per normalized email per day and 100 requests across the platform per hour. Failed persistence returns an error, never a success confirmation. Demo and support-view writes remain blocked.

The `SchoolRequest` table enables RLS and denies direct browser-role CRUD. Only the server persists or reads requests. Superadmins review at `/platform/school-requests` under existing allowlist, active grant, MFA, elevation, and impersonation guards. List reads and reviews write to the existing audit log; reviews use row locks and optimistic revisions. Statuses are Pending, In Review, Contacted, and Closed. No status grants university or account access, creates a school, or sends an email. Follow-up is manual.

# OutClass legal operator transition — October 20, 2026

OutClass remains the product brand. The company information supplied for this release identifies its operator as OutClassPlatforms LLC, a Virginia limited liability company.

## Public surface audit

| Surface | Finding and disposition |
| --- | --- |
| Homepage and shared public footer | Draft disclosed the LLC but used an incomplete copyright. Set the requested `© 2026 OutClassPlatforms LLC. All rights reserved.` and retain the operator disclosure. |
| About | Preserve the draft's Virginia LLC statement and the full disclaimer that OutClass is not an official UVA service and is not owned, sponsored, or endorsed by UVA. |
| UVA landing page and FAQ | Shared footer discloses the operator. FAQ now identifies the LLC while preserving university independence. Existing UVA page disclaimer remains intact. |
| Request Your School | Uses the shared footer and public metadata. No changes to form submissions or data handling. |
| Contact | Existing homepage dialog, not a standalone Contact page. Add the operator's legal identity; preserve the campus-pilot action. No approved business email, phone, or street address was supplied for publication. |
| Privacy and Terms | Existing homepage dialogs are publication placeholders, not substantive policies. Add the verified operator identity and explicitly state each policy has not yet been published. Preserve their open, close, and focus-restoration behavior. |
| SEO | Add the LLC as metadata publisher, preserving OutClass titles, application name, social branding, canonical URLs, and indexing rules. |
| Schema.org | Preserve Organization.name = OutClass; set legalName = OutClassPlatforms LLC. Preserve the website publisher's organization reference. No address or registrant assertions. |
| Public club profiles | Continue identifying the club itself; inherited metadata identifies the platform publisher. Do not imply the LLC owns student organizations. |
| Sign-in, signup, password recovery, invitation and other account routes | Retain product branding and existing access/indexing behavior. No authentication or permission changes. |
| Email templates and archived audit previews | Outside this website-only release; no hosted authentication template changes. Archived before/after previews are not served as website pages. |

## Policies requiring legal review

The current Privacy and Terms dialogs do not constitute completed policies. Before publishing substantive policies, review actual collection and processing of account, profile, application, resume, interview, evaluation, scheduling, school-request, analytics, and communication data. Verify recipients and service providers, retention/deletion behavior, contact and request procedures, and applicable obligations. Counsel should review service terms, user and organization responsibilities, intellectual property, limitations, and dispute provisions. This release introduces no claims about those matters and supplies no invented consent, retention, security, or compliance promises.

No dorm address, personal contact details, registered-agent address, or unverified business address is added. Domain registration, DNS, nameservers, and registrant records are unchanged. This release makes no claim that a domain transfer has completed; that requires confirmation from Network Solutions.

## Failure investigation

The Vercel status linked to the draft head `08c5fe0` was a canceled preview (`dpl_hXZuQU8F9FW6biqCvZg67k1XXRpN`), with reason: “The deployment was canceled because a newer deployment superseded it.” It produced no application build-error log. The same PR's `ff973a2` preview reached READY; its actual build logs show successful compilation, output creation, and deployment.

Separately, GitHub Actions run `39467888761`, job `118783961212`, failed in `tests/seo.test.cjs:146`: the footer test still expected `OutClass is an independent platform.` after the draft changed that copy. Update the assertion to the verified operator disclosure, and verify the exact copyright, legalName, metadata publisher, and About statement in the existing rendering tests. Native transaction validation passed in the original run.

The PR branch incorporates current main without replacing teammates' staffing work. No dependency, database, migration, environment, DNS, authentication, or permission configuration changes are part of this release. The repository's migration validation runs only in disposable in-memory PGlite databases; it does not apply migrations to Supabase or production.

## Local verification

- Frozen pnpm lockfile installation succeeds without dependency changes.
- TypeScript validation succeeds; ESLint succeeds with 26 pre-existing warnings and no errors.
- Full suite: 1,303 tests, 1,269 passed, 34 skipped, zero failures.
- Disposable PGlite migration validation succeeds for all 57 migrations and 78 tables; no external database is used.
- Optimized production build succeeds on Node 24, matching the Vercel project runtime.
- Built-site browser checks confirm the footer, About ownership and UVA disclaimer, publisher metadata, Privacy/Terms dialogs, desktop/mobile rendering without horizontal overflow, and mobile navigation.
- Before release, the existing production browser session followed Log In into its authenticated club workspace without a new sign-in or any permission changes. Repeat this read-only check after production is READY.

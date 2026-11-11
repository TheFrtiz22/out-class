# Legal review checklist (for counsel)

Drafts: `lib/legal-content.ts` (Privacy Policy, Terms of Service, Cookie Policy, Legal page). Routes `/privacy`, `/terms`, `/cookies`, `/legal` return 404 until the owner sets `LEGAL_PAGES_PUBLIC = true` after this review. Drafted 2026-11-11 on branch `legal/policy-pack`; facts were checked against the code at `b2476112`.

## Placeholders to fill

| Placeholder (exact text on the page) | Where | Who |
|---|---|---|
| `[effective date]` | Header of every policy; Privacy §15, Terms §16, Cookies §5 | Owner, on publication |
| `[mailing address: set OUTCLASS_POSTAL_ADDRESS]` | `/legal` when the env var is unset | Owner: set `OUTCLASS_POSTAL_ADDRESS` in Vercel (also used in every email footer) |
| `[DMCA designated agent name]` | Terms §8, `/legal` | Owner registers an agent at copyright.gov |
| `[DMCA designated agent mailing address]` | Terms §8, `/legal` | Owner |
| `[DMCA designated agent telephone]` | Terms §8 | Owner |
| `[DMCA designated agent email, e.g. copyright@out-class.net]` | Terms §8, `/legal` | Owner (create the mailbox) |
| `[counsel: terms for users under 18, e.g. first-year students aged 17]` | Terms §2 | Counsel |
| `[counsel/owner: retention period after account closure]` | Privacy §8 | Counsel and owner |
| `[confirm state of organization: Virginia]` | Privacy §1, `/legal` | Owner |

Also confirm `hello@out-class.net` is monitored: it is the contact for privacy requests, content reports and removal appeals.

## Open questions

1. **CCPA applicability.** Privacy §12 is written "if the CCPA applies to us". OutClass likely falls below every CCPA threshold today ($25M+ revenue, 100,000+ consumers, or 50% of revenue from selling data). Keep, trim or expand §12? CalOPPA applies regardless; the Do Not Track statement is in Privacy §7. Also consider the Virginia CDPA thresholds.
2. **Students aged 17.** Signup is limited to `@virginia.edu` addresses and the Terms set a 13+ minimum, but some first-years are 17. Terms §2 currently requires parent/guardian agreement for under-18 users, which may be impractical. Options: 18+ only; 17-year-olds with guardian consent; or rely on university enrollment. There is no age question at signup and no clickwrap acceptance yet (adding one needs a schema migration and owner approval).
3. **FERPA.** Privacy §13 says OutClass contracts directly with students and Clubs, receives no university records, and holds self-reported GPA and test scores. Confirm this wording, and advise before any agreement with UVA or any data feed from university systems, which could make OutClass a "school official".
4. **UVA trademark use.** The product and emails use "University of Virginia", "UVA", "Beginning at Virginia", UVA colours and Rotunda imagery, with independence disclaimers (Privacy §1, Terms §10, footer). Is this nominative use acceptable, or is a licence or rewording needed before scale-out?
5. **Image rights.** Several campus photos (opening images, `lawn-aerial.jpg`, `sunset-rotunda-*`, also used on every social share card) have no licence record (`public/images/campus/README.md`). They need written licences or replacement, and CC-licensed images need visible credits.
6. **Clubs as independent controllers.** Terms §3 and Privacy §4 make Clubs responsible for their own use of applicant data and their exports (which include email and computing ID). Is that allocation adequate, or should Club leaders accept separate Club terms?
7. **Deletion and export.** Privacy §10 offers access, correction, deletion and export by email request; there is no self-service deletion or export yet. Confirm the 45-day response commitment (§11) and that retaining Club recruiting records after deletion (§8) is acceptable.
8. **Liability cap, venue and clickwrap.** Terms §13 caps liability at US $100 and §15 sets exclusive Virginia venue. Without a signup checkbox the Terms may be unenforceable browsewrap.
9. **Email.** All current email is transactional or relationship mail (no marketing). Digests and Club announcements now carry `List-Unsubscribe` with one-click unsubscribe; every email footer carries the preferences link and, once `OUTCLASS_POSTAL_ADDRESS` is set, the mailing address. Confirm no CAN-SPAM commercial-message obligations remain.
10. **Email images via GitHub.** Email artwork loads from `raw.githubusercontent.com`, so GitHub receives recipients' IP addresses when images load. Disclosed in Privacy §6; consider moving to an owned asset host.

## Owner configuration before publication

- Set `OUTCLASS_POSTAL_ADDRESS` (Vercel, Production). Then regenerate the Auth email templates (`node scripts/email-audit.cjs build` with the variable set) and upload them to Supabase Auth, so sign-in emails carry the address too.
- Set `EMAIL_UNSUBSCRIBE_SECRET` (32+ random characters, server-only) to enable one-click unsubscribe. Without it, `List-Unsubscribe` points to the preferences page only.
- In the hosted Supabase Auth settings, change the confirmation email subject to "Verify your UVA email for OutClass" (the repo copy in `supabase/config.toml` is updated; the hosted setting is not changed by this branch).
- After counsel signs off: fill every placeholder above, set `LEGAL_EFFECTIVE_DATE`, and flip `LEGAL_PAGES_PUBLIC`.

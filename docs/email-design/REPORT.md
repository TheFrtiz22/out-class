# OutClass email redesign — October 10, 2026

The redesign covers all 11 existing templates and variants. Eight final design-test emails were delivered to `bsb4rd@virginia.edu`, observed in Inbox, and inspected in actual Microsoft 365 Outlook Web in light and dark modes. The application changes and seven Supabase Auth HTML files are prepared locally. **Nothing was deployed, and no hosted Auth templates, DNS, credentials, sender settings, rate limits, or permissions were changed.**

Open the [before/after gallery](index.html) and the separate [actual Outlook Web gallery](outlook-web/index.html). Message IDs and validation evidence appear below.

## The OutClass identity

The official navy/orange sabre wordmark anchors a publication-like masthead. Its paired underline strokes become a small double-rule signature, ending in orange. The recurring rule, compact category labels, consistent 560px measure, and typographic footer give every email a recognizable rhythm.

The typography deliberately uses system fonts: Segoe UI / Helvetica / Arial for instructions, security notices, and controls; Georgia for opportunity and invitation headings. This borrows the academic character of the existing brand without depending on Horsham Serial downloads. Code typography uses Consolas / Courier New, with one selectable six-digit string rather than individually boxed digits.

The initial warm-paper palette looked good in browser simulations but became muddy gray in actual Outlook Web. The final inline backgrounds are neutral white, gray, and pale gray; orange and editorial typography supply warmth. Clients honoring the embedded dark CSS get a deep navy palette with cream text and a cream CTA. The verified Outlook Web path uses its own deliberate charcoal transformation with a slate/navy CTA and orange border.

| Template | Composition and change | Publication path |
|---|---|---|
| Six-digit sign-in OTP | Compact sans-serif heading, prominent single-string code, fine rules, one-hour expiry, short security footer | Hosted Magic Link body; remains numeric OTP |
| Signup verification | Georgia headline “Your next opportunity starts here.”, concise campus copy, prominent code | Hosted Confirm Signup body |
| Password recovery | Clear reset heading and action, one-hour expiry, underlined fallback URL | Hosted Reset Password body |
| Password changed | Orange-edged confirmation notice, reassuring copy, unexpected-change instructions and account-security link | Hosted Password Changed notification body |
| Member invitation | Organization name leads, optional organization logo, personal invitation copy, review CTA | Application SMTP |
| Administrator invitation | Leadership category, organization-led hierarchy, explicit administrator designation notice | Same application sender with owner variant |
| Legacy invitation | Shared community composition; existing email-bound invitation route remains intact | Application SMTP, legacy variant |
| Student account claim | Personal salutation, student-account heading, clear claim action and invitation expiry policy | Application SMTP |
| Native Supabase Invite | Branded account invitation with provider confirmation URL | Prepared hosted body; no application trigger |
| Email address change | Security composition, new-address notice and provider confirmation action | Prepared hosted body; no application trigger |
| Reauthentication | Code-led identity check with cautious expiry wording | Prepared hosted body; no application trigger |

## Outlook and dark-mode implementation

Presentation tables, inline colors, `bgcolor` fallbacks, table cell padding, a 560px MSO width wrapper, 96-DPI Office settings, and Outlook font fallbacks form the baseline. Headings, links, buttons, notices, code surfaces, and footer text carry explicit colors. CTA targets are 50px tall and 232px wide, fitting the 320px layout.

Classic Outlook receives a separate VML button through MSO conditionals. The VML and HTML versions carry the same escaped URL; an underlined text fallback remains visible. VML uses a solid navy fill, orange stroke, and an MSO text-fill fallback. This branch is code-reviewed and regression-tested, **not verified in classic Outlook Windows**.

Media-query styles are paired with `[data-ogsc]` and `[data-ogsb]` targeting. Their selector branch was exercised separately from `prefers-color-scheme`. Actual Microsoft 365 Outlook Web stripped the embedded styles in the observed message path and applied its own color transformation, so the inline fallback palette was adjusted using that real result. This is why the browser dark screenshots and Outlook dark screenshots differ.

In the final recovery message, Outlook Web produced a `#292929` paper surface and `rgb(164,177,195)` muted text, giving **6.69:1** contrast. Its transformed CTA gave **6.92:1** contrast. Light-mode muted text measured **5.93:1** and CTA text **13.05:1**. [Measured client colors](outlook-checks.json) are retained. The intended light/dark palettes also pass the small-text contrast regression check.

The opaque official JPEG keeps the navy wordmark on its own white surface when the surrounding email changes color. The first real test uncovered Vercel Security Checkpoint 403 responses to mail-image requests. Final templates use the **existing public, commit-pinned repository artwork**, verified byte-for-byte against the local official files. Built-in club artwork uses the same pinned public source; independently hosted HTTPS organization logos retain their supplied URL. No asset was uploaded or published. A dedicated brand CDN can replace the pinned source later if approved.

These techniques are informed by [Litmus’s dark-mode guide](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers), [Outlook selector guidance](https://help.litmus.com/article/617-dark-mode-builder), and [VML button guidance](https://www.litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design). Provider variables and publication scope follow [Supabase’s email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates).

## Visual evidence and client coverage

The “before” baseline is the actual starting local design, including the prior audit’s improvements. Its eleven HTML snapshots were saved before editing. The invitation screenshots normalize the illustrative organization name to Enactus at UVA for comparison; they do not represent a real invitation.

There are **132 browser comparison renders**: eleven variants × before/after × desktop light, desktop dark simulation, 375px light/dark simulation, and 320px light/dark simulation. A further **22 fallback checks** cover the Outlook selector branch and removal of head styles with images hidden. All final render checks pass: no horizontal overflow, missing repository artwork, or unresolved template variables. Gallery artwork is loaded from repository files during rendering to avoid repeatedly requesting production. That check does not establish remote mail-image delivery.

Actual Outlook evidence is separate: **16 recipient-side inspections**, one light and one dark check for each of the eight final implemented variants. Top/bottom screenshots and middle captures for longer invitations preserve the relevant content. Both the brand image and all invitation organization images loaded in those final client checks. The original Outlook Light appearance was restored; [restoration evidence](outlook-theme-restoration.json) is recorded.

| Client / surface | Evidence |
|---|---|
| Microsoft 365 Outlook Web, Chrome on macOS | Actual recipient mailbox, eight final previews inspected in light and dark; logos, codes, text, CTA, fallback URLs, notices and footers reviewed |
| Chromium at 720px, 375px, 320px | Before/after browser renders, light and CSS dark simulation |
| Outlook classic Windows | MSO/VML source and URL-parity checks only; Word rendering unverified |
| New Outlook Windows | Not accessed; native client unverified |
| Outlook desktop Mac | Not accessed; native client unverified |
| Outlook iOS / Android | Not accessed; native client unverified |
| Gmail desktop / mobile | Not accessed; client rendering unverified |
| Apple Mail | Not accessed; client rendering unverified |

No Litmus or Email on Acid account was available in the connected environment. Browser simulations do not certify those untested clients. Actual image blocking, screen-reader behavior, native-client font metrics, high-contrast mode, and forced inversion in other clients remain unverified.

## Real test messages

All subjects begin `[OutClass Design Test]`. Every send reused the available existing Resend key with `smtp.resend.com:465` and the established OutClass sender. Production SMTP secrets were redacted by Vercel; this does not prove the hidden application `SMTP_PASSWORD` equals that key. All messages have HTML and text alternatives. No global worker or production invitation queue was invoked.

The first pass sent eight previews at 11:47 AM EDT. Actual Outlook exposed the protected-logo URL and warm-background transformation. A second, explicitly selected final pass at 11:52 AM EDT sent one corrected preview per implemented variant. **All 16 messages have a Resend Delivered event.** The eight final messages below were also directly observed in the recipient’s Inbox. These are safe SMTP design previews, **not reruns of Supabase Auth or invitation acceptance workflows**. Codes are illustrative; authentication and legacy-grant links are inactive. No password or account/membership permission changed.

| Final template | Resend message ID | Delivery / inbox |
| magic-link | [01a12683-d71a-71fd-9f00-fa88f75352ff](https://resend.com/emails/01a12683-d71a-71fd-9f00-fa88f75352ff) | Delivered; Inbox observed |
| confirmation | [01a12683-d845-7336-948b-68155dbfe727](https://resend.com/emails/01a12683-d845-7336-948b-68155dbfe727) | Delivered; Inbox observed |
| recovery | [01a12683-da20-730c-aaa0-149ed5ce8cd2](https://resend.com/emails/01a12683-da20-730c-aaa0-149ed5ce8cd2) | Delivered; Inbox observed |
| password-changed | [01a12683-dc5e-7141-a8c4-5ac8902a6d6e](https://resend.com/emails/01a12683-dc5e-7141-a8c4-5ac8902a6d6e) | Delivered; Inbox observed |
| member-invitation | [01a12683-df08-7ac5-a5d8-d50bd09b8195](https://resend.com/emails/01a12683-df08-7ac5-a5d8-d50bd09b8195) | Delivered; Inbox observed |
| administrator-invitation | [01a12683-e1ba-7820-83f4-53e5f5e9c990](https://resend.com/emails/01a12683-e1ba-7820-83f4-53e5f5e9c990) | Delivered; Inbox observed |
| legacy-invitation | [01a12683-e43f-78ea-bb9b-a040337a6b53](https://resend.com/emails/01a12683-e43f-78ea-bb9b-a040337a6b53) | Delivered; Inbox observed |
| student-claim | [01a12683-e616-79ab-874d-7b8adffc366b](https://resend.com/emails/01a12683-e616-79ab-874d-7b8adffc366b) | Delivered; Inbox observed |

The [send ledger](send-results.json) includes both passes, SMTP Message-ID headers, content hashes, and UTC timestamps. [Provider observations](provider-observations.json) and [Outlook checks](outlook-checks.json) retain non-secret evidence. Temporary downloaded production credentials were removed after the final send.

## Functionality and validation

Changes are confined to composition, copy, optional logo forwarding, local template configuration, preview tooling, and evidence. Existing OTP/signup/recovery entry points, token validation, token fragments, Resend transport, sender, cooldowns, locks, identity verification, invitation acceptance, tracking, and outbox state behavior are preserved. The logo field comes from the club already loaded by the worker; no new database query or permission was introduced.

The new Auth generator produces all seven versioned HTML files. Signup and sign-in continue to use `{{ .Token }}`. Recovery retains exactly `{{ .RedirectTo }}#token_hash={{ .TokenHash }}` in VML, HTML CTA, text, and fallback. Native Invite and email-change bodies retain provider confirmation variables. Student claim still validates the token and binds the same fragment to `/auth/student-claim`. HTML dynamic values remain escaped, and organization artwork accepts only HTTPS without embedded credentials.

- Full suite: **937 passed, zero failed, nine skipped** (946 total).
- Migration checks: all 31 migrations tested on fresh and legacy databases; all 54 tables enforce RLS.
- Lint: zero errors, 25 existing warnings.
- TypeScript and production build: passed after the final template changes.
- Browser checks: 154 checks, zero failures.
- Actual Outlook Web: sixteen final light/dark inspections; all images loaded.
- New regressions cover Auth-variable and recovery-link parity, generated-file consistency, unsafe logo URLs, palette contrast, and neutralization of design-test links. Existing transport, student-claim, throttling, and outbox regressions pass.

[Validation record](validation.json) gives the command results. Actual hosted Auth plain-text generation and auth completion were not rerun; the previous audit remains their historical delivery/security evidence.

## What is ready to publish

Application publication requires the changed email modules and the optional organization-logo field forwarding in `utils/email.ts` / `utils/invitation-delivery.ts`. The generator is `lib/auth-email-templates.ts`; `npm run email:templates` regenerates the seven files under `supabase/templates`. `npm run email:previews` regenerates the comparison gallery without reading credentials. Its renderer uses the existing local Playwright harness, with `OUTCLASS_PLAYWRIGHT_MODULE` available to point to another installation.

Hosted Supabase publication is separate from the application deployment. Review and paste the prepared bodies for Confirm Signup, Magic Link, Reset Password, and Password Changed. Keep the enabled password-change notification, six-digit OTP configuration, one-hour Auth expiry, sender, rate limits, redirects, and credentials as established. The local `supabase/config.toml` wires all seven prepared files for local development; it was not pushed.

Native Invite, Email Change, and Reauthentication bodies are also ready for optional publication, but have no application trigger. Their presence does not authorize enabling new workflows or additional notification settings. Existing hosted subjects were not edited during this task.

**Both application deployment and hosted Auth publication still require explicit approval.** No DNS or authentication-credential change is part of this publication. After publication, repeat the supported live Auth checks with an approved test account and continue testing the unverified native mail clients.

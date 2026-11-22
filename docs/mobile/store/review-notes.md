# App Review notes and reviewer account plan (draft)

## Sign-in
Accounts are created in the app (Sign up) or on the website with a university email
(`@virginia.edu` at launch), confirmed by an emailed code. There is no third-party sign-in, so Sign in
with Apple is not offered (Guideline 4.8 applies to apps that use a third-party or social login; adding
Microsoft or "Continue with UVA" to the app later would change that).

## Reviewer account
App Review cannot receive a university email. Plan:
1. In **production**, the owner creates one reviewer account the same way staging's are made (Supabase
   Auth admin API, confirmed email, on the allowed domain, e.g. `appreview@virginia.edu` is NOT
   possible without a real mailbox; use an address the owner controls on the allowed domain or add a
   reviewer-only allowance the owner approves).
2. Put it in a demonstration club with fictional members, one open application, one bookable
   interview round, one meeting open for check-in and one voting session, mirroring
   `scripts/staging/seed.cjs`.
3. Give Apple and Google the email, password and these notes. Rotate the password after review.
**Open owner decision:** how a reviewer gets an account while sign-in is limited to one email domain.

## What to try (for the reviewer)
1. Sign in. Home shows the next step, tasks, applications and clubs.
2. Explore → open a club → Follow → Apply. A draft saves as you type.
3. Applications → an interview-stage application → pick a time → Confirm.
4. Home → Check-in pass shows a rotating code a club leader scans at the door.
5. Header → Scan opens the camera for OutClass check-in codes. (Camera is used only here and for a
   profile photo.)
6. Profile → Settings → Account & Security → Delete account (Guideline 5.1.1(v)): deletion is requested in the
   app, scheduled, and can be cancelled.

7. Objectionable content (Guideline 1.2): the flag button on a club profile or an event, and "Report this
   announcement" in an inbox message, send a report to the OutClass team. Profile → Settings → Legal and
   support has the Terms, the Privacy Policy and "Contact us" (hello@out-class.net).

## Notes
- Push notifications are optional and are requested only from Inbox → notification preferences.
- The app shows no campus photography and no real student data in screenshots.
- Leader tools (door scanner, voting host, announcements) appear only for accounts with those
  club permissions; the server enforces each one.

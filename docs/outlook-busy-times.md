# Outlook busy times in the availability editor

Status: implemented, off until configured. Branch `scheduling/outlook-busy`. No migration, no stored tokens.

## Journey

1. In the availability editor's **Specific dates** view, an interviewer selects **Check Outlook**.
2. A popup opens `/api/calendar/outlook/start?week&nonce`. It requires a signed-in OutClass account (not
   demo, not Admin view), stores state, a PKCE verifier, the week, the nonce and the account ID in a
   10-minute httpOnly cookie scoped to `/api/calendar/outlook`, and redirects to Microsoft for
   `Calendars.ReadBasic` only (no `offline_access`, so no refresh token).
3. `/api/calendar/outlook/callback` checks state and that the same OutClass account is signed in,
   exchanges the code, reads `/me/calendarView` for that week (`start,end,showAs,isCancelled,isAllDay`
   only: no subjects, bodies, locations or attendees), discards the token, clears the cookie and
   returns a page that posts the busy intervals to the opening editor on the same origin and closes.
4. The editor converts them to Eastern quarter hours inside 8 AM–9 PM and shows how many available
   quarter hours conflict. **Mark unavailable** removes only those, through the normal save queue and
   revision checks. Nothing is ever added. On a submitted round the change un-submits it, as any
   edit does, and the editor says to submit again.

Busy, tentative and out-of-office block; free, working elsewhere and cancelled events do not.
All-day events cover their own Eastern dates. More than 1,000 events in a week is reported as an
error rather than a partial result.

## Turning it on (owner)

1. Microsoft Entra admin center (UVA tenant, likely via UVA IT): register an app, single tenant.
   Redirect URI (Web): `https://www.out-class.net/api/calendar/outlook/callback`. API permission:
   Microsoft Graph delegated `Calendars.ReadBasic`. Create a client secret.
2. **UVA IT decides whether users may consent** to that permission or whether an administrator
   must grant consent for the tenant. Until one of those happens, users see "Your university needs
   to approve OutClass for Outlook access…".
3. Vercel Production env: `NEXT_PUBLIC_OUTLOOK_CALENDAR_ENABLED=true`, `MICROSOFT_CALENDAR_CLIENT_ID`,
   `MICROSOFT_CALENDAR_CLIENT_SECRET`, `MICROSOFT_CALENDAR_TENANT` (the UVA tenant ID; `common`,
   `organizations` and `consumers` are refused). Redeploy.

In production the redirect URI is only built from `OUTCLASS_SITE_URL`'s origin; previews and local
development use their own origin and need their own registered redirect URI.

## Verification still needed

A real UVA account: consent path, the actual AADSTS codes for the approval screen, popups on iOS
Safari and Android Chrome (opener may be lost in in-app browsers), and that Microsoft's sign-in pages
do not sever `window.opener` in Chrome, Safari and Firefox.

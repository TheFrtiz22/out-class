# App Privacy (Apple) and Data Safety (Google Play): draft answers

Drawn from what the app and the API it calls actually do on branch `mobile/foundation`
(2026-11-18). Re-check before submission if code changes. Counsel should review alongside the
site's Privacy Policy.

## What the app collects, and why

| Data | Where it comes from | Linked to the user | Used for | Shared with third parties |
| --- | --- | --- | --- | --- |
| Email address | Sign-in | Yes | Account, app functionality | No (Supabase is the processor for authentication) |
| Name, pronouns, major, class year, GPA and test scores if entered, LinkedIn URL, bio | Profile | Yes | App functionality (applications to clubs the student chooses) | Shown to the clubs the student applies to |
| Phone number | Profile (required to apply) | Yes | App functionality (clubs call with offers) | Shown to the clubs the student applies to |
| Photo (headshot) | Camera or photo library, only when the student adds one | Yes | App functionality | Shown to the clubs the student applies to |
| Resume and task files | Document picker, only when the student uploads | Yes | App functionality | Shown to the clubs the student applies to |
| Application answers, interview bookings, RSVPs, attendance, votes | User actions | Yes | App functionality | Visible to that club's authorized leaders |
| Push token | Device, only if notifications are turned on | Yes | App functionality (notifications) | Expo's push service, then Apple/Google, to deliver the push |
| Crash and error class names | Device, only once Sentry is configured | No | Diagnostics | Sentry (processor). No message text, input, tokens or scanned codes |

Not collected: location, contacts, browsing history, advertising identifiers, health, financial
or payment data, precise device identifiers for tracking. No tracking, no ads, no data sale.

## Apple App Privacy labels
- **Data linked to you:** Contact Info (email, phone, name), User Content (photos, documents, other
  user content), Identifiers (user ID), Usage/Other Data (attendance and application activity).
  Purpose for all: App Functionality.
- **Data not linked to you:** Diagnostics (crash data), once Sentry is on.
- **Tracking:** No.

## Google Play Data Safety
- Data collected: Personal info (name, email, phone, other info), Photos (optional), Files and docs
  (optional), App activity (in-app actions), Device or other IDs (push token, optional).
- All collected for App functionality; none for advertising. Encrypted in transit: yes (HTTPS).
- Account deletion: in the app (Profile → Settings → Account) and on the website. Deletion is
  scheduled, can be cancelled before it completes, and is completed by OutClass.

## Permissions the app requests, and when
| Permission | When it is asked | If declined |
| --- | --- | --- |
| Camera | First time the scanner or "Take photo" is opened | Scanner explains and offers Settings; photo library still works |
| Photos | Choosing a profile photo (system picker) | Nothing else changes |
| Notifications | Only from the Inbox "Push notifications" switch, never on launch | In-app inbox still works |
| Calendar (add only) | "Add to Calendar" on an interview or event | The event is not added |

## iOS privacy manifest
`mobile/app.config.ts` → `ios.privacyManifests`: no tracking, no tracking domains, required-reason
APIs declared for UserDefaults (CA92.1), file timestamps (C617.1), system boot time (35F9.1) and
disk space (E174.1), which React Native and Expo modules use.

# Feature preservation matrix

Appended by `outclass-journey-verify`. Labels: implemented, partially implemented, demo-only, unverified.


## 2026-11-18 MOBILE-0 inventory (web status of every journey the native app mirrors)

Read from current `main` (987dca4b) code, then exercised through the mobile API on staging where noted. "API" = answered 200 with seeded data for the staging student or leader through `app/api/mobile/v1`.

| Journey | Web actions (source of truth) | Notifications | Web status | Through the mobile API |
| --- | --- | --- | --- | --- |
| Home (to-do, tasks, applications, clubs) | `getStudentDashboardData`, `getTaskNotifications`; `lib/student-home.ts` derives the view in the browser | none of its own | implemented | API (`home.view` runs the same helpers on the server) |
| Explore, search, Corkboard events | `getClubDirectory`, `searchWorkspace`, `getPublicCorkboard`, `setSavedCampusEvent` | none | implemented (Typesense optional, not configured) | API |
| Club page, follow/save | `getPublicClub`, `setCorkboardClub`, `startClubApplication` | none | implemented ("Follow" saves the club; no email updates, decision 2026-11-07) | API |
| Profile (phone, headshot, resume) | `getStudentProfile`, `updateStudentProfileSection`, `uploadProfileFile`; `/api/resumes`, `/api/profile-photos` | none | implemented | API for reads and writes; private media routes authenticate by cookie only (see final report) |
| Applications (draft, autosave, submit, status) | `saveApplicationDraft`, `submitApplication`, `getStudentApplications` | none on submit | implemented | API |
| Interview booking, rescheduling | `getApplicantSchedule`, `reserveInterview`, `cancelRoomBooking` | panel notified; "Book your interview" to students | implemented | API |
| Decisions, offers | `getDecisionLetter`, `respondToOffer` | decision, offer response | implemented | API |
| Inbox, preferences, push | `getDurableNotifications`, `setDurableNotificationsRead/Archived`, preferences; Web Push (S1-8) | email outbox, then push | implemented; Web Push real-device delivery unverified (S1-8) | API; native push channel added, server-to-device unverified (no APNs/FCM credentials) |
| Calendar, events, RSVPs, meetings | `listMeetings`, `getMeeting`, `setCampusEventRsvp`, calendar feed | none | implemented | API |
| QR check-in (student scans room code) | `issueMeetingCheckIn`, `checkInMeeting`, `/q` short links | none | implemented | API (`shortLinks.resolve` + `meetings.checkIn`) |
| Door mode (leader scans a pass) | new: `issueCheckInPass`, `scanCheckInPass` | none | not on the web (native only) | API; migration on staging only |
| Live voting | `getLiveVotingRoom`, `castLiveVotingBallot`, `commandLiveVotingRoom`, join | voter invitations | implemented (redesigned #395) | API |
| Tasks | `getTaskWorkspace`, `viewTask`, `submitTask`, files | computed, not durable | implemented | API |
| Settings, account deletion | `requestAccountDeletion`, `cancelAccountDeletion` | deletion email | implemented | API |
| Alumni read-only | `assertNotAlumni`/`alumniRefusal` in every write | none | implemented, server-side | API returns the same refusals (403 `ALUMNI_ACCOUNT`) |
| Leader: pipeline glance, announcements, interview notes | `getClubPipelinePage`, `publishClubAnnouncement`, interview collaboration | announcement inbox + outbox | implemented | API |
| Club messaging | stubs (`Promise<never>`) | none | not a feature (direct messaging cut, decision 2026-11-05) | not exposed |

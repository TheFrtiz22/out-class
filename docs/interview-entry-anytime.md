# Interview entry before, during and after the scheduled time — November 6, 2026

**Scope:** make early starts and late-running interviews work naturally without a new entry path.

## Findings
- Server entry was already clock-independent. `getAssignedInterviewRooms` and `resolveInterviewRoomEntry` (`actions/interview-entry.ts`) and `ownPanelAssignments` check authentication, active membership, interviewer capability, the personal panel assignment, the approved/published panel, booking identity, applicant, cycle and round, and archived rounds. They never check the time. The countdown (`components/interview-timer.tsx`) starts only on **Start**, and at zero it pauses with "Time's up". It never submits, closes the room or removes access.
- The friction was in presentation:
  - after the scheduled end, an unfinished interview read "Not started"
  - earlier days are collapsed by default, so unfinished work from past dates was easy to lose
  - there was no timing context, and labels varied ("Open interview", "Open review", "Open your interview & kit")

## Changes
- `lib/interview-entry.ts`, used by the real and Demo adapters through the shared UI. Every helper takes an explicit `now` so tests can control the clock:
  - `interviewEntryAction(row)`: **Enter interview** (nothing saved), **Resume interview** (this interviewer's unfinished record), **View review** (this interviewer submitted; opens the existing read-only review, never re-editable). The interviewer's own record decides it, never the clock.
  - `interviewEntryStatus(row, now)`: *Cancelled* (booking or room cancelled), *Review submitted*, *Awaiting booking*, *In progress*, *Scheduled now*, *Scheduled time has ended*, *Upcoming*. Ended time, cancellation and submission are distinct.
  - `interviewTimingContext(row, now)`: "Scheduled for 3:00–3:20 PM EST · Starts in 10 minutes", "· Scheduled now" or "· Scheduled time has ended", in the room's time zone. Context only.
  - `unfinishedInterviewEntries(rows, now)`: openable, booked, unsubmitted, uncancelled interviews whose scheduled end has passed.
- Recruiting → Interviews → **Interview rooms** shows a compact **Unfinished interviews · N** list at the top, respecting the round filter, with one Enter/Resume action each. The date sections are unchanged, so the schedule isn't duplicated. Each row shows the timing line and the shared action label.
- The **room manager** booking list and the **dashboard preparation card** use the same labels, and the card shows the timing line.
- Assignment notifications and direct links were already clock-independent and are unchanged. They resolve to the exact booking and candidate through `interviewEntryHref`.

## Unchanged by design
- No new entry path and no candidate interview for an unbooked slot. Authorized manual assignments stay available through "Other assigned interviews".
- Cancelled bookings, revoked assignments, unrelated applicants, stale links, anonymous-review restrictions and closed/archived rounds stay denied by the existing server checks.
- Opening the room does not start the countdown, create a record, change drafts or alter booking or applicant status. Saved phase, notes, question completion, score draft and résumé state restore as before. One interviewer's submission doesn't affect another's unfinished review, because records are per interviewer.
- Entering early or late does not extend any physical room reservation or alter another booking.

## Evidence (local, synthetic)
- `tests/interview-entry.test.cjs` (9), new tests included:
  - controlled clock (before, during, after, three days later): the same Enter action, distinct statuses, exact timing text, the AM/PM period boundary, Resume and View review, and the unfinished list excluding future, submitted, cancelled, unbooked and denied entries
  - server projection and direct link for a slot in 2020: still open, while cancelled room, revoked assignment and archived round stay denied
- `tests/interview-unfinished-browser.test.cjs`: browser with a fixed clock, before the date (no section; "Starts in"; entry offered) and days later ("Unfinished interviews", "Scheduled time has ended", entry opens the exact candidate).
- Existing interview suites, including Demo drafts, own phases, refresh and submitted-review scoping, the date-section, entry, navigation and recovery browser tests, and native concurrency: 182 passed, 0 failed, 4 skipped. Two browser tests were updated for the renamed labels only.

## Live verification
Not performed from this workstation. There's no signed-in synthetic interviewer browser session on out-class.net. Deployment state and runtime errors are checked through Vercel. A live click-through needs a synthetic account session.

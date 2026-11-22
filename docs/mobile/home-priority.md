# How Home decides what to show first

Home (`mobile/src/app/(tabs)/index.tsx`) follows the owner's two Nov 22 mockups: a calm day looks like
mockup 1 (My Clubs, Coming Up, Applications), a busy day like mockup 2 (a card on top for the one thing
to do now, then Leading for club leaders). The rules live in `mobile/src/lib/home-priority.ts` and are
tested in `mobile/__tests__/render/home-redesign.test.tsx`. Everything shown comes from real data the app
already loads; nothing is made up to fill a slot.

## Greeting

The top bar greets the person the way the website does (`lib/welcome.ts`), by the phone's own clock:
"Good morning" from 5 AM, "Good afternoon" from noon, "Good evening" from 5 PM, and "Still up?" from 9 PM
to 5 AM. It refreshes every minute and when the app comes back to the front.

## The card on top (the hero)

Shown only when something is pressing; otherwise Home starts straight with its sections. When several
things qualify, the first rule below wins, and within a rule the soonest wins.

1. A meeting or event that starts within 3 hours or is under way (not all-day, not a deadline row, not one
   the person declined).
2. A live voting room in a club the person leads.
3. A task that is overdue or due within 24 hours (and still needs a submission).
4. An application draft due within 7 days that can still be sent.
5. A task due within 3 days.
6. An application draft due within 14 days.

Whatever is in the card is left out of the section below it, so it is never shown twice.

## Section order

Sections with nothing in them are hidden, except My Clubs, which always shows so "Find clubs" stays one tap
away. Each section is either urgent or calm, and urgent sections come first:

| Section | Urgent when | Urgent rank | Calm rank |
| --- | --- | --- | --- |
| Leading | applicants wait for review, a voting room is live, or an interview is later today | 1 | 4 |
| Tasks | a task is new (unread) or due within 48 hours | 2 | 5 |
| Coming Up | something (not a deadline) is on today | 3 | 2 |
| Applications | a draft is due within 7 days, or an application waits on the person (a decision, an offer) | 4 | 3 |
| My Clubs | never | 5 | 1 |

Ties keep the calm order: My Clubs, Coming Up, Applications, Leading, Tasks.

Inside Applications: waiting on the person first, then drafts due this week, then other drafts, then the
rest. Coming Up drops what has ended and sorts by start time. Each list shows three rows and a "View all"
link.

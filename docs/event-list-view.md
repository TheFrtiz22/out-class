# Events on Grounds: Corkboard and List View

`PublicEventBoard` owns one result set, filter state, page, selected event, and save hook. The existing `getPublicCorkboard` action supplies both layouts. Switching the segmented control changes only presentation: it does not navigate, refetch, or reset filters/pagination. The browser remembers the layout under `outclass:events:view:v1`; unavailable storage does not prevent switching.

The corkboard retains its pinned flyers and Radix detail dialog. List cards use the same dialog and native event permalinks, with keyboard activation and focus restoration. Save and calendar controls are siblings of the stretched event link, so they do not open the card. RSVP remains in the existing event detail flow, including capacity, deadline, authentication, cancellation, and permission handling.

List media uses the existing private flyer proxy, lazy loading, a responsive container, and `object-fit: contain` to preserve posters. The image optimizer remains bypassed to preserve the flyer's permission/revision checks and no-store behavior. Missing or failed images use the event's OutClass template colors, host, title, and category. Cards use content visibility, while the existing server pagination limits each page to 60 events.

## Saved events and release prerequisite

Apply Prisma migration `20261016010000_saved_campus_events` through the normal reviewed database release process before releasing this UI. No production migration is run by implementing or testing this feature.

`SavedCampusEvent` references the existing user and event, with a composite primary key and cascading cleanup. Server actions derive identity from `requireAuth`; saves are explicit and idempotent, require a currently published event, and share the existing event row lock. Removing a bookmark remains allowed after withdrawal. The Saved events filter runs on the server, so sorting, filters, totals, and pagination apply to the same records. Saved-event state is scoped to the signed-in identity and shared by both layouts and the detail dialog.

RLS and a restrictive deny policy block browser access, including accidental permissive policies. The migration follows the existing bounded server-role ownership convention. Demo reads remain empty and demo writes stay blocked. Saved clubs are unchanged.

## Calendar and time

The existing student calendar export and campus event buttons share `lib/ical.ts`. Exports use actual UTC start/end instants, stable event UIDs, escaped TEXT, CRLF, and UTF-8 content folding. Campus exports include the event permalink. All display uses the centralized America/New_York convention; overnight, multi-day, and DST-spanning events are supported without interview availability-hour restrictions.

## Verification

The normal test suite includes calendar/DST/Unicode and migration/RLS checks. Existing corkboard, deep-link, and task UI fixtures account for the shared save hook.

Native integration and browser checks require an explicitly disposable PostgreSQL database on `127.0.0.1:55442/postgres`, with the repository's Prisma migrations applied. Their URL guard rejects other targets. They use real Prisma and event server actions with a synthetic Auth identity, and clean up their fixture users/events. They do not test provider sign-in or Storage provisioning.

```sh
OUTCLASS_EVENTS_TEST_DATABASE_URL='postgresql://postgres:LOCAL_TEST_PASSWORD@127.0.0.1:55442/postgres' \
OUTCLASS_EVENTS_SCREENSHOTS=/tmp/outclass-events-screenshots \
node --test tests/campus-event-discovery.test.cjs tests/campus-event-discovery-browser.test.cjs
```

Build first so the browser fixture can load the app's compiled CSS. Browser checks cover desktop (1440px), tablet (820px), mobile (390px), view persistence, no layout-only refetch, shared search, saved-event synchronization, empty states, RSVP/cancellation, actual calendar downloads, original corkboard details, pagination, failed images, keyboard focus, reduced motion, and horizontal overflow. `tests/helpers/event-discovery-browser-fixture.cjs` can also run standalone against this disposable database for manual review.

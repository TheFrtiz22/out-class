# Marketing page upgrade

The hero headline, logo, Rotunda photography, palette, and scroll-reveal primitives remain intact. Student stories each have one demonstration; the leader story has one four-chapter workspace rather than a feature grid.

## Navigation

Native anchors retain fragment history and back/forward navigation. Smooth document scrolling is scoped to the mounted landing page, with 112px desktop / 96px mobile target margins and an immediate reduced-motion fallback. Hash navigation moves focus without initiating another scroll. A skip link leads to the student overview. There are no wheel/touch interception handlers.

## Demonstrations

The new product clock observes each frame at 35% visibility. Each sequence runs once, stops after its duration, suspends offscreen and in hidden tabs, and supports pause/resume. Cleanup removes timers and listeners. Reduced-motion and server HTML show completed content. The essay reserves its final text layout and exposes a single complete screen-reader sentence. Leader chapters can also be selected using native buttons; selecting a chapter keeps it stable. The existing hero pipeline remains unchanged.

## Approved organizations

Apply `prisma/migrations/20260925010000_marketing_participants/migration.sql` through the usual deployment process, then regenerate Prisma Client. `Club.marketingApprovedAt` defaults to null. Set it through trusted database administration only after confirming the organization consents to its name/logo appearing as a launch participant; revoke by setting it to null. No existing records were opted in and no production migration was run as part of this change.

The server selects only ID, name, and logo for approved UVA records. No qualifying records or a read failure means the strip is omitted. Directory membership, a claimed club, and demo fixtures never imply endorsement. Product examples use explicitly labeled fictional clubs.

## Verification

- Production Next.js build passed, including type checking; landing first-load JavaScript: 450 kB (the existing shared AppShell includes app views).
- All 153 existing tests passed. Two additional launch participant tests verify the public-field allowlist, opt-in filter, and fail-closed behavior.
- TypeScript and whitespace checks passed.
- Lint was attempted but the repository has no installed ESLint executable.
- Responsive and accessibility source review: single-column mobile stories, wrapping chapter controls, 44px demo controls, semantic headings, keyboard buttons, decorative logo alternatives, scoped focus behavior, reduced-motion handling, no live announcements for animated updates.
- Browser verification was attempted through available automation, but no browser connector was available and native Chrome control could not complete reliably. Mobile screenshots, runtime accessibility audit, smooth-scroll timing, and performance traces remain unverified; source review is not a substitute for these checks.

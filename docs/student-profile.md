# Student profile

The student profile uses persisted profile details and memberships; no personal sample records are substituted. The résumé-like layout includes identity, introduction, education, general experience, campus involvement, and LinkedIn/résumé links. Existing member portals remain accessible.

`lib/student-profile.ts` contains section validation, safe link rendering, and a six-item completion checklist. Completion is guidance, not eligibility. GPA and SAT are optional and excluded from completion.

`actions/profile.ts` retains onboarding's existing upsert and adds authenticated section updates. Each update writes only its own fields. Experience replacement is a single nested Prisma update; client-supplied record IDs are stripped. Optional scores and links can be cleared. Identity ownership always comes from the session.

`components/edit-student-profile-dialog.tsx` supplies focused accessible dialogs, validation and save feedback. Résumé upload uses the existing signed Supabase storage flow; Save attaches the uploaded URL. Cancelling never changes the profile (an uploaded unattached storage object may remain). No LinkedIn or résumé parsing is implied.

`components/views/unified-student-profile-view.tsx` loads the complete profile including experiences, shows retry/loading/empty states, and updates after saves. Layout adapts to narrow screens and inherits shell entrance/reduced-motion rules.

## Boundaries

No schema migration, new dependencies, or unsupported skills/experience-category fields. Internships, research, projects, and leadership use existing title/context/period entries. Periods remain free text; entries are not automatically sorted. A durable chronological ordering feature would require structured dates or ordering metadata. Headshots already stored are displayed; photo upload/editing is deferred. Résumé access still follows the existing storage URL/bucket configuration; no new privacy guarantee is made.

## Validation

Production build passed. Five new profile tests cover scoped persistence, ownership, validation, optional clearing, and completion. Full suite: 35 pass, four existing club-customization fixture failures. Two existing nullability errors remain in lib/club-customization.tsx; profile membership type error is resolved. Lint cannot run because ESLint is not installed. Browser fixtures verify responsive rendering and editing without writing to a live database. Actual Supabase upload/persistence requires configured services and remains unverified locally.

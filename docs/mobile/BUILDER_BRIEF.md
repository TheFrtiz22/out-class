# Builder brief: OutClass native app screens

Read this fully, then `docs/mobile/architecture.md`, `docs/mobile/BUILD_PROMPT.md` (sections "Design
carry-over", "The native feel bar", "Scope") and, when it exists, `docs/mobile/reference/web-phone-reference.md`
(layout and EXACT copy of every phone-width web screen; screenshots in `docs/mobile/screenshots/web/`).
The web source is the authority for copy and behaviour: `components/views/*.tsx`, `components/**`, `lib/**`, `actions/**`.

## Hard rules
- Work only inside this repo clone. Never read `.env*` files, never print passwords or tokens, never touch parent folders or production. No `git commit`, no `git push`, no `git stash/reset/checkout` (other builders share this working tree).
- Edit only the files your task lists as yours. Shared files (`mobile/src/components/ui.tsx`, `text.tsx`, `sheet.tsx`, `header.tsx`, `mobile/src/lib/*`, `lib/mobile-api/operations.ts`, `mobile/src/lib/types.ts`) may be EXTENDED with small additive edits (use the Edit tool with a precise anchor, re-read the file right before editing; never rewrite or reformat them, never remove what others added).
- No new npm dependencies. Everything needed is installed in `mobile/package.json`. If you believe one is essential, don't add it: report it.
- Authorization lives on the server. Never add a permission check, a count, or business rule in the app; show what the server returns and the server's own refusal message (`errorMessage(error)`).
- Copy: reuse the web's exact wording, labels, empty states and errors. No invented marketing copy, no decorative icons, no emoji, no italics-heavy styling, no campus photos (`public/images/campus` is unlicensed: do not use).
- Icons only from `~/components/icons` (Phosphor, same semantic names as the web). Regular weight; `fill` for selected/saved.

## App conventions (see existing code: `mobile/src/app/(tabs)/index.tsx` is the model screen)
- Expo SDK 58, Expo Router (routes in `mobile/src/app`), React 19 with the React Compiler on (don't hand-write useMemo/useCallback unless needed), TypeScript strict. Import alias `~/` = `mobile/src/`. `mobile/AGENTS.md` applies: Expo APIs change, check the installed package's types in `node_modules` rather than memory.
- Data: `useApiQuery<T>(operation, input?)` from `~/lib/query` for reads; `api.post(operation, input)` from `~/lib/api` inside `useMutation` for writes, with optimistic update + rollback where the web is optimistic (follow/save, mark read, RSVP), then `queryClient.invalidateQueries`. Operations are listed in `lib/mobile-api/operations.ts` (GET = read, POST = write; input is one JSON object). To see a response's real shape run `node scripts/staging/api-shapes.cjs <student|leader|interviewer|alumni> <operation> '<json input>' [depth]` (prints keys/types only; the web dev server on :3000 must be up — it is; do not restart it). Add the types you use to `mobile/src/lib/types.ts`.
- If a screen needs an action that has no operation yet, add ONE entry to `lib/mobile-api/operations.ts` that calls the existing Server Action/loader (no new logic, no permission checks), then check `node_modules/.bin/tsc --noEmit -p .` at the repo root still passes.
- Layout: every screen is `<View style={{flex:1}}><ScreenScroll top={useHeaderInset()} dock?>…</ScreenScroll><Header title back? /></View>`. Tab screens pass `dock`. Long lists use `FlatList`/`SectionList` with the same paddings (`contentContainerStyle` top inset = `useHeaderInset()`, bottom = safe area + `DOCK_CLEARANCE` on tabs), not a ScrollView of 200 rows.
- States: loading = skeletons shaped like the final layout (`Skeleton`, `SkeletonRows`), never a full-screen spinner; error = `ErrorState` with retry (offline wording when `error.offline`); empty = `EmptyState` with the web's empty copy. Pull-to-refresh on every list.
- Components: `Text` variants (`display/title/section` are Libre Caslon; everything else Source Sans), `Card`, `Row`, `Chip` (+`statusTone`), `Button`, `IconButton`, `ClubMark`, `Segmented`, `Divider`, `SectionHeader`, `Field`, `Sheet` (drag to dismiss), `useConfirm()` (the in-app confirm sheet; ALWAYS use it for destructive or irreversible actions, with the web's wording — never `Alert.alert`). Colours, radii and spacing only from `useTheme()`; no hex literals except a club's own colour from the API. Both light and dark must look right.
- Feel: `haptics.*` from `~/lib/haptics` on confirmations, saves, votes, check-ins and errors; `Press` for pressed feedback; motion only via `~/lib/motion` springs and off when `useTheme().a11y.reduceMotion`.
- Accessibility: every control has an `accessibilityLabel` (icons alone are not labels), `accessibilityRole`, selected/disabled state; targets ≥ 44pt; text must survive large Dynamic Type (no fixed heights on text containers; `numberOfLines` only where truncation is acceptable).
- Times: interviews and events display in Eastern time (`timeZone: "America/New_York"`), as the web does; don't add timezone controls.
- Add `testID`s to primary controls and screen roots (kebab-case) for Maestro flows.

## Verify your work (required before you report)
1. `cd mobile && npx tsc --noEmit` must pass (run it often).
2. Run it on YOUR simulator (udid given in your task; the app is installed; Metro is running on :8081 and serves current files on every app launch — there is no hot reload, relaunch to see changes):
   `MAESTRO_DEVICE=<udid> node scripts/staging/maestro.cjs e2e/dev-connect.yaml` then `MAESTRO_DEVICE=<udid> node scripts/staging/maestro.cjs e2e/sign-in.yaml` (signs in as the staging student if needed). Write your own flows as `mobile/e2e/<area>-*.yaml` (Maestro YAML; tap by `id:` testIDs; variables `${STUDENT_EMAIL}`, `${LEADER_EMAIL}` etc. are provided) to navigate to each screen you built.
   Screenshot with `xcrun simctl io <udid> screenshot <file.png>` into `.shots/<area>/` and LOOK at each screenshot (Read tool) — fix what looks wrong (overlaps with header/dock, clipped text, wrong spacing, unreadable dark mode). Toggle dark mode with `xcrun simctl ui <udid> appearance dark|light`. A red error screen or a Metro error (`.shots` aside, the Metro log is not yours to restart) means your code is broken: fix it.
3. Staging data is seeded and fictional; you MAY perform real writes as the test accounts when a flow needs it (save a club, mark read, RSVP, save a draft). Avoid irreversible ones unless your task says so, and say what you changed.

## Report (under 350 words)
Screens built (route → file), operations added, what you verified on the simulator (with screenshot paths), what is partial or not working and why, and any web bug you noticed.

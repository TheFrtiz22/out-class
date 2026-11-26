# OutClass mobile QA log

Autonomous QA and iPhone Duo / iPad work on the Expo app. Started 2026-11-26. Every change ships as a small PR that passes all checks before merging.

## Environment and constraints (decisions)

| # | Decision | Why |
|---|----------|-----|
| D1 | Visual checks run in Xcode 27 **Device Hub** (iPhone 17e, iPhone Duo; iOS 27.2) through computer use. `xcrun simctl` and installing or running Maestro on the Mac aren't available, because the agent's shell is a Linux VM, not macOS. | The brief asks for `xcrun`/Maestro; the closest available route is used and recorded. |
| D2 | Maestro flows stay in `mobile/e2e` (60 existing) and new ones are added there, not in a new `/e2e`. | One place for flows; the repo already runs them from there. |
| D3 | Large-scale data (200+ applicants, 50+ clubs) is exercised by render-test fixtures and the disposable CI Supabase, not by seeding a dev database from the agent. | No dev-DB write access from the agent; production is off limits. |
| D4 | Layout follows Apple's *Designing for iPhone Duo* HIG (Sept 9, 2026): two size classes (compact outer, regular inner), safe areas and layout margins, no fixed widths, an extra level of hierarchy (split views) on the inner display, content kept off the centre fold, even-column grids. | The brief asks to follow Apple's guidance rather than guess. |
| D5 | No content column is centred on wide screens. | On the Duo's inner display the centre is the folding region when partly open. Wide screens get two panes instead. |
| D6 | Two-pane layouts use equal halves. | React Native/Expo Go can't read the fold (`ReservedRegion`, `ArrangementView` are native iOS 27.1 APIs). Equal panes put the crease on the pane boundary, which is what Notes does when partly folded. |
| D7 | iPhones keep the portrait lock; iPad gets every orientation (`supportsTablet: true`, `UISupportedInterfaceOrientations~ipad`). | Apple: the Duo's inner display ignores supported orientations and resizes anyway. Opening landscape on every iPhone screen is a QA surface that can't be verified end to end from here. |
| D8 | The custom bottom tab dock stays horizontal. | Apple moves *system* tab bars to the side on the Duo. OutClass's dock is a JavaScript component, and native tabs aren't available in Expo Go. Recommendation R1. |

## Feature inventory

Student: sign-up, sign-in, sign-out, reset password, complete profile; Home (tasks, my clubs, applications, leading); Explore (search, category chips, filters sheet, club cards, saved clubs, events); club page (identity and photo, apply / continue draft / view status, save, share, report, about, members, recruitment, life, FAQ, events); QR scan → `/q/[code]` → public club page → sign-up (club fair); applications list and stage tabs; application form (autosave, ready, submit); interview booking (`/interview/[applicationId]`, add to calendar, cancel); decisions (`/decision/[applicationId]`); tasks; meetings; inbox (filters, unread, swipe, preferences); calendar (agenda, month, availability, subscribe); profile (edit, photo, résumé, LinkedIn, phone); settings (account, availability, interests, interviews, notifications, delete account).

Leader: club home (`/my-club/[clubId]`), Leader tools, check-in (`/leader/[clubId]/check-in/[meetingId]`), club QR code, applicants, interview day (timer and notes), announce, live voting (rooms list, host controls, member vote, ended summary).

## Results

| Date | Device | Area | Result | Bug / PR |
|------|--------|------|--------|----------|
| 11-26 | iPhone 17e | Home, Explore, Apply, Calendar, Profile, Leader tools, Live voting | Render cleanly; no clipping | — |
| 11-26 | iPhone 17e | Voting ended summary | "1 passed" heading repeated by a "Passed 1" figure | #702 |
| 11-26 | iPhone Duo (outer and inner) | Every screen | Right-edge camera and status column covered header buttons, "All tasks" and badges; no screen used side safe areas | #703 |
| 11-26 | iPhone Duo (inner, flat and half-folded) | Home | Single column stretched edge to edge; dock stretched | Two-pane layouts #704/#706/#707, Home two-column grid #708 (all merged) |
| 11-26 | iPhone Duo (inner) / iPad | Explore | Club list beside the club's page; fold opens the selected club full screen only when Explore is focused | #704 |
| 11-26 | iPhone Duo (inner) / iPad | Interview day | Schedule beside the interview in focus; fold keeps typed notes and the open session (render test) | #706 |
| 11-26 | iPhone Duo (inner) / iPad | Live voting (leader) | In the room, Queue and web links beside the stage and host controls; fold keeps a typed reason (render test) | #707 |
| 11-26 | iPad | App config | `supportsTablet: true`, all iPad orientations; iPhone stays portrait | #705 |
| 11-26 | CI | Web `list-pages-browser` | Members (Demo) at 375px missed its sort control once; main passed the same test minutes earlier. Re-run | Flake (passed on re-run) |
| 11-26 | iPhone Duo (inner) / iPad | Explore | Crossing the breakpoint remounted the club list (scroll and search focus lost); one stable row now (Codex finding) | #704 |
| 11-26 | iPhone Duo (inner) / iPad | Home | Sections in two even columns, carousel full width | #708 |
| 11-26 | CI | Disposable Supabase (application-writing) | Local stack failed to start once; passed on re-run | Infra flake |
| 11-26 | Mac checkout | Expo Go | Mac is on main at #696, missing #698+; untracked `mobile/assets/icon/` (rejected icon layers) blocks the pull. Owner to remove it and pull, then on-device fold checks | Owner step |
| 11-26 | iPhone 17e | Calendar | Filter chips mixed "Interview" and "Interest Meeting" casing; labels now sentence case, stored types unchanged | #709 |

## Recommendations

- **R1.** Move to native tabs (Expo Router native tabs, in a development build) so the Duo places the tab bar on the side like system apps.
- **R2.** Adopt `ReservedRegion` and `ArrangementView` through a native module when leaving Expo Go, to keep content off the fold in the half-folded pose.

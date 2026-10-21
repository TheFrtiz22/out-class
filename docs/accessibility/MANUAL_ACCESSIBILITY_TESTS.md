# Manual accessibility acceptance scripts

Evaluation: 2026-10-20. **All human assistive-technology tests below are NOT YET TESTED.** Automated Chromium keyboard tests are not VoiceOver, NVDA or TalkBack verification. No screen-reader output has been heard or evaluated during this audit.

## Required environments and evidence

| Platform | Test mode | Actual status | Completion requirements |
|---|---|---|---|
| macOS + Safari + VoiceOver | Keyboard, rotor, forms, grid and announcements | Pending; no human VoiceOver session performed | Enable VoiceOver (Command-F5); Safari keyboard navigation and macOS Keyboard Navigation on; record OS/Safari/VoiceOver versions and spoken output |
| Windows + Chrome + NVDA | Browse mode, focus mode, tables and grid | Pending; Windows/NVDA unavailable in this session | Authorized tester with Windows and NVDA; record exact versions; use Speech Viewer for evidence |
| iPhone + Safari + VoiceOver | Swipe, explore by touch, rotor, zoom | Pending; physical iPhone/VoiceOver not available | Physical device; record model/iOS; portrait and landscape; complete tasks by touch |
| Android + Chrome + TalkBack | Swipe, local context controls, explore by touch | Pending; device unavailable | Physical device/emulator with TalkBack; record OS/browser/AT versions |
| Desktop keyboard only | Tab, Shift-Tab, arrows, Enter, Space, Escape | Automated component/public samples only; human full workflow pending | Visible focus inspection including sticky header, dialogs and bottom navigation |
| Low vision | 200% text resize; 400% browser zoom; spacing override | 320px and CSS spacing samples automated; human zoom/reflow pending | 1280px browser at 400%, 200% text-only enlargement where supported; actual screenshots and clipped content review |

Use a disposable, authorized nonproduction environment with a student, club owner/leader, interviewer, voting member and elevated administrator. Use fictional applications and events, two candidate records, available interview slots and a safe import package. No destructive production tests. Do not use production support impersonation to substitute for isolated accounts. Confirm role restrictions are real; mocked fixture identities cannot do this.

For each script, record: tester, date/time/timezone, source SHA/deployment URL, account role, device/OS/browser/AT versions, settings, steps, expected result, **actual spoken/visual behavior**, pass/fail, issue ID, reproduction, screenshot/video/transcript and any data cleanup performed. A test is pending until actual results are entered. Save sanitized evidence with no personal data or session tokens.

## M01 — Public discovery, motion and keyboard

1. Open homepage with a fresh session; Tab once and activate the skip link. Expected: focus enters product overview; repeated navigation is bypassed.
2. Read page by headings/landmarks. Expected: one main; labelled navigation; meaningful order and complete product summaries. Simulated product controls do not enter browse or keyboard control lists.
3. Change student/club-leader perspective using keyboard or touch. Read each feature and its description. Expected: selected perspective is exposed and explanatory content remains available.
4. Operate carousel Previous, Next, Pause/Play and all demonstration Pause/Replay controls. Focus must remain visible and automatic movement must stop when requested; automatic beats must not flood speech.
5. Turn reduced motion on while already on the page; reload too. Expected: static/completed previews and no automatic card motion or cursor travel; manually selected features remain available.
6. At 320px, 200% text and 400% zoom, open/close mobile navigation with Escape, follow FAQ links, expand all FAQ answers and read About/UVA. Expected: controls remain reachable, focus restores, sticky navigation never completely obscures focused content, no text clipping.
7. Apply text-spacing override (line 1.5, letter .12em, word .16em, paragraph 2em); inspect every control and title visually. Page width alone is insufficient evidence.

## M02 — Student complete task

1. Register with an authorized isolated email, receive verification code and paste it. Test password manager autofill and password paste; test resend/expired/incorrect code. Expected: labels/purpose, understandable errors, no prohibited memory/transcription puzzle; information entered earlier is retained where applicable.
2. Complete profile; submit invalid fields once, then correct them. Expected: text errors associated with fields, focus on first problem or summary; academic and experience groups make sense in the accessibility tree.
3. Activate résumé upload using keyboard only, cancel file picker, upload a tagged text PDF, then an image-only PDF. Expected: progress, success and failure announced; meaningful profile/text alternative available for image-only content. Review/download must be reachable without pointer dragging.
4. Discover and filter clubs, save one, return to saved clubs and open public profile. Expected: selected filters/state and result count understandable; no loss of focus on refresh.
5. Begin application; test essay, select and document questions. Submit empty/over-limit responses, navigate summary links, correct, reload to confirm draft recovery. Review then submit once. Expected: accessible confirmation, correct answers persisted and submission status announced.
6. Open interview invitation. Choose date and time; inspect selected states; reserve, reload, reschedule and cancel in the isolated system. Expected: correct slot and location, confirmation read, focus retained, capacity conflicts reported without losing selection.
7. View decisions/application status, open notification and announcement, accept authorized club invitation/membership and revisit settings/availability. Expected: state and action result read once, next action clear; no permission escalation.

## M03 — Availability grid

1. Tab into weekly grid. Expected: label/instructions, time row header and day column header announced, with 8 desktop or 2 mobile columns; one cell is in Tab order.
2. Arrow across days/times; Home/End; Space and Enter to toggle; Shift+arrows extend. Expected: selected state reflects saved values; each action possible without dragging.
3. Select a desktop day then resize to mobile; change mobile day by button and arrows. Expected: focus remains on a visible cell; no offscreen day traps; Tab exits the grid.
4. Tap individual cells with touch dragging off, scroll vertically, enable dragging and paint a range; cancel with Escape or pointer cancellation. Expected: cancellation discards preview; controls and native scrolling remain usable.
5. Move through cells under sticky day header; inspect selected and unselected focus at high zoom. Verify focus/non-text contrast (3:1 where required), forced colors and unknown hatch semantics.
6. Disconnect the network during autosave, retry and reload. Expected: failure announced, edits retained, no false saved status or unexpected focus jump.

## M04 — Club leader and interviewer complete task

1. Open authorized workspace; navigate rail/mobile drawer, mode selector, account/search menu and notifications. Test forward/reverse Tab, Escape, focus restoration and route titles.
2. Filter applicants, select individual/bulk rows, inspect profile, compare candidates and use stage dropdown instead of dragging. Expected: row/check states and bulk scope clear; keyboard action matches pointer outcome.
3. Create interview room; set dates/duration; supply availability; preview panel staffing; add/remove interviewer; test auto-fill conflicts and issue-summary links; publish only fictional panel. Expected: all labels/instructions/errors, no pointer-only calendar/assignment control.
4. Start collaborative interview with another isolated interviewer; open kit question, type notes, save/close, add off-script question, use exact-text résumé highlight alternative, submit evaluation. Expected: focus follows deliberate actions; speech is not repeated on polling; pending/failed save is distinguishable from saved; timers do not unexpectedly terminate the task.
5. Make a fictional recruiting decision and preview communications before confirming. Expected: confirmation, ability to correct/review, decision result and notification accessible.
6. Create/assign task, post announcement, edit club settings/permissions and view analytics. Expected: native/grouped controls, text/table equivalent for essential chart values, accessible errors and successful updates.
7. Create event with all essential poster details in Description, upload flyer, preview at 320px, submit for isolated moderation and view published event. Read it with images off. Expected: complete equivalent time/location/access/instructions; no image-only essential content.

## M05 — Voting and collaboration

1. Join real isolated session as member and proctor in separate browsers. Start pass, move to another candidate, submit each ballot option and verify it persists.
2. Expected: participant state, candidate position and permitted identity announced once per actual change; ballot confirmations do not repeat every poll; focus never jumps because another user acts.
3. Test paused/closed session, lobby, reconnect, rejected ballot and final results. Expected: voting eligibility and result states read, controls correctly disabled, no indefinite ambiguous spinner. Inspect demo embedded pad for nested landmarks too.

## M06 — Administrator complete task

1. Sign in/elevate using isolated administrator and allowed MFA. Expected: accessible paste/autocomplete, errors, timeout and recovery; no production setting changes.
2. Navigate platform table by headings and cell headers; search/filter/page at high zoom; open and dismiss inspection dialog. Expected: named table, correct headers, action context, focus enters/traps/restores and background is inert.
3. Review fictional organization request, school request and club claim; perform a reversible authorized approval. Expected: meaningful confirmation/error/success, status persists after reload.
4. Import fictional CSV/JSON containing one invalid row and one valid row; review before applying; exercise bulk selection, account/permission controls on disposable records. Expected: row-level error identification, selected count, review/correct safeguards and understandable resulting state.

## M07 — Documents, contrast and target sizes

Inspect uploaded résumé reading order/text extraction, PDF viewer controls, actual transactional emails in Outlook/Gmail, calendar import in two clients, charts and CSV report headers. Confirm useful alternatives when user files lack structure; escalate missing alternatives without claiming a download repairs an inaccessible PDF. Check every rendered normal/hover/focus/selected/error state: 4.5:1 normal text, 3:1 large text and applicable non-text boundaries/focus. Evaluate transparency against actual composite backgrounds. Check 24px target size/spacing exceptions individually; prefer 44px without assuming every 16px checkbox fails (associated labels may satisfy spacing/target conditions).

## Blank execution record

| Script / step | Browser / OS / AT and version | Expected | Actual | Result | Evidence / issue |
|---|---|---|---|---|---|
| M01–M07 | Not executed | As above | No human result recorded | **Not yet tested** | Assign tester and isolated environment |

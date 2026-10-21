# WCAG 2.2 A/AA verification matrix

Tests: 2026-10-20; evidence reviewed: 2026-10-21. [Official specification](https://www.w3.org/TR/WCAG22/). **55 current A/AA criteria**. “Not yet tested” means insufficient whole-platform evidence, even if a component sample passed or a known defect was repaired. No aggregate conformance claim is made. Verified failures discovered during remediation are retained in the finding register; resolved sample failures do not become whole-platform passes.

| Criterion | Level | Name | Platform status | Evidence / required verification |
|---|---|---|---|---|
| 1.1.1 | A | Non-text Content | **Not yet tested** | Event equivalent-description guidance and résumé text layer reviewed; actual uploaded media/PDFs and alternative quality pending (M02/M07). |
| 1.2.1 | A | Audio-only and Video-only (Prerecorded) | **Not applicable** | No application-owned audio/video playback or embedded time-based media found in app/components/lib source inventory. Reassess if media is added; animated UI remains covered by 2.2.2. |
| 1.2.2 | A | Captions (Prerecorded) | **Not applicable** | No application-owned audio/video playback or embedded time-based media found in app/components/lib source inventory. Reassess if media is added; animated UI remains covered by 2.2.2. |
| 1.2.3 | A | Audio Description or Media Alternative (Prerecorded) | **Not applicable** | No application-owned audio/video playback or embedded time-based media found in app/components/lib source inventory. Reassess if media is added; animated UI remains covered by 2.2.2. |
| 1.2.4 | AA | Captions (Live) | **Not applicable** | No application-owned audio/video playback or embedded time-based media found in app/components/lib source inventory. Reassess if media is added; animated UI remains covered by 2.2.2. |
| 1.2.5 | AA | Audio Description (Prerecorded) | **Not applicable** | No application-owned audio/video playback or embedded time-based media found in app/components/lib source inventory. Reassess if media is added; animated UI remains covered by 2.2.2. |
| 1.3.1 | A | Info and Relationships | **Not yet tested** | Grid headers/columns and admin table repaired; remaining tables, charts, groups and AT trees pending (M03/M06). |
| 1.3.2 | A | Meaningful Sequence | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 1.3.3 | A | Sensory Characteristics | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 1.3.4 | AA | Orientation | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 1.3.5 | AA | Identify Input Purpose | **Not yet tested** | Email/password/code autocomplete reviewed in source; signed-in profile and real local Auth samples passed. Complete profile/authentication tasks with AT pending (M02). |
| 1.4.1 | A | Use of Color | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 1.4.2 | A | Audio Control | **Not applicable** | No application-owned audio/video playback or embedded time-based media found in app/components/lib source inventory. Reassess if media is added; animated UI remains covered by 2.2.2. |
| 1.4.3 | AA | Contrast (Minimum) | **Not yet tested** | Rendered signup/owner/admin rail failures repaired; public, fixture and signed-in axe samples passed. All states, transparency and customized branding need M07. |
| 1.4.4 | AA | Resize Text | **Not yet tested** | Actual 200% text resizing and clipping inspection pending M01/M07. |
| 1.4.5 | AA | Images of Text | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 1.4.10 | AA | Reflow | **Not yet tested** | Public/component and 16 actual protected destinations sampled at 320px; actual 400% zoom, clipping, complex calendars and remaining routes pending. |
| 1.4.11 | AA | Non-text Contrast | **Not yet tested** | Selected grid focus contrast improved; all rendered component boundaries, charts and focus states pending M07. |
| 1.4.12 | AA | Text Spacing | **Not yet tested** | Public CSS spacing/overflow samples; inspect clipping and protected controls manually M01/M07. |
| 1.4.13 | AA | Content on Hover or Focus | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.1.1 | A | Keyboard | **Not yet tested** | Grid, dialogs, booking, application, events and public keyboard samples; complete role tasks pending M02–M06. |
| 2.1.2 | A | No Keyboard Trap | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.1.4 | A | Character Key Shortcuts | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.2.1 | A | Timing Adjustable | **Not yet tested** | Interview timers, verification expiry and admin elevation/session limits require M02/M04/M06. |
| 2.2.2 | A | Pause, Stop, Hide | **Not yet tested** | Carousel has pause and demo reduced-motion handling; all realtime/timer information still needs M01/M05. |
| 2.3.1 | A | Three Flashes or Below Threshold | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.4.1 | A | Bypass Blocks | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.4.2 | A | Page Titled | **Not yet tested** | Public route titles sampled; client-dispatched and protected workspace titles still pending M04/M06. |
| 2.4.3 | A | Focus Order | **Not yet tested** | Dialog/booking focus samples; full post-submit and changing candidate behavior pending. |
| 2.4.4 | A | Link Purpose (In Context) | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.4.5 | AA | Multiple Ways | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.4.6 | AA | Headings and Labels | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.4.7 | AA | Focus Visible | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.4.11 | AA | Focus Not Obscured (Minimum) | **Not yet tested** | Grid scroll margin and shell insets reviewed; visible focus obstruction requires human high-zoom task checks. |
| 2.5.1 | A | Pointer Gestures | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 2.5.2 | A | Pointer Cancellation | **Not yet tested** | Grid Escape/pointer cancellation repaired; all pointer/touch actions pending M03/M07. |
| 2.5.3 | A | Label in Name | **Not yet tested** | Event and actual signed-in shell/content name failures repaired and rescanned; all states/voice-control targets pending M07. |
| 2.5.4 | A | Motion Actuation | **Not applicable** | No device/user-motion actuation input was found. Pointer and animated interface behavior are assessed separately. |
| 2.5.7 | AA | Dragging Movements | **Not yet tested** | Grid click/tap and key alternatives; pipeline stage selector exists; all panel/drag tasks pending. |
| 2.5.8 | AA | Target Size (Minimum) | **Not yet tested** | Individual target/spacing exceptions require rendered measurement; 44px defaults alone do not establish conformance. |
| 3.1.1 | A | Language of Page | **Verified pass** | Root layout consistently sets html lang="en" for English application UI; public browser samples assert it. User-authored language changes remain 3.1.2. |
| 3.1.2 | AA | Language of Parts | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.2.1 | A | On Focus | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.2.2 | A | On Input | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.2.3 | AA | Consistent Navigation | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.2.4 | AA | Consistent Identification | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.2.6 | A | Consistent Help | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.3.1 | A | Error Identification | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.3.2 | A | Labels or Instructions | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.3.3 | AA | Error Suggestion | **Not yet tested** | Public/component samples or source inventory only; complete relevant M01–M07 role tasks and record human evidence. |
| 3.3.4 | AA | Error Prevention (Legal, Financial, Data) | **Not yet tested** | Application confirmation sampled; actual decisions, bulk imports and account changes pending M04/M06. |
| 3.3.7 | A | Redundant Entry | **Not yet tested** | Full signup/profile/application data reuse and redundant-entry exceptions pending M02. |
| 3.3.8 | AA | Accessible Authentication (Minimum) | **Not yet tested** | Password/OTP paste/autocomplete source review and real isolated signup/email/MFA business checks completed; complete browser authentication with AT pending. |
| 4.1.2 | A | Name, Role, Value | **Not yet tested** | Actual primitive/grid samples scanned; nested audience controls repaired; complete AT widget validation pending. |
| 4.1.3 | AA | Status Messages | **Not yet tested** | Persistent application/booking/voting messages implemented and DOM-tested; actual spoken timing and repetition pending. |

4.1.1 Parsing is obsolete and removed in WCAG 2.2; it is not an active success criterion or a scanner pass. Relevant semantic/name/role defects are assessed under 1.3.1 and 4.1.2. AAA criteria (including 2.4.13 Focus Appearance and 2.5.5 Target Size Enhanced) are useful improvements but are not AA requirements.

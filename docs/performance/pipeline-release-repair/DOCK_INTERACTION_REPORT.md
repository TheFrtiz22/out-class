# Independent dock interaction repair

[PR #92](https://github.com/TheFrtiz22/out-class/pull/92) contains only the dock
repair, its browser regression and its report. Final branch commit:
`855bd592d32f06359fdf325804640a9cf5ea0173`. Both hosted workflows passed:
[production validation](https://github.com/TheFrtiz22/out-class/actions/runs/40754283885)
and [disposable integrations](https://github.com/TheFrtiz22/out-class/actions/runs/40754284015).
Main subsequently incorporated it as `a0265dcb`; that merge was external to this
repair task. No merge or production deployment was executed by this task.

The rail reserves 108px of content space but expands to 272px. A destination
click previously scheduled a conditional exit; retained hover/focus ownership
could leave the expanded surface above the destination's first content row.
An unforced click at x=240 reproduced interception by the dock's Interviews
link. The pre-existing dock suite passed main because its destinations did not
exercise that obstructed first-row target.

Navigation now collapses the rail immediately and clears hover ownership.
Crossing its departing wide region cannot reopen it; deliberate entry into the
compact icon column can. Pointer movement handles compact-column reentry even
when the earlier wide-region pointerenter was ignored. The first hosted run
also exposed slow diagonal travel exceeding fixed hover intent. Rightward
motion toward the current flyout now renews pending intent; stopping on another
row still selects it after the original delay. The existing diagonal assertion
was preserved and a 16-step, 60ms/step pointer path was added.

The two real Chromium browser tests cover hover, trigger-to-flyout travel,
opening/closing, all menu destinations, first-content-row clicks, rapid return,
keyboard Tab/arrows, Escape/focus restoration, roles/permissions, scroll,
desktop widths, touch/mobile and reduced motion. No forced clicks, CSS/layout
removal, icon replacement or animation degradation was used. The package MIT
notice and existing Phosphor icon mappings remain.

The original failed regression and first failed hosted diagonal probe remain
identified in the isolated report and QA logs. A later successful run does not
erase either failure. See `docs/performance/dock-pointer-release-repair/REPORT.md`
for implementation detail. `SOURCE_PROOF.json` shows zero additional dock diff
in the pipeline repair against current main. Dock acceptance is independent of
the pipeline's pending performance gates.

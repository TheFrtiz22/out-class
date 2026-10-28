# Dock pointer repair

Base: current main f2192e02e5e218537f4dda8a4333aecab1602993. This patch is independent of the bounded-pipeline experiment; no recruitment/data/auth code changes.

A new unforced browser test reproduces the first-row obstruction on main: after selecting a flyout destination, a normal click at x=240 in the content area times out because the expanded rail’s Interviews link intercepts it. The existing large dock test passed on main and did not exercise that target.

The rail reserves 108px for content but expands to 272px over it. Route changes previously scheduled a conditional exit. Hover/focus state and pointer entry into the departing surface could keep or reopen that surface above the intended first-column target. This is actual interactive geometry, not an invisible decorative overlay.

Navigation now collapses the rail and clears hover ownership. While it collapses, crossing the departing wide region cannot reopen it; a deliberate entry into the compact icon column can. Pointer movement handles compact-column reentry even when the earlier wide-region pointerenter was ignored. Keyboard focus still expands the dock. The original spring, flyout bridge, reduced-motion behavior, focus restoration, leave guards, hit sizes, icon system and mobile navigation remain intact.

The first hosted validation also exposed slow diagonal travel exceeding the original fixed hover timer. Rightward pointer movement toward the current flyout now renews pending hover intent; stopping on another row still commits after the original delay. The existing diagonal assertion is unchanged, and the new test additionally traverses the path with 60ms pointer steps.

Validation: the new regression test failed before the change with an explicit dock-subtree interception trace. The final two browser tests pass: new first-content-row/rapid-return/reduced-motion coverage plus the existing Chromium hover/diagonal bridge/menu destinations/rapid switching/keyboard/Tab/arrows/Escape/focus/permission roles/scroll/desktop widths/mobile touch/responsive/accessibility suite. No forced clicks or loading predicate changes. TypeScript passes. Pipeline work’s ordinary/integration results are not presented as tests of this isolated branch.

Evidence from this task is retained in the repair worktree’s final handoff and QA manifest. Original failed local log: outclass-repair-dock-probe-before.log; final isolated log: outclass-dock-final-tests.log. Hosted CI and PR status are recorded after opening review. No merge or production deployment is authorized or performed.

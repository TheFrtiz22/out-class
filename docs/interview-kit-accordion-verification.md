# Collapsible round interview kits

Interview master kit now presents recruitment rounds in the authoritative pipeline order as compact independent sections. Every header shows its round, question count and chevron. Ordinary visits start closed; a valid existing roundId link opens that round. Multiple sections may be open. Existing setup discovery, denied/error states and direct links remain intact.

Each stable club/round child owns its existing loader, version reference, questions and autosave queue. Panels remain mounted under the native hidden attribute so drafts, guidance disclosure state, errors, recovery and pending saves survive collapse; hidden controls cannot receive keyboard focus. Header toggles do not invoke save/discard handlers. Normal autosave and explicit retry/reload remain unchanged. Header indicators expose unsaved, saving, failed or recovered-draft state. Question bank actions and snapshots use unchanged adapters/actions in live and Demo Mode.

Native header buttons provide expanded/control semantics, visible focus and 48px targets. Only chevrons animate (140ms), with reduced-motion disabling transitions; panel hiding is immediate to avoid layout animation affecting typing. Compact wrapping headers support mobile.

## Validation

- Actual-component Chromium test: ordinary closed state, direct round link, multiple sections, keyboard toggle, hidden textareas, independent drafts and stable IDs/version saves, collapse/reopen, failed save/retry, pending saves finishing while collapsed, persisted reload, desktop/mobile overflow and touch target size. Synthetic API fixture only, network restricted to loopback.
- Existing recruitment-round setup tests: authoritative saved round discovery and persistence, permission denial and restricted kit reads, exact pipeline configuration link, Demo persistence and zero live calls.
- Type checking, lint, production build and protected CI recorded in the release receipt.

No schema, migration, dependency, permission or server action changes. Physical touchscreen testing and writes to real applicant/club kits are not claimed. Isolated screenshot typography uses local fallback fonts; hosted appearance is checked separately when browser access permits.

# Club dashboard polish

## Behavior

- Recruiting overview contains operational stats and action cards; its duplicate Review tools panel is removed. Permanent Review tools navigation is removed from the shell. Anonymous review and screening rules remain available under Settings → Recruitment & Applications → Review settings.
- The applicant drawer has a dedicated scroll region and a separate opaque quick-review footer. Content ends above the footer instead of scrolling behind it or peeking underneath.
- Reviewer observations are a compact, side-by-side Pros & cons area. Scores/feedback are expandable, and the observation editor opens only for Add/Edit. The existing server visibility projection remains authoritative.
- Members offers a single Create group(s) action. Its sequence is Name → Members → Review. Members can be selected by academic year, access role, current groups, explicit people, or joined in the last 30 days. Categories can be combined with ANY/ALL semantics. Inactive and disabled members are excluded.
- Random splitting is optional and its controls stay hidden until enabled. The preview supports maximum people per subgroup or subgroup count, uses a stable seed, and saves exactly the previewed partition. Every selected person keeps the parent label and receives one subgroup label. Existing groups, cohorts, roles, and capabilities are preserved.
- Creation accepts up to 500 selected members and at most 100 subgroups. The server validates current membership, authority, club scope, expected versions, and per-member label limits, and saves the batch plus audit atomically. Stale inputs and audit failures roll back the whole batch.
- The redundant inner Announcements heading is removed. Announcement titles and content headings use the Caslon display voice; interface copy now uses locally hosted Source Sans 3 variable faces. Adobe's OFL notice is included with the fonts and at `/licenses/source-sans-3-OFL.txt`.
- Shared badges and standalone status capsules use neutral text with a small semantic rule. Application statuses, room state, publication state, rating annotations, and legacy pipeline labels no longer use colored oval backgrounds. Avatar circles, presence dots, and progress indicators retain their function.
- The organization Settings menu has a bordered “Switch to Personal settings” action with an arrow and its existing unsaved-change guard.

## Verification

- 94 targeted regression tests passed, including group selection/partition invariants, authority checks, expected-version handling, and migrated-database atomic saves and rollback.
- Five browser flows passed: guided grouping with optional random splits on desktop/mobile, compact observations, drawer footer bounds, neutral status styling, applicant sorting/dragging/quick review, meeting editing, member invitation isolation, announcement publication preview, and voting draft creation.
- TypeScript, production build, and targeted ESLint passed. Existing hook dependency warnings remain in older components.
- Browser fixtures use synthetic records and isolated endpoints; verification created no production groups, messages, or applicant decisions.

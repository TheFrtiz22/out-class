# Recruitment voting

The production applicant workspace opens **Recruitment voting**, a focused board with one applicant at a time. It reuses Prompt 33's configured applicant presentation, including permitted profile, academics, experience, interview feedback, Pros/Cons and document/profile links.

Leadership creates a draft for one recruitment round, chooses an authorized participant roster, target class size and optional explicit auto-advance rule. Voters record immutable Pass, Hold / Fringe or Do Not Pass ballots. Counts and history survive refresh and work across devices through five-second server polling. Reaching the target remains advisory.

Complete a pass to choose another pass or finish. Subsequent passes can use held/unresolved candidates or a selected subset. Review historical passes, override with an audited reason, or reopen an unpublished finished session. Filters cover graduation year, latest outcome and the current user's voting state. Round scope is displayed and fixed by the selected session.

Finishing does not change application status. A finalizer explicitly reviews and selects resolved candidates, confirms their student-visible effect, and publishes. Publication is atomic and seals the session. Existing applicant-table decision operations remain available through their established authorization path.

Full data model, permissions, consensus rules, synchronization, tests and deployment limitations are in [voting-backend.md](voting-backend.md).

The old launcher/PIN/member pad remains an isolated **local voting preview** for reusable demo UI. It is not the production voting source of truth. See [live-voting.md](live-voting.md).

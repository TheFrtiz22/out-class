# Remaining gated workflow supplement

Application source remains `4d52103e0ca70086c8ff4f3e913a7bd11f377005`, digest
`99077a7ff37acb0b67cb919c4ec4b1b95bc0401750472cc65f26b3aaeb029be1`.
The existing ordinary suite still gates 52 cases; separate passing jobs already
cover 41. This supplement attempts the other 11 existing top-level scenarios on
four fresh CI VMs, independent of every performance host:

- Corkboard, club-assets and decision communications: dedicated Corkboard
  Auth/PostgreSQL/private Storage, actual production Next build, port 3108.
- Admin workspace/session plus recipient audiences, invitation scheduling,
  communication scheduling and decision publication: dedicated Corkboard and
  Admin-session fixtures, actual password/MFA and local SMTP, port 3109.
- Active Interview Rooms: existing verified onboarding/navigation runner,
  24 real bookings, four separate reviewer accounts, 96 grants and actual
  immediate assignment revocation over guarded HTTP.
- Communications: existing dedicated announcement Auth/PostgreSQL runner and
  HTTP/provider-mocked assertions. No external email key or real send command.

No product assertions are changed or bypassed. The existing Corkboard fixture
preparer gains an explicit Admin-session profile on the already allowlisted
60321/60322 ports. The historical decision helper additionally accepts the
maintained Corkboard profile, with fixed project/loopback ports/database name
and exact local build directory; its original custom REST profile stays intact.
Both supported profiles were checked and five hosted/foreign/spoofed cases were
rejected. These are test infrastructure changes, not private product access
exceptions. No original test is converted to a skip or replaced by a related
native scenario.

The CI-only controller refuses pre-existing fixture configurations, uses only
its fresh VM's reserved projects, and stops only servers it spawned and those
projects. Runtime passwords, keys, certificates and records stay outside the
repository and are not uploaded. The workflow is opt-in via
`run-release-functional-supplement` or dispatch. A failed product assertion
remains a failed verification and is retained; coverage advances only after the
specific full scenario passes. Tests/builds here never run on a timing VM.


The first supplement passed active navigation (three cases), communications
(five cases), Corkboard and decision communications. The asset test ran before
the Corkboard journey because Node orders input test files; its MFA factor was
still enrolled/unverified. The Admin fixture likewise lacked both that verified
factor and the capacity-150 published event that its suspension assertion
requires. The maintained Corkboard journey supplies both through actual Auth
MFA and guarded product actions. The retry executes that journey first, then
the unchanged dependent assertions. Independent Admin-session scenarios now
continue in their separate fixture even if the earlier Admin assertions fail;
the controller preserves a nonzero exit for every failed test. Only the two
affected matrix jobs are repeated via `run-release-functional-repair`.


Final outcome: canonical sequencing resolved fixture prerequisites. All remaining
specific cases ran, with 51/52 separately passing. One original Admin-session
literal /Admin workspace/ route expectation remains failed against current
Administration markup. The returned page is the authorized Admin shell; this
observation is not substituted for that test passing. A transient reserved-port
bind failure was retried once with identical source and passed. Full failure/
retry history and exact counters remain in GATED_SUPPLEMENT_QA.json. No further
broad fixture/product work is part of this rejected performance candidate.

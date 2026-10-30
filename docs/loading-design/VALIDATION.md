# Validation — October 30, 2026

| Check | Result |
| --- | --- |
| Full `npm test` | 1,495 cases: 1,450 passed, 0 failed, 45 environment-gated cases skipped |
| Final focused loading/interview tests | 23 passed, 0 failed (includes the added room-geometry regression) |
| Final onboarding/button cleanup tests | 19 passed, 0 failed |
| `npm run typecheck` | Passed, including the final cleanup |
| `npm run lint` | Passed: 0 errors; 21 existing warnings |
| Production build | Passed, with type/lint checks enabled |
| `npm run test:migrations` | All 61 migrations applied on fresh and legacy databases; all 79 tables enforce RLS and deny browser-role CRUD |
| Before browser audit | 28/28 screen + viewport states passed on unchanged `bc22b0a3` |
| After browser audit | 32/32 states passed: 28 screen + viewport states and 4 action/failure/accessibility checks |
| Responsive screenshots | 1440, 1280, 768, 390px; actual loading and loaded states for all seven screen families |
| Refresh behavior | Content remains mounted; button x/y/width/height unchanged at all four widths |
| Modal behavior | Add-member button x/y/width/height unchanged at all four widths; network failure releases pending state into the existing alert |
| Failure behavior | Synthetic 503 responses replace member skeletons with the existing error state |
| Motion/accessibility | One announcement per active loading region; decorative glyphs; computed animation is `none` under reduced motion; forced-colors screenshots captured |
| Horizontal overflow | None in the 28 destination states at the requested viewport widths |

The complete suite ran before the final interview placeholder refinement. The final 23 focused tests, typecheck, lint, production rebuild, and the complete browser matrix ran after that refinement. A final JSX cleanup restored the synchronous onboarding Continue button's original props; asynchronous handlers are unchanged.

## Limits and existing issues

- The 45 skipped tests require separate native/hosted integration configurations; they were not presented as passes. The browser matrix used real authenticated local synthetic data and the reserved Supabase project.
- Existing lint warnings concern hook dependencies and other pre-existing code; this change introduces no lint errors or warning suppressions.
- The interview fixture does not contain a private PDF resume. The workspace, questions, notes, and existing unavailable-resume state were inspected; private PDF preview success was not claimed.
- Initial development-server captures occasionally had JavaScript chunk errors. Final evidence was recaptured from separate production servers without page errors. Production builds and running servers used separate checkouts.
- No request, authorization, database, error-handling, or completion behavior was changed. The fixture script creates only a separate synthetic local waitlist letter.

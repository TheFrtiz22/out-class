# Interface consistency audit — October 8, 2026

## Scope and reference

The supplied `outclass-reel-review.md` was read in full from the attached output document; `docs/outclass-reel-review.md` is absent in this checkout. Its recommendations informed this audit; its proposed designs were assessed against the current product, rather than treated as instructions to replace it.

Reviewed the global foundations, shared Radix/UI primitives, product shells, public/authentication surfaces, student discovery/application/status/calendar flows, leader recruitment/settings/interview/meeting/task tools, focused voting/interview layouts, and platform administration. Existing role permissions, database shape, authentication, route destinations, actions, and form/change semantics remain unchanged.

## Findings and enforcement

| Role | Finding | Current enforcement |
| --- | --- | --- |
| Typography | Horsham was intentionally replaced on October 2. Campus OS later introduced operational system sans; older guidance incorrectly called Caslon universal. | Preserve self-hosted Caslon on public pages and product display headings; system sans for product body/controls. Updated design-system and historical-audit context. Email Arial and externally supplied artwork are intentional exceptions. |
| Spacing | Product density tokens existed but public fallbacks were missing; Surface density did not determine its own padding. | Shared density fallbacks; compact/roomy nonplain Surface padding; existing page/row/content spacing and expressive landing compositions retained. |
| Borders | Input boundaries were faint; cards and native selects could use divergent treatments. | Stronger semantic input border, quieter structural border; consistent input/textarea/select roles. Discovery cards retain a structural border. |
| Radii | Operational CSS mixed literal radii; Card and Surface used different container roles. | Control `md`, grouped surface `lg`, small detail `sm` tokens; scheduling/task/interview-kit literals normalized. Circles, pills, paper corners and brand compositions remain purposeful exceptions. |
| Buttons | Primitive sizes disagreed with product overrides; small/default could become identical. | 36px compact, 40px default, 44px large; data-size-driven shared minimums; mobile minimum44px, including square icon targets. Variants, normal submit behavior and disabled semantics retained. |
| Navigation | ProductShell already unifies student/leader/admin destinations and responsive rail/header/mobile menus. | Reuse existing shell; retain Explore / Apply / My Clubs, contextual routes, unified Status, active indicators, Lucide icons and keyboard navigation. No new navigation hierarchy. |
| Form controls | Radix select trigger had popover elevation; native selects repeated border/padding classes. | Trigger shadow removed; real popover elevation retained. NativeSelect preserves browser options, change events, keyboard and form semantics. Adopted in student, leader, interview, meeting, task and admin consumers; base native-select compatibility covers remaining fields. Mobile fields use >=16px text. |
| Cards | Low surface elevation was much heavier than needed; broad rounding made tools less precise. | Shared low surface shadow, consistent operational container radius; discovery hover retains a small lift using its own surface-hover token. Dialog/menu elevation remains distinct. Plain sections, rows and dividers remain first-class. |
| Icons | Existing Lucide integration already provides consistent interface vocabulary. | Continue Lucide and shared icon buttons; no replacement library. Functional icon sizes, logo artwork, campus illustrations and avatars retain their appropriate scale. |
| Status | Canonical labels already existed, but product CSS still selected previous label strings. | Stable data-status-code binds semantic tones to stored status codes across product/focused/reference contexts, while retaining readable labels, existing dots and unknown-status fallback. No database status rename. |
| Loading | Workspace skeletons existed; other screens used inconsistent blank paragraphs or bespoke card placeholders. Reports briefly displayed empty results while loading. | Shared LoadingState with rows/cards/inline layouts, one accessible announcement, decorative skeletons/Lucide. Adopted in workspace, discovery, saved clubs, tracker, meetings, booking/rooms and admin reads. Reports distinguish initial loading, real empty results and errors. |
| Empty states | Some screens always added a blue box; dense tools and editorial views need different presentation. | Shared EmptyState density/alignment/tone API: default plain; subtle or outlined only when helpful. Used for discovery filters, saved-club emptiness, meetings and admin no-results, preserving available next steps and retries. |

## Intentional exceptions and relevance of the review

Already implemented: unified product navigation, canonical application labels, shared page headers/layout tokens, Lucide, reduced-motion overrides, working demo access, custom landing opening, campus imagery, focused review workflows, and informative student cards. The review's consolidation and consistency recommendations remain relevant to shared primitives and feedback rather than another wholesale page redesign.

Conflicting recommendations: reinstating a different universal font would contradict the documented current migration and Campus OS hierarchy. Flattening all layouts into identical cards would harm dense review tools. Removing all shadows/gradients/animations would erase meaningful elevation, photographic legibility, club identity and the recognizable opening. These were not applied.

Retained: navy/orange UVA identity, warm campus canvas, "One profile. Every opportunity.", split-opening photography, existing image overlays and club cover colors, textured Corkboard flyers, meaningful motion with reduced-motion support, focused-slide sizing, modal focus behavior and domain-specific progress/availability information. The compatibility layer does not erase intentionally styled calendar cells, dark navigation controls or custom public artwork.

## Verification

The interactive `/design-system` reference now includes native/Radix selects, compact actions, distinct empty-state treatments, loading layouts and canonical status examples. Regression tests verify native field semantics, one loading announcement and named/actionable empty states; existing shallow workflow harnesses recognize the extracted controls without changing their business assertions.

Local browser verification uses the guarded, isolated Profile Supabase environment, never production. `scripts/verify-interface-consistency.cjs` covers public landing/auth, reference controls and overlay focus return, leader applicants/application settings/tasks, and genuinely elevated admin users/reports at 1440×900 and 390×844. It checks page overflow, browser errors, field geometry, real native/Radix selection, reduced motion and optional axe WCAG A/AA reference checks. `scripts/verify-student-journey-browser.cjs` covers real search/filter/profile/draft validation/save/reload/submission/Status/interview booking/rescheduling/calendar at both sizes.

Representative visual verification is not an exhaustive screenshot test of every permission/data combination. The shared token/component changes reach those screens; domain-specific presentations remain in their owning components.

Final results: 841 tests passed, 7 skipped, 0 failed; typecheck and local production build passed. ESLint: 0 errors, 25 existing warnings. Both browser runners passed on desktop/mobile. Reference axe WCAG A/AA found no violations; native/Radix select interaction, dialog Escape/focus return, reduced motion and actual 40/36px desktop versus 44/44px mobile action heights passed. Screenshot review covered representative public, student, leader and admin surfaces. No deployment or schema migration was made.

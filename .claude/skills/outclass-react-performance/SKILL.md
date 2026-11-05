---
name: outclass-react-performance
description: Use when changing an OutClass page, layout, Server Component, Client Component or Server Action on a signed-in path (Home, Explore, Pipeline, interviews, voting, inbox), when a change adds a dependency or a large component to the client bundle, or when asked to make something faster.
---

# OutClass React performance

Signed-in reads are fast today (p50 0.23–0.31 s after the Nov 4 region move, `docs/performance/region-co-location-20261104.md`). The goal is to keep it that way and to claim a speedup only with measurement, as `CLAUDE.md` rule 7 requires.

## Before you change anything
- Read the relevant note in `docs/performance/`: club write contention, interview booking contention, voting ballot contention, dashboard requests, navigation audit. Several "obvious" optimizations were already tried and measured there.

## Patterns, in priority order

### 1. No request waterfalls (biggest win)
- Start independent queries together with `Promise.all`; await only where the value is used.
- Run cheap checks (auth, a feature flag, a missing ID) before expensive awaits, and return early.
- Let Server Components fetch in parallel by composition, not one parent fetching everything in sequence.
- Use `Suspense` boundaries so slow panels stream instead of blocking the page.

### 2. Server work
- Authenticate Server Actions like route handlers (`requireAuth` first). The session lookup underneath it (`getSessionUser` in `@/utils/auth`) is cached per request with `React.cache`; reuse it rather than querying the user again in the same request.
- Use `React.cache` for per-request deduplication, following `utils/current-user.ts` and `utils/auth.ts`. Never use module-level mutable state for per-user data.
- Send Client Components only the fields they render. Large Prisma rows in props cost serialization time and can leak private data.
- Use `after()` only for work whose failure is recorded somewhere; never for email sends, which belong to the outbox.

### 3. Client bundle
- Import icons through `@/components/icons`, not the whole icon library.
- Load heavy, rarely used components (editors, PDF tools, charts, dialogs) with `next/dynamic`.
- A new client dependency goes through `outclass-reuse-first` and the decision log.

### 4. Client rendering
- Derive values during render instead of syncing them with `useEffect`.
- Keep high-frequency values (pointer position, scroll, timers) in refs, and use `startTransition` or `useDeferredValue` for non-urgent updates on large lists.
- Do not define components inside components, and do not add `memo` to cheap components without a measured reason.
- Respect `prefers-reduced-motion` for animations; animate wrappers, not SVG internals.

### 5. Data fetching on the client
- Idle and hidden tabs must not poll. The inbox uses Realtime signals with an SSE fallback; reuse that instead of adding a new interval.

## Measuring
- Navigation and interaction: `scripts/compare-navigation-performance.cjs` (local, synthetic; compare against a baseline URL).
- Server-side and query cost: `scripts/performance-audit.cjs` (no `.env`, no production data).
- Contention: `scripts/run-contention-benchmark.cjs` on disposable Postgres.
- Production field data: Vercel Speed Insights and runtime logs, read-only.

Report a before and after number with the command that produced it, and say whether it was synthetic or field data. "Should be faster" is not evidence.

<!-- Adapted for OutClass from Everything Claude Code (react-performance skill), MIT License, Copyright (c) 2026 Affaan Mustafa. See docs/agent-ops/decision-log.md. -->

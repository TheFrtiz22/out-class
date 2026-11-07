# Public site performance (PUBLIC-SITE-1, Phase 4)

Synthetic lab measurement, not field data. Local production builds (`next build` + `next start`) on the
same container, signed out, against a disposable loopback Postgres seeded from the repo's club packages
(38 clubs). Command:

```bash
OUTCLASS_CHROMIUM=/opt/pw-browsers/chromium OUTCLASS_VITALS_URL=http://127.0.0.1:<port> OUTCLASS_VITALS_OUT=<file> node scripts/public-site-vitals.cjs
```

- Desktop: 1440×1000, no throttling. Phone: 390×844 touch, 4× CPU slowdown, 150 ms RTT, 1.6 Mbps down.
- Cold = fresh browser context; warm = second load in the same context. Median of 3 runs each.
- INP = longest event duration for one tap/click on the first visible control (0 = nothing was clicked).
- *First content* = first frame with a painted `h1` and no full-screen loading cover.
- Before: `origin/main` 8ffe7722 (`vitals-before.json`). After: this branch after Phase 4 (`vitals-after.json`).

| Page | Profile | Load | LCP before → after (ms) | First content* before → after (ms) | CLS before → after | INP before → after (ms) |
|---|---|---|---|---|---|---|
| / | desktop | cold | 172 → 240 | 143 → 143 | 0.000 → 0.002 | 0 → 32 |
| / | desktop | warm | 176 → 208 | 113 → 109 | 0.000 → 0.000 | 0 → 24 |
| / | phone | cold | 424 (cover) → 964 | not reached → 883 | 0.000 → 0.016 | 0 → 24 |
| / | phone | warm | 332 → 528 | 395 → 449 | 0.000 → 0.000 | 0 → 32 |
| /uva | desktop | cold | 208 → 200 | 154 → 129 | 0.003 → 0.004 | 32 → 16 |
| /uva | desktop | warm | 184 → 148 | 177 → 94 | 0.003 → 0.000 | 24 → 16 |
| /uva | phone | cold | 1228 → 948 | 1175 → 900 | 0.016 → 0.016 | 72 → 80 |
| /uva | phone | warm | 448 → 392 | 488 → 359 | 0.000 → 0.000 | 80 → 80 |
| /club/[id] | desktop | cold | 252 → 160 | 148 → 88 | 0.000 → 0.000 | 0 → 0 |
| /club/[id] | desktop | warm | 320 → 172 | 182 → 95 | 0.000 → 0.000 | 0 → 0 |
| /club/[id] | phone | cold | 812 (cover) → 900 | 4328 → 840 | 0.000 → 0.000 | 72 → 64 |
| /club/[id] | phone | warm | 1220 → 432 | 1166 → 382 | 0.000 → 0.000 | 72 → 72 |
| /login | desktop | cold | 152 → 152 | 104 → 113 | 0.002 → 0.002 | 32 → 32 |
| /login | desktop | warm | 120 → 152 | 83 → 99 | 0.000 → 0.000 | 32 → 32 |
| /login | phone | cold | 1912 (cover) → 1156 | 957 → 1122 | 0.002 → 0.002 | 40 → 40 |
| /login | phone | warm | 332 → 344 | 295 → 309 | 0.000 → 0.000 | 40 → 40 |

"(cover)" marks runs where the measured LCP element was the full-screen "Loading OutClass…" mark, so the
before LCP understates when content appeared; compare *First content* there.

## What changed
- The root `app/loading.tsx` cover streamed in front of every public page. It now lives only on
  authenticated workspace segments, so public server HTML paints first. Club profiles no longer wait for
  device customization before rendering (real clubs render from server data). Result: club profile on a
  cold phone shows content at 840 ms instead of 4,328 ms; the homepage on a cold phone shows content at
  883 ms (before: the cover was still up when the run ended).
- `/uva` phone cold CLS was 0.128 on this branch before the fix (the new two-button hero re-wrapped when
  Source Sans replaced the fallback font at ~2.9 s). Phone hero actions now stack, giving 0.016.

## Caveats
- The homepage default audience changed from leaders to students, so `/` renders a different hero; its
  LCP element (the h1) is not the same text before and after.
- All pages are within target (LCP ≤ 2.5 s, CLS ≤ 0.1) in every profile measured. These are lab numbers on
  a local server; Vercel Speed Insights after deploy is the field check.

## Final (after Phase 5)

Same command against the final build (`vitals-final.json`).

| Page | Profile | Load | LCP before → final (ms) | First content before → final (ms) | CLS before → final | INP before → final (ms) |
|---|---|---|---|---|---|---|
| / | desktop | cold | 172 → 288 | 143 → 174 | 0.000 → 0.002 | 0 → 24 |
| / | desktop | warm | 176 → 248 | 113 → 137 | 0.000 → 0.000 | 0 → 24 |
| / | phone | cold | 424 (cover) → 1128 | not reached → 1043 | 0.000 → 0.016 | 0 → 32 |
| / | phone | warm | 332 → 528 | 395 → 454 | 0.000 → 0.000 | 0 → 24 |
| /uva | desktop | cold | 208 → 196 | 154 → 116 | 0.003 → 0.004 | 32 → 24 |
| /uva | desktop | warm | 184 → 176 | 177 → 97 | 0.003 → 0.004 | 24 → 16 |
| /uva | phone | cold | 1228 → 908 | 1175 → 867 | 0.016 → 0.016 | 72 → 88 |
| /uva | phone | warm | 448 → 392 | 488 → 357 | 0.000 → 0.000 | 80 → 72 |
| /club/[id] | desktop | cold | 252 → 208 | 148 → 115 | 0.000 → 0.000 | 0 → 0 |
| /club/[id] | desktop | warm | 320 → 208 | 182 → 114 | 0.000 → 0.000 | 0 → 0 |
| /club/[id] | phone | cold | 812 (cover) → 880 | 4328 → 831 | 0.000 → 0.000 | 72 → 64 |
| /club/[id] | phone | warm | 1220 → 432 | 1166 → 389 | 0.000 → 0.000 | 72 → 72 |
| /login | desktop | cold | 152 → 232 | 104 → 128 | 0.002 → 0.001 | 32 → 24 |
| /login | desktop | warm | 120 → 196 | 83 → 100 | 0.000 → 0.000 | 32 → 24 |
| /login | phone | cold | 1912 (cover) → 948 | 957 → 885 | 0.002 → 0.001 | 40 → 72 |
| /login | phone | warm | 332 → 408 | 295 → 358 | 0.000 → 0.000 | 40 → 72 |

Phase 5 changes that affect these: the homepage story section pins for at most 2,500px and not at all on phones; sign-in renders inside the public frame (desktop LCP element is now the Sample panel title).

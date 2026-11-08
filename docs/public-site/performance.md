# Public site performance (PUBLIC-SITE-1)

Synthetic lab measurement, not field data. Local production builds (`next build` + `next start`) in the same container, signed out, against a disposable loopback Postgres seeded from the repo club packages (38 clubs). Before = `origin/main` 8ffe7722; after = the merged branch (club leaders default, Explore private).

```bash
OUTCLASS_CHROMIUM=/opt/pw-browsers/chromium OUTCLASS_VITALS_URL=http://127.0.0.1:<port> OUTCLASS_VITALS_OUT=<file> node scripts/public-site-vitals.cjs
```

- Desktop: 1440×1000, no throttling. Phone: 390×844 touch, 4× CPU slowdown, 150 ms RTT, 1.6 Mbps down.
- Cold = fresh browser context; warm = second load in the same context. Median of 3 runs.
- LCP and CLS are read before any interaction. INP = longest event for one tap/click on the first visible non-navigating control (menu toggle, audience toggle, email field, else the h1).
- *First content* = first frame with a painted h1 and no full-screen loading cover.
- "(cover)": the LCP element was the full-screen "Loading OutClass…" mark, so LCP understates when content appeared.

| Page | Profile | Load | LCP before → after (ms) | First content before → after (ms) | CLS before → after | INP before → after (ms) |
|---|---|---|---|---|---|---|
| / | desktop | cold | 404 → 224 | 276 → 120 | 0.016 → 0.018 | 16 → 40 |
| / | desktop | warm | 372 → 220 | 247 → 117 | 0.000 → 0.002 | 24 → 24 |
| / | phone | cold | 3944 → 1080 | 1181 → 1004 | 0.000 → 0.001 | 56 → 72 |
| / | phone | warm | 832 → 488 | 733 → 424 | 0.000 → 0.000 | 72 → 72 |
| /uva | desktop | cold | 244 → 188 | 152 → 131 | 0.001 → 0.003 | 32 → 32 |
| /uva | desktop | warm | 140 → 152 | 107 → 94 | 0.003 → 0.000 | 24 → 32 |
| /uva | phone | cold | 1212 → 928 | 1169 → 879 | 0.016 → 0.016 | 72 → 104 |
| /uva | phone | warm | 412 → 516 | 458 → 457 | 0.000 → 0.000 | 80 → 80 |
| /club/[id] | desktop | cold | 396 → 240 | 335 → 161 | 0.001 → 0.002 | 48 → 16 |
| /club/[id] | desktop | warm | 340 → 212 | 277 → 138 | 0.001 → 0.002 | 48 → 16 |
| /club/[id] | phone | cold | 780 (cover) → 876 | 4340 → 824 | 0.000 → 0.000 | 72 → 64 |
| /club/[id] | phone | warm | 1052 → 472 | 1005 → 422 | 0.000 → 0.000 | 72 → 72 |
| /login | desktop | cold | 164 → 236 | 111 → 128 | 0.002 → 0.001 | 32 → 24 |
| /login | desktop | warm | 128 → 208 | 84 → 107 | 0.000 → 0.000 | 32 → 24 |
| /login | phone | cold | 1860 (cover) → 920 | 969 → 864 | 0.002 → 0.001 | 48 → 72 |
| /login | phone | warm | 336 → 456 | 299 → 389 | 0.000 → 0.000 | 48 → 72 |

All pages are within LCP ≤ 2.5 s and CLS ≤ 0.1 in every profile after the change.

## What changed
- The root `app/loading.tsx` cover streamed in front of every public page; it now lives only on authenticated workspace segments, and club profiles render from server data immediately. Largest effects on a cold phone: homepage LCP 3,944 → 1,080 ms, club profile first content 4,340 → 824 ms, sign-in LCP 1,860 → 920 ms.
- `/uva` phone hero actions stack so the Source Sans swap cannot re-wrap them (this branch had CLS 0.128 there before the fix; 0.016 after).
- The homepage audience toggle updates immediately and the content switches in a React transition: a cold, throttled-phone switch from Club Leaders to Students went from 272 ms to 104 ms event duration (desktop 168 → 48 ms), measured with a dedicated tap on the toggle. A second tap during a pending switch always wins (hook test).

## Measurement note
An earlier version of the script clicked the first link or button in `main`; on the desktop club page that was the back link, so those rows measured the homepage. The script now reads LCP/CLS before interacting and never clicks a navigating control; both builds above were re-measured with the fixed script.

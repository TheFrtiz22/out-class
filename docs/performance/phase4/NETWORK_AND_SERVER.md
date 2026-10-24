# Phase 4 network and server phases

Accepted awake comparison only. Milliseconds, p50 / p95; database-await and serialization columns show p50. These are awaited application spans, not pure PostgreSQL engine execution or pure pool wait. Acquisition includes BEGIN/transport; nested spans must not be added as independent time. Transfer uses browser request timing. The request-drain proxy includes background work and observer scheduling.

| Applicants · condition | GET TTFB before → after | GET transfer before → after | Server total before → after | Database await before → after | Serialization before → after |
|---|---:|---:|---:|---:|---:|
| 100 · cold | 34.3 / 38.2 → 34.1 / 45.8 | 0.3 / 0.4 → 0.3 / 0.5 | 32.8 / 36.8 → 32.7 / 43.1 | 8.9 → 9.5 | 0.5 → 0.6 |
| 100 · warm | 32.6 / 35.9 → 31.7 / 33.8 | 0.3 / 0.4 → 0.3 / 0.3 | 30.8 / 34.6 → 30.1 / 32.2 | 8.6 → 8 | 0.4 → 0.4 |
| 1,000 · cold | 91.7 / 132.2 → 84.2 / 86.5 | 0.7 / 0.8 → 0.7 / 0.7 | 90.2 / 130.6 → 82.8 / 85.1 | 57.1 → 47.9 | 4 → 3.5 |
| 1,000 · warm | 83.3 / 86.5 → 79.3 / 96.1 | 0.7 / 0.9 → 0.7 / 0.9 | 81.8 / 85 → 77.7 / 94.2 | 50.3 → 46.4 | 3 → 3 |
| 5,000 · cold | 344.9 / 370.8 → 298.9 / 346.1 | 2.1 / 2.5 → 2.1 / 2.3 | 343.3 / 369.1 → 297.5 / 344.7 | 257.6 → 220.6 | 19 → 16.3 |
| 5,000 · warm | 338.4 / 397 → 288.8 / 314.6 | 2.3 / 3.1 → 2.2 / 2.6 | 336.6 / 395.4 → 287.2 / 313 | 248.6 → 218.6 | 19.7 → 15.5 |

Raw request records retain identity, live-session, transaction-acquisition and other fixed phase labels, trace IDs, timings, byte counters and long tasks. No SQL text, parameters, response bodies, auth headers or cookies are exported. See comparison-awake/COMPARISON.json and its complete raw blocks. The earlier comparison contains system-sleep gaps and is not accepted for latency claims.

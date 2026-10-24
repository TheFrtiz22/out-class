# Network and server phase evidence

Milliseconds, p50 / p95. Critical reads are the selected list GET or the new single-applicant GET. Baseline profiles use resident bytes and have no corresponding detail GET. 5,000-applicant profile figures are conditional on successful source preparation.

| Applicants / path / condition | Build | GET TTFB | GET transfer | Server total | Identity | Database | Acquire | Serialization | Observed drain proxy |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 / list / cold | Before | 48.85 / 52.93 | 0.63 / 0.69 | 47.43 / 51.02 | 22.16 / 23.88 | 18.09 / 20.02 | 0.44 / 0.55 | 4.68 / 5.15 | 58.5 / 62.3 |
| 100 / list / cold | After | 37.15 / 41.44 | 0.31 / 0.41 | 35.56 / 39.93 | 22.48 / 27.58 | 9.14 / 11.64 | 0.42 / 0.54 | 0.49 / 1.44 | 43.4 / 47.6 |
| 100 / list / warm | Before | 45.57 / 49.84 | 0.61 / 0.79 | 44.16 / 48.5 | 20.58 / 22.1 | 16.07 / 19.18 | 0.39 / 0.44 | 4.59 / 5.51 | 51.5 / 55.5 |
| 100 / list / warm | After | 32.37 / 34.57 | 0.32 / 0.45 | 30.87 / 32.66 | 19.79 / 20.82 | 8.6 / 10.62 | 0.39 / 0.45 | 0.43 / 1.48 | 35.5 / 37.9 |
| 100 / profile / cold | Before | — / — | — / — | — / — | — / — | — / — | — / — | — / — | 69.6 / 81.5 |
| 100 / profile / cold | After | 28.7 / 38.12 | 0.31 / 0.36 | 27.21 / 36.64 | 19.29 / 27.41 | 5.64 / 7.66 | 0.41 / 0.54 | 0.25 / 0.27 | 109.4 / 125.5 |
| 100 / profile / warm | Before | — / — | — / — | — / — | — / — | — / — | — / — | — / — | 80.1 / 119.7 |
| 100 / profile / warm | After | 38.68 / 46.3 | 0.31 / 0.37 | 37.19 / 44.68 | 30.92 / 37.41 | 5.06 / 5.57 | 0.42 / 0.51 | 0.27 / 0.32 | 116.4 / 135.1 |
| 1,000 / list / cold | Before | 226.14 / 280.14 | 6.67 / 11.24 | 224.49 / 278.12 | 21.96 / 26.14 | 119.04 / 139.93 | 0.42 / 0.55 | 69.28 / 109.25 | 263.4 / 457.6 |
| 1,000 / list / cold | After | 94.49 / 115.78 | 0.62 / 1.02 | 93.12 / 114.04 | 22.24 / 25.57 | 58.3 / 71.73 | 0.46 / 0.59 | 4.02 / 4.45 | 101.4 / 123.9 |
| 1,000 / list / warm | Before | 208.82 / 246.22 | 6.79 / 10.06 | 206.79 / 244.39 | 21.88 / 27.01 | 120.37 / 131.96 | 0.41 / 0.54 | 48.94 / 72.84 | 246.5 / 286.1 |
| 1,000 / list / warm | After | 85.22 / 114.94 | 0.65 / 0.96 | 83.76 / 113.07 | 20.2 / 22.1 | 51.61 / 79.91 | 0.43 / 0.64 | 3.02 / 4.5 | 90.4 / 120.1 |
| 1,000 / profile / cold | Before | — / — | — / — | — / — | — / — | — / — | — / — | — / — | 217.2 / 9,210.2 |
| 1,000 / profile / cold | After | 31.9 / 35.3 | 0.28 / 0.37 | 30.43 / 33.68 | 21.99 / 26.31 | 5.26 / 7.7 | 0.38 / 0.55 | 0.25 / 0.27 | 111.7 / 120.1 |
| 1,000 / profile / warm | Before | — / — | — / — | — / — | — / — | — / — | — / — | — / — | 207.1 / 10,972.4 |
| 1,000 / profile / warm | After | 39.16 / 68.25 | 0.3 / 0.32 | 37.51 / 66.15 | 30.16 / 56 | 5.19 / 7.94 | 0.41 / 0.71 | 0.25 / 1.44 | 117.5 / 8,086.5 |
| 5,000 / list / cold | Before | 864.59 / 928.4 | 36.27 / 47.87 | 863.04 / 926.76 | 21.11 / 24.4 | 577.86 / 620.35 | 0.44 / 0.72 | 215.25 / 245.07 | 948.4 / 1,034.4 |
| 5,000 / list / cold | After | 344.12 / 411.6 | 2.24 / 2.71 | 342.75 / 409.86 | 22.24 / 25.41 | 267.8 / 306.43 | 0.43 / 0.51 | 17.92 / 19.91 | 357.9 / 425 |
| 5,000 / list / warm | Before | 928.83 / 956.54 | 45.4 / 50.68 | 927.26 / 954.82 | 21.19 / 22.63 | 582.33 / 618.35 | 0.43 / 0.54 | 267.71 / 287.22 | 1,031.4 / 18,871 |
| 5,000 / list / warm | After | 344.4 / 373.31 | 2.37 / 2.69 | 342.67 / 371.91 | 21.16 / 23.24 | 268.18 / 281.73 | 0.43 / 0.54 | 17.79 / 33.47 | 354.8 / 383.7 |
| 5,000 / profile / cold | Before | — / — | — / — | — / — | — / — | — / — | — / — | — / — | 904.5 / 933.2 |
| 5,000 / profile / cold | After | 40.46 / 51.32 | 0.29 / 0.44 | 38.86 / 49.47 | 31.26 / 37.23 | 6.36 / 10.61 | 0.4 / 0.48 | 0.26 / 0.44 | 122.4 / 139.4 |
| 5,000 / profile / warm | Before | — / — | — / — | — / — | — / — | — / — | — / — | — / — | 859 / 870.4 |
| 5,000 / profile / warm | After | 38.44 / 47.14 | 0.29 / 0.37 | 36.89 / 44.76 | 29.16 / 35 | 6.2 / 6.62 | 0.42 / 0.59 | 0.28 / 2.49 | 120.7 / 143.1 |

Transfer comes from browser request timing, not controller event timestamps. Acquire includes BEGIN/transport, not pure pool wait. Phases may overlap. The drain proxy can include background work and observer scheduling; it is not a wire-transfer statistic. Raw requests retain every timing and non-sensitive trace ID. No SQL text, parameters, credentials or protected response bodies are exported.

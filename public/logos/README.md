# Club logo assets

`ClubLogo` accepts an explicit `logoUrl` (including a protected club-asset reference).
That source takes precedence over bundled legacy artwork. Known bundled keys are
`vvf`, `mii`, `180-degrees`, `180-degrees-globe`, `enactus` and `enactus-wordmark`.
Their exact PNG/WebP paths are listed in `lib/club-assets.ts`.

For a new bundled image, add its path to that map or pass an explicit `logoUrl`.
Database UUIDs and unknown labels do not imply local files. Missing artwork renders
the existing accessible initials/wordmark immediately, without a guessed request.
A broken explicit source retains the same fallback; replacing it retries the new source.
OutClass brand assets are separate from club logos.

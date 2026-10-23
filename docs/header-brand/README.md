# Header and dock branding refinements

The shared workspace header sits 12px higher on desktop, with a 54px capsule (previously 58px). The selected workspace takes 1.65 shares of the fixed desktop bar; inactive workspaces take one share each. Existing mobile ratios retain room for three personal modes. Inactive Personal and Club Leader choices show their mode hints, and the orange marker is removed. Touch targets remain at least 44px tall.

The dock uses a single transparent SVG assembled from the outlined letters in `public/brand/premium-board/04_wordmark_no_sword.svg`. The same O and C form the collapsed monogram, then separate as the remaining letters appear. There is no boxed icon, duplicate text logo, new font, image request, animation loop, or extra React state. Hover and keyboard expansion use the existing dock state; reduced motion switches immediately between the two compositions.

## Review artifacts

All captures use the real shared shell, CSS, and artwork with fictional local identities and data. They do not show a production account.

- [Personal header](previews/personal-header.png)
- [Club Leader header](previews/leader-header.png)
- [Expanded wordmark](previews/expanded-wordmark.png)
- [Header and wordmark animation](previews/header-and-wordmark.webm)

Regenerate the focused captures with `node scripts/record-header-brand.cjs`. The existing workspace/dock browser suites cover route preservation, authorization visibility, keyboard behavior, reduced motion, 320–1920px layouts, and accessibility. New assertions cover fixed capsule height, its higher position, active-segment room, inactive-only hints, absence of the orange marker, transparent vector composition, and the C's two positions. The task-browser suite also passes with the smaller header.

Validation: Chrome and WebKit browser suites passed; production build and typecheck passed; lint reports zero errors and the 26 existing warnings outside this change. This presentation-only change does not alter authentication, APIs, permissions, or data.

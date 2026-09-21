# Public product story

The hero is followed by five small chapters: profile, discovery, application,
tracking, and club recruitment. Each chapter contains one editorial heading,
one paragraph, and a product example built with the existing Avatar, Badge,
StatusBadge, Progress, and ClubLogo primitives. Examples are explicitly labeled
sample information. They do not mutate data or simulate successful submissions.

The shared scroll system sequences context, heading, copy, and visual. Copy is
briefly sticky on roomy desktop viewports; mobile and reduced-motion layouts
remain in normal flow. A scroll-controlled panel swap was deliberately avoided:
all five ideas stay readable and linkable without timers or viewport locking.

The old comparison grid, logo endorsement strip, feature dump, and three embedded
app iframes have been removed. The page loads no additional app instances.
The existing onboarding wizard is mounted on demand inside the shared accessible
Dialog, reached from the final CTA. Hero/account anchors still point to
#create-account; #students, #clubs, #about and #pricing continue to resolve.
Sign-in and leader entry retain their existing callbacks.

Public campus wording is supplied by LandingPageView's campusName prop, defaulting
to University of Virginia. Authentication is still UVA-only; this prop does not
claim to configure university eligibility. Sample product data remains UVA-specific.

Footer information uses the shared modal instead of a custom unfocused overlay.
Privacy/terms copy remains explicitly pending, not represented as final policies.

Validation: lint/type/tests/build attempted but blocked by unavailable node/pnpm.
Static import, asset, anchor, CSS, and diff checks performed. Browser layout,
modal signup, reduced-motion, and performance verification remain pending.

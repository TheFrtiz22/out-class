# Public product story

Updated October 4, 2026. This is a focused extension of the existing landing page.
The opening takes inspiration from the confidence and restraint of
https://bosefellows.mit.edu/; its assets, wording, and composition are OutClass’s.

## Composition

`LandingIntro` wraps the existing `LandingHero` in a single opening canvas.
The first frame pairs two licensed UVA photographs, colonnade left and Rotunda
right, with one centered H1: “One profile. Every opportunity.” There is no timed
entrance. Scroll opens subtly angled, clipped photographic panels outward and
reveals that same hero and its existing CTA beneath. The heading fades upward,
then returns beneath the panels as they uncover it; it is never duplicated.
One fixed navigation fades in near completion. The walkthrough selector remains
after the opening.

The desktop wrapper is 190svh with a 100svh sticky visual; tablet and phone use
160svh. Panels finish within 92% of the wrapper's extra scroll distance. A native
CSS view timeline with explicit zero inset keeps the intact first frame independent
of the document's anchor scroll padding. No wheel listeners, scroll snapping,
JavaScript scroll loop, animation dependency, or new package was added.
Reduced motion and browsers without the required CSS timeline support get a
static split-image headline, with the original hero support and CTA immediately
below in normal flow. Native skip and opening links keep the content accessible.

`ProductJourney` (in `product-stories.tsx`) renders exactly six chapters for the
selected perspective. It reuses the original alternating preview frames, shared
scroll reveals, finite `ProductMotion`, and desktop sticky copy. Mobile copy
stays in document flow. A compact sticky selector stays available during the story.
The repeated ProcessTimeline and separate RecruitmentDemo/leader story are no
longer rendered on the landing page; their standalone components remain available.

Narrative data lives in `journey-content.ts`; product scenes live in
`journey-scenes.tsx`; URL state lives in `use-landing-perspective.ts`.
Both perspectives share Jordan Avery, MII, and Thursday at 6:30 PM. The interview,
application review, acceptance, and membership previews show the same experience
from each side. All product examples retain their sample-information captions.

## Navigation and access

Native links select `#students` or `#club-leaders`; legacy `#clubs` also selects the
leader view. `#about`, `#pricing`, and `#create-account` remain valid.
The selector uses Next’s replace navigation with `scroll: false`, preserving the
current chapter and supporting refresh/back/forward. It exposes native buttons,
pressed state, keyboard focus, and a concise live status announcement.

Student actions open the existing onboarding dialog. Leader actions invoke the
existing leader auth callback. Navigation and the final invitation follow the
selected perspective. Auth, Microsoft/email sign-in, demo access, routes, data
models, and application workflows were not changed. Photo attribution remains
visible in the footer; OutClass remains identified as independent.

## Verification

- Typecheck and production build pass after refreshing the stale generated Prisma client.
- Lint: zero errors; 31 existing warnings. Tests: 512 pass, 2 skip, zero failures.
- Browser review: 1440×900, 1366×768, 1280×800, tablet 768×1024,
  large phone 430×932, and small phone 320×568, including the production build.
  No document or preview overflow; the two-photo opening and centered headline fit at every size.
- Verified the intact first frame, outward panel movement, complete reveal, native
  opening link and keyboard access to the hero CTA; both perspective links,
  refresh, pointer and keyboard switching, six
  chapters per view, sticky controls/copy, mobile menu/Escape focus, signup dialog,
  and existing leader auth with Microsoft, email, and demo entry options.
- Pointer switching preserves the exact desktop scroll position. Mobile native
  scroll anchoring retains the current chapter as differently sized scenes change.
- Reduced motion uses the static split opening, keeps copy static, and renders
  complete product examples. No account or backend write was performed during QA.

The production smoke test also exposed rejected local database credentials.
The existing public-club loader returned its empty fallback; real organization
listings and live signup/sign-in were not exercised. No database configuration
was changed.

Both photographs use local responsive WebPs with high-priority loading and a
shared navy/cream treatment. The added colonnade variants are 74 KB (960px) and
156 KB (1600px); licensing, sources, and adaptations are documented in
`public/images/campus/README.md` and credited in the footer. No animation stack
was added. LCP was not benchmarked against the old build.

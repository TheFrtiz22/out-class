# Public pages redesign

The public experience uses the existing navy, Virginia orange, cream, campus imagery, and self-hosted Libre Caslon Text. Horsham Serial was intentionally removed in the October 2 typography migration; this work preserves the installed public font without introducing a substitute asset or dependency.

## Page compositions

- `/#about`: five student chapters (Discover → Apply → Interview → Track → Belong) with the existing Students / Club Leaders switch, native chapter links, and finite product demonstrations. Club leaders get the corresponding setup, review, interview, decision, and membership story. Existing profile and scheduling scene components remain available. The Rotunda hero, feature carousel, and student/leader entry actions remain.
- `/about`: an asymmetric campus photograph, the recruitment problem, a navy student/leader section, a grounded UVA chapter, the independence disclaimer, and a school-interest invitation. No founder story, adoption statistic, partnership, or launch milestone is asserted.
- `/uva#faq`: the existing route and section, with eleven answers grouped into five categories. Questions use native details/summary semantics, measured Web Animations height transitions, immediate reduced-motion behavior, and `#faq-answer-…` links. Answers remain present in server-rendered HTML, with matching FAQ structured data.
- `/request-school`: a campus-letter visual and a four-required-field form. Zod validation supplies field-level feedback; failed requests retain entered values and focus the error; saved requests focus a personalized confirmation. The existing API, role values, validation schema, secure storage, and superadmin review are unchanged.

Shared public foundations define reading widths, page spacing, surface colors, button treatments, and motion curves. The reusable header retains Log In and Get Started in all account states. Navigation highlights chapter and FAQ question links. Public fragment navigation focuses destinations and restores fragments after streamed content mounts.

## Changed files

| Area | Files |
| --- | --- |
| Page content and composition | `app/about/page.tsx`, `app/uva/page.tsx`, `app/request-school/page.tsx` |
| Shared public layout and design | `components/landing/public-information-page.tsx`, `public-information.css`, `public-foundations.css`, `public-navigation.tsx` |
| Product walkthrough | `components/landing/journey-content.ts`, `product-stories.tsx`, `journey-atmosphere.css`, `product-story-editorial.css` |
| FAQ and request interactions | `components/landing/public-faq.tsx`, `school-request-form.tsx`, `lib/public-faq.ts` |
| Verification | `tests/seo.test.cjs`, `tests/public-faq.test.cjs`, this document |

## Validation

Validation covers lint, TypeScript, production build, the existing automated suite, and FAQ interaction tests for measured height, rapid reversals, reduced motion, deep-link focus, and animation cleanup. Browser QA checks public routes and signup entry from Home, About, UVA, and Request Your School; desktop/tablet/mobile widths; the existing perspective switch; FAQ keyboard controls and animation; invalid inputs; failed submission recovery; and successful requests for all three roles in an isolated local database.

No authentication code, database schema, deployment, or backend behavior is changed. Request persistence continues to require the existing school-request migration described in [school-requests.md](school-requests.md). Expansion requests never imply university approval or a launch date.

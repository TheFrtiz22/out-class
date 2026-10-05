# OutClass SEO and production audit

Audited October 4, 2026 (America/New_York). Implementation is local and has not been deployed.

The updated build rates **Good**. The homepage is crawlable, has consistent head metadata, and preserves its existing design, copy, photography, demos, animation, and Caslon typography. Mobile loading improved substantially but simulated mobile LCP still needs attention. The currently deployed site remains **Fair** until these fixes are released; social image completion also requires a finished brand asset.

## Architecture inspected

- Next.js **15.5.26**, React **19.2.0**, App Router; no Pages Router.
- `app/layout.tsx` handles local fonts, verified server authentication, support/demo state, shared providers, analytics, and speed insights. Cookie-dependent product pages remain dynamically rendered and their HTML remains private/no-store.
- `/` serves both marketing and query-selected product/authentication views. Marketing HTML is rendered on the server; `HomeEntry` now defers the product bundle until it is needed.
- `/club/[clubId]` is publicly readable and accepts a database ID or slug. It also has fictional fixture fallbacks. Only claimed database profiles with at least 80 characters of substantive description qualify for indexing; boilerplate, unclaimed, empty, and fictional profiles remain readable but are noindex. ID URLs are the existing stable links, so slug aliases canonicalize to the ID without changing product routes.
- Product/authentication routes: `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/platform` and its children, `/settings/organizations`, `/club-access/[clubId]`, `/club-claims/[clubId]`, `/invitations/[id]`, `/club/[clubId]/workspace`, `/club/[clubId]/tasks`, `/meetings` and `/meetings/[id]`, `/check-in`, `/interviews/book`, `/live-voting`, `/vote`, `/voting/[sessionId]/join`.
- `/interviews` and `/decisions` redirect to the existing student status interface. `/preview` and `/design-system` are examples/internal reference routes, excluded from indexing.
- APIs handle user identity, resumes, application attachments, password recovery, demo mode, invitation delivery, and platform support sessions. They remain excluded from indexing, and their existing authorization/mutation guards remain in place.
- Vercel serves production. Its Analytics and Speed Insights script endpoints both returned 200. The obsolete GitHub Pages workflow attempted to publish `out/` even though the application requires a Next.js server; it now validates the application and leaves deployment to Vercel.

## Meaningful findings

**Critical:** No confirmed unauthenticated private-data exposure was found. No database schema, RLS policy, identity-provider configuration, production DNS, or application permissions were changed.

**Important, fixed:** Production robots.txt and sitemap.xml returned 404; canonical, Open Graph, Twitter, and structured metadata were missing; most product routes inherited indexable metadata; the homepage initially loaded 536 kB of product JavaScript; original image optimization was globally disabled; the favicon alone transferred over 700 kB; fonts were served as TTF; three perspective anchors had prohibited ARIA labels; asynchronous metadata could appear outside the head in ordinary browsers.

**Important, remaining:** No suitable 1200 × 630 social image exists. Open Graph/Twitter text is ready, but image tags are intentionally omitted until a real asset is supplied. Simulated mobile LCP is 4.4 seconds; measure real users after deployment before making further tradeoffs.

**Nice to have:** The existing HTTP apex request takes two permanent redirects because Vercel upgrades HTTPS before redirecting the host. Contact/Privacy/Terms dialogs still contain the existing launch placeholders; actual policies require owner-supplied business facts. No obvious accidental Impact Consulting duplication exists in this checkout; repeated club appearances belong to distinct demo scenes, and accessibility text duplicates serve the existing animated controls. Demo figures are already labeled as illustrative/sample information.

## Live production checks versus updated build

| Check | Live production at audit | Updated production build |
| --- | --- | --- |
| Homepage | 200; important text in HTML; one H1 | YES: 200; one H1; readable without JavaScript |
| robots.txt | 404 | YES: valid, 200; references www sitemap |
| sitemap.xml | 404 | YES: valid XML, 200; public canonical URLs only |
| Canonical | Missing | YES: one www canonical; tracking variants consolidate |
| Private routes protected from indexing | Auth checks exist, index directives incomplete | YES: default noindex metadata, product headers, query/cookie protection, crawler exclusions |
| Structured data | Missing | YES: parsed and validated Organization + WebSite graph |
| Social sharing | Metadata missing | Text ready; image needs finished asset |
| HTTPS / apex | HTTPS www is the destination; apex HTTPS redirects 308 | Existing behavior retained; permanent host redirect added as a code backstop |
| Unknown route | 404 | 404, noindex |

The generated sitemap currently contains the homepage only because no profiles in the configured source satisfy the publication criteria. Eligible real profiles enter automatically. Sitemap reads select only public ID/name/description/claim status and never applicant, membership, question, contact, vote, interview, or resume data.

`noindex` and authorization serve different purposes. Robots rules reduce unwanted crawling; access checks protect private data. Existing indexed private URLs may require a removal request because a blocked crawler cannot read a new noindex directive. [Google's noindex documentation](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Performance measurements

Lighthouse **13.5.0**, headless Chrome, local production build, default simulated mobile and desktop presets. Results are laboratory measurements, not production field Core Web Vitals. After measurements use the intended warm public-data cache; cold startup, network location, and Vercel deployment behavior can differ.

| Metric | Mobile before | Mobile after | Desktop before | Desktop after |
| --- | --- | --- | --- | --- |
| Performance | 69 | 85 | 77 | 96 |
| Accessibility | 97 | 100 | 97 | 100 |
| Best practices | 96 | 100 | 96 | 100 |
| SEO | 100 | 100 | 100 | 100 |
| Simulated LCP | 13.6 s | 4.4 s | 3.4 s | 1.4 s |
| CLS | 0 | 0 | 0 | 0 |
| Total blocking time | 30 ms | 0 ms | 0 ms | 0 ms |
| Document response time | 2,570 ms | 10 ms | 3,160 ms | 10 ms |
| Total transfer | 2,370 KiB | 631 KiB | 3,301 KiB | 1,276 KiB |

- Next.js first-load homepage JavaScript: **536 → 148 kB**, about 72% less.
- Both font faces: **303,076 → 120,488 bytes**, about 60% less, with the original glyphs, character maps, and variable axes preserved.
- Favicon: **722,625 → 1,410 bytes**, rendered from the identical existing brand artwork. Apple touch icon: **32,819 bytes**, 180 × 180.
- Photography is responsive, eagerly loaded for the opening scene, and retains its focal positions. Native optimization supplies AVIF/WebP; small demo images are optimized and below-fold content remains lazy loaded. Arbitrary club-owned remote banners keep their existing direct-image behavior.
- Public launch identities are cached for five minutes. No authenticated HTML or private query result is cached by these changes.
- INP is not inferred from total blocking time. Existing Vercel Speed Insights can provide real interaction and field performance data after deployment.

Before SEO already scored 100 despite missing important infrastructure. These changes address actual crawlability, privacy boundaries, and sharing readiness rather than the score alone.

## Files changed and why

| Files | Purpose |
| --- | --- |
| `lib/seo.ts` | Canonical domain, title, 152-character description, social metadata, indexing policy, factual JSON-LD, real verification/asset configuration |
| `app/layout.tsx` | Native metadata defaults, noindex by default, WOFF2 loading, session-aware identity provider, Vercel telemetry limited to Vercel |
| `app/page.tsx` | Homepage metadata, account/query/cookie indexing protection, JSON-LD, cached public launch identities, lightweight entry |
| `lib/public-club-seo.ts` | Minimal public projection and explicit indexability criteria; outage-safe sitemap source |
| `app/club/[clubId]/page.tsx` | Factual profile metadata and canonical ID URLs; noindex fixtures/incomplete/account responses |
| `app/robots.ts`, `app/sitemap.ts` | Native public crawler endpoints and private-route exclusions |
| `app/manifest.ts` | Accurate brand manifest, browser display, touch icon |
| `app/icon.tsx`, `app/apple-icon.tsx`, `lib/brand-icon.tsx` | Small native icons from existing artwork, replacing oversized `app/icon.png` and `app/apple-icon.png` |
| `next.config.mjs` | Head metadata for every visitor, native image formats/optimization, www redirect, legacy icon redirects, safe headers and private noindex headers |
| `middleware.ts` | Preserve session and mutation guards; skip public metadata GET/HEAD refresh; noindex account query/cookie responses |
| `components/home-entry.tsx`, `components/app-shell.tsx` | Defer product/workspace bundles while preserving student/leader sign-in intent and existing views |
| `components/views/landing-page-view.tsx` | Load the existing signup wizard when requested |
| `contexts/auth-context.tsx` | Avoid unauthenticated identity requests while retaining explicit refresh and authenticated behavior |
| `components/landing/campus-backdrop.tsx`, `components/landing/journey-scenes.tsx` | Optimize original photographs, logos, and sample portrait without changing layout or animations |
| `components/clubs/discovery-card.tsx` | Preserve arbitrary remote club banners when enabling local optimization |
| `components/landing/landing-navbar.tsx` | Native labeled navigation and a real login link with the existing click behavior |
| `components/landing/launch-clubs.tsx` | Real public profile links for actual approved launch participants |
| `components/landing/product-stories.tsx` | Valid roles for existing labeled perspective anchors |
| `app/fonts/libre-caslon-text/*.woff2`, font `README.md` | Lossless encodings, preserved TTF originals, provenance and regeneration instructions |
| `.github/workflows/deploy.yml` | Production validation instead of obsolete GitHub Pages export/deployment |
| `tests/product-integration.test.cjs` | Correct two reproduced pre-existing stale photo assertions to the current bundled sample asset |
| `tests/seo.test.cjs` | Public/private metadata boundaries, projection privacy, sitemap rules/outages, factual schema, and sign-in intent regression coverage |
| `docs/SEO_AUDIT.md`, `docs/seo-audit-results.json` | Audit, measurements, route results, manual setup, and future architecture |

## Verification

- `OUTCLASS_PUBLISH_BUILD=1 npm run build`: **PASS**. Uses the repository's isolated production directory; the existing development build remains separate.
- A second production build in an isolated copy without application environment files: **PASS**, validating the credential-free CI build path.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**, zero errors, 30 existing warnings (existing hook dependency and direct-image warnings). No new warning count was introduced.
- Unit suite: **530 tests, 528 passed, 2 skipped**, zero failures. The ordinary suite skips environment-gated E2E cases; the dedicated run below exercises real services.
- `npm run test:migrations`: **PASS**, all 22 migrations tested on fresh and legacy isolated databases; 43 tables retain RLS and deny browser-role CRUD.
- `npm run test:onboarding:e2e`: **PASS**, all 11 scenarios over real local Next HTTP, Supabase Auth/MFA, PostgreSQL, and captured SMTP. The disposable local project was stopped afterward. No production database was modified.
- Browser checks at 1440 × 900, 390 × 844, and 320 × 740; reduced-motion mobile also checked. Sign-in, signup dialog, keyboard Escape/focus behavior, both product perspectives, and finite demo playback pass; no horizontal overflow or runtime exceptions; zero detected WCAG A/AA violations.
- With JavaScript disabled, the H1, important product descriptions, and login link remain readable and discoverable.
- The crawler check covers 31 public/product/API/redirect/error URLs. Canonical host redirects preserve authentication callback/API query parameters. Private APIs reject unauthenticated requests. Metadata exists in the head for browsers and preview bots.
- Homepage compression is gzip locally; private HTML retains no-store. Fonts/chunks and generated icons use the native asset cache behavior. HSTS/HTTPS remain supplied by Vercel. No CSP was introduced.
- Detailed sanitized measurements and route results: `docs/seo-audit-results.json`.

## Exact remaining manual actions

1. **Social asset:** Add a finished branded **1200 × 630 JPEG or PNG** at `public/images/outclass-social.jpg`. Use the existing logo, typography, and visual language. Set Vercel Production environment variable `OUTCLASS_OG_IMAGE_PATH=/images/outclass-social.jpg`, then redeploy. This activates `og:image` and `twitter:image`; no placeholder or invented social handle is used.
2. **Vercel:** Deploy these changes through the existing project/Git integration using the Next.js framework preset and server build (`pnpm build` or the existing equivalent). Keep `www.out-class.net` as the production domain and the apex as its permanent redirect. Do not deploy `out/`. Verify `/`, `/robots.txt`, `/sitemap.xml`, `/icon`, and `/apple-icon`, plus login and student/club flows on the deployed release. Retain the existing Supabase URLs/keys and allowed authentication callback configuration. The residual HTTP-apex two-hop upgrade is upstream Vercel behavior; review it in Domains if desired, without changing DNS or removing HTTPS enforcement.
3. **Google Search Console:** Add the **Domain property `out-class.net`** and verify ownership with Google's actual supplied DNS TXT value. Alternatively use a URL-prefix property for `https://www.out-class.net/`, supply the real HTML verification token as `GOOGLE_SITE_VERIFICATION` in Vercel, and redeploy. Submit `https://www.out-class.net/sitemap.xml`; inspect the homepage, run Test Live URL, request indexing, and check Google's selected canonical/index status. No verification values were fabricated. [Google ownership verification](https://support.google.com/webmasters/answer/9008080?hl=en), [URL Inspection](https://support.google.com/webmasters/answer/9012289?hl=en).
4. **Bing Webmaster Tools:** Add `https://www.out-class.net/` (or import the verified Search Console property), verify ownership, and submit the same sitemap. If using Bing's meta-tag verification, set its real token as `BING_SITE_VERIFICATION` in Vercel and redeploy; the code emits `msvalidate.01`. [Bing site verification](https://www2.bing.com/webmasters/help/add-and-verify-site-12184f8b), [sitemap submission](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed).
5. **After release:** Recheck mobile field LCP/INP/CLS in the existing Vercel Speed Insights and Search Console as data becomes available. Test a shared link after the image is configured. Complete the existing Privacy/Terms content from actual business practices before launch.

These are account/asset/content actions, not blockers to the completed code changes. Native crawler metadata and image conventions follow [Next.js metadata documentation](https://nextjs.org/docs/app/getting-started/metadata-and-og-images). Domain redirects remain aligned with [Vercel domain guidance](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).

## Future campus architecture (recommendation only)

Use a stable structure such as `/campuses/uva` and later `/campuses/[campusKey]`. The existing School/campus keys provide a useful foundation, but each page should launch only with genuine campus-specific organizations and helpful public recruitment content. Public claimed club profiles can serve discovery searches once their owners supply substantive information; campus-scoped readable slugs could eventually receive permanent redirects from today's stable ID links. Keep applicant/account/workspace views separate and default noindex. No campus pages or fictional SEO listings were generated in this task.

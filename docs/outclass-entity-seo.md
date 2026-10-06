# OutClass entity and UVA SEO

Implemented locally October 6, 2026. Deployment remains with the owner. No migrations, Supabase changes, production environment changes, or Vercel configuration changes were performed.

## Before implementation

Next.js 15.5.26 / React 19.2.0, App Router. Recent SEO work already supplied `lib/seo.ts`, root metadataBase and title template, applicationName, www canonical URLs, Open Graph siteName, Twitter metadata, a bundled 1200×630 social image, robots, sitemap, OutClass manifest, generated icons, and homepage Organization/WebSite JSON-LD. Private pages inherit noindex; account/query variants also receive noindex headers. Only substantive, claimed, discoverable public club profiles enter the sitemap. No public About or UVA information page, FAQPage, WebApplication, or SoftwareApplication schema existed. No verified OutClass social account was found in source; club and fictional demo social URLs are not brand accounts.

The homepage already renders its main text in HTML, with one H1, main, navigation, footer, and descriptive brand alt text. Existing SVG wordmarks, local Caslon fonts, colors, spacing, buttons, and footer styling remain in use.

## Changes

- Homepage title: **OutClass — One profile. Every opportunity.** The description explains student recruitment and club leader tools.
- Improved the existing Organization entity with factual product description and the existing 1254×1254 square `/outclass-brand-mark.png`. No logo was generated or added to the page payload.
- Improved the single authoritative homepage WebSite entity with alternate names **OutClass UVA** and **Out Class**, retaining **OutClass** as the global name and its publisher reference to Organization.
- Created public, server-rendered `/uva` and `/about` information pages using the existing visual language. They explain the product, audiences, UVA starting context, and independence from the university. No launch date, partnership, participant count, rating, review, or university affiliation was invented.
- Added WebPage + FAQPage on `/uva` and AboutPage on `/about`, referencing the homepage entity IDs. The UVA FAQ answers and JSON-LD come from the same data. Native details/summary controls expose answers without JavaScript.
- Reused the footer across all three pages and added normal HTML links for About OutClass and OutClass at UVA. Existing homepage Contact/Privacy/Terms dialog behavior is preserved.
- Added `/uva` and `/about` to the existing sitemap. No timestamps, priorities, private URLs, or sample clubs were added. Existing robots rules already allow all three marketing pages; no robots change was needed.

## Exact files

Created:
- `app/about/page.tsx`
- `app/uva/page.tsx`
- `components/landing/public-footer.tsx`
- `components/landing/public-information-page.tsx`
- `components/landing/public-information.css`
- `docs/outclass-entity-seo.md`

Modified:
- `app/sitemap.ts`
- `components/views/landing-page-view.tsx`
- `lib/seo.ts`
- `tests/seo.test.cjs`

New public URLs after deployment:
- https://www.out-class.net/uva
- https://www.out-class.net/about

## Canonicalization

All production SEO URLs use `https://www.out-class.net`. Existing permanent apex-to-www redirects remain unchanged. A local request with apex Host for `/uva?utm_source=seo` returned 308 to the exact www path/query.

Next.js normalizes the homepage canonical and og:url in generated HTML to `https://www.out-class.net` (without a terminal slash); this is the same root URL as `https://www.out-class.net/`. The helper, sitemap, and entity URLs use the root slash. Non-root canonicals match `/uva` and `/about` exactly. No localhost, HTTP, preview, staging, or old-domain references were found in production SEO metadata. Localhost URLs in tests, historical preview links in documentation, and the `outclass.example` email configuration example are not production metadata.

## Validation

- `npm run lint`: passed, zero errors, 26 existing warnings.
- `npm run typecheck`: passed, including a repeat after the production build.
- `npm run test`: 677 tests; 672 passed, five environment-dependent tests skipped, zero failures.
- `node --test tests/seo.test.cjs`: all 12 passed, covering metadata, entity identity, sitemap, private indexing boundaries, rendered public copy, matching FAQ schema, and footer links.
- `OUTCLASS_PUBLISH_BUILD=1 npm run build`: passed. Service URLs were overridden only in the local validation process with inert localhost endpoints; no saved environment file was changed. Expected database-unavailable logging exercises the existing sitemap fallback. The database-driven club portion was tested with fixtures; no production club inventory was queried.
- Production HTTP/source checks: all three public pages returned 200 with one canonical, correct title/description, OutClass og:site_name and applicationName, social image, index/follow, one H1, and real internal links. Body copy is present before JavaScript executes.
- Parsed actual script contents as JSON; found exactly one Organization and one WebSite across the three pages, consistent entity references, valid absolute URLs, and exact FAQ/visible answer parity. No fabricated SearchAction, sameAs, rating, review, or offers.
- Sitemap/robots: both returned 200; sitemap includes all three public URLs without fake lastmod. Existing noindex protections verified on login, workspace/auth query views, saved clubs, and Corkboard.
- New route bundles: 209 B per route and 114 kB first-load JS including shared framework/providers. No new client page component, library, third-party script, or large visible image.
- `git diff --check`: passed.

## Remaining limits

Browser visual review could not be completed: Chrome automation failed to attach/navigate, and native screen capture subsequently failed. Review the desktop/mobile layouts locally or after deployment; source/HTTP and build validation passed. The local preview was started at http://127.0.0.1:3116.

The global layout still carries existing auth/providers, so the new server pages remain dynamically rendered and inherit shared client code. No application restructuring was attempted. Existing Privacy/Terms dialogs still contain launch placeholders. Environment-gated E2E suites were not provisioned or run; no database migration tests or migrations were run for this SEO-only change.

Google decides crawling, indexing, the displayed site name, rankings, and AI inclusion. Structured data provides factual signals, not a guarantee. FAQ markup is semantic information; it does not promise a FAQ rich result. See [Google site-name guidance](https://developers.google.com/search/docs/appearance/site-names) and [Google generative AI guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## Manual Search Console actions after deployment

1. Select the verified Domain property `out-class.net`, or the verified URL-prefix property `https://www.out-class.net/`. If neither exists, add and verify a property using Google's actual ownership token; no token has been fabricated.
2. Open **Sitemaps** and submit `https://www.out-class.net/sitemap.xml` (enter `sitemap.xml` when the UI already supplies the site prefix). Confirm it reports **Success** and includes the new public pages. [Sitemaps report](https://support.google.com/webmasters/answer/7451001?hl=en).
3. Inspect each URL separately in **URL Inspection**:
   - `https://www.out-class.net/`
   - `https://www.out-class.net/uva`
   - `https://www.out-class.net/about`
   For each: click **Test Live URL**; confirm successful fetch, crawling allowed, indexing allowed, and the expected user-declared canonical. Use **View tested page → HTML** to check the public copy/metadata and JSON-LD; review the screenshot. Then click **Request indexing**. [URL Inspection](https://support.google.com/webmasters/answer/9012289?hl=en).
4. Open **Settings → Search generative AI**. Confirm **Include my site's links and content in Search generative AI features** is selected, or that an inherited setting resolves to inclusion. This controls eligibility for AI Overviews and AI Mode; it does not guarantee appearance. [Google control documentation](https://support.google.com/webmasters/answer/16908024).
5. After Google recrawls, inspect all three URLs again to confirm their indexed status and Google-selected canonical. Review Page indexing for unexpected exclusions and Performance for `OutClass`, `OutClass UVA`, and `OutClass University of Virginia`; use the Generative AI performance report where available. Allow Google time to process the site-name signals; repeatedly requesting indexing will not force the displayed name.

## Actual local HTTP evidence

```json
[
  {
    "path": "/",
    "status": 200,
    "title": "OutClass \u2014 One profile. Every opportunity.",
    "description": "OutClass helps college students discover clubs, apply, manage interviews, and track recruitment, with tools for club leaders to manage applicants and decisions.",
    "canonical": "https://www.out-class.net",
    "h1Count": 1,
    "schemaTypes": [
      "Organization",
      "WebSite"
    ],
    "htmlBytes": 62472,
    "scriptFiles": 21
  },
  {
    "path": "/uva",
    "status": 200,
    "title": "OutClass at UVA | Club Recruitment at the University of Virginia",
    "description": "Learn how OutClass helps University of Virginia students discover organizations, apply to clubs, manage interviews, and track recruitment, with tools for club leaders to manage applicants and decisions.",
    "canonical": "https://www.out-class.net/uva",
    "h1Count": 1,
    "schemaTypes": [
      "WebPage",
      "FAQPage"
    ],
    "htmlBytes": 39624,
    "scriptFiles": 15
  },
  {
    "path": "/about",
    "status": 200,
    "title": "OutClass | About",
    "description": "OutClass is building infrastructure for college club recruitment, beginning at the University of Virginia. Learn who it is for and why it exists.",
    "canonical": "https://www.out-class.net/about",
    "h1Count": 1,
    "schemaTypes": [
      "AboutPage"
    ],
    "htmlBytes": 30257,
    "scriptFiles": 15
  },
  {
    "path": "/login",
    "robots": "noindex, nofollow",
    "header": "noindex, nofollow"
  },
  {
    "path": "/?workspace=student",
    "robots": "noindex, nofollow",
    "header": "noindex, nofollow"
  },
  {
    "path": "/?view=auth",
    "robots": "noindex, nofollow",
    "header": "noindex, nofollow"
  },
  {
    "path": "/saved-clubs",
    "robots": "noindex, nofollow",
    "header": "noindex, nofollow"
  },
  {
    "path": "/corkboard",
    "robots": "noindex, nofollow",
    "header": null
  },
  {
    "path": "apex /uva?utm_source=seo",
    "status": 308,
    "location": "https://www.out-class.net/uva?utm_source=seo"
  }
]
```

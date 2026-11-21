# Club website import

Leaders (Appearance settings) and platform admins (Clubs › New club or Edit) can paste a club's website link at the top of the profile editor. OutClass reads the public page and fills the editor; nothing is saved until the person reviews the values and presses Publish.

## What it fills

| Profile field | Read from |
| --- | --- |
| Club name | JSON-LD Organization name, `og:site_name`, `og:title`, `<title>` (generic parts such as "Home" dropped), `<h1>` |
| Tagline | `og:description` / meta description, else the first sentence of the description (200 characters) |
| Description | Paragraphs in the page's About block, else its `<main>`/`<article>` paragraphs (up to 4, 1,500 characters); boilerplate and placeholder text skipped |
| Accent color | `theme-color` meta (white and near-black ignored) |
| Logo | JSON-LD logo, `og:logo`, an `<img>` named logo, `apple-touch-icon`; must be a real PNG/JPEG/WebP at least 96 px |
| Cover image | `og:image` / `twitter:image`; landscape and at least 600 px wide |
| Website, email, Instagram, LinkedIn, other links | The page address; first usable `mailto:`; profile links (not posts or share buttons) for Instagram, LinkedIn, Facebook, X, TikTok, YouTube, Discord, GroupMe, Linktree, GitHub |
| Time commitment | A sentence such as "We meet Tuesdays at 7 PM in …" |

By default only empty fields are filled; "Replace fields that already have content" lets the website's version win. Images go through the club's normal upload path (`uploadClubAsset`: re-encoded, quota-checked, audited). A brand-new club in Admin has no id yet, so its images are added after the first save.

## Safety

- `lib/club-website-import/safe-fetch.ts`: http(s) on ports 80/443 only, no credentials in the link. Every resolved address is checked inside the socket's own DNS lookup (no rebinding gap) against loopback, private, link-local, shared, reserved, documentation and multicast ranges, including IPv4-mapped IPv6. Redirects (at most 4) are re-checked. 8 s for the page and 6 s per image; 2 MB page and 5 MB image caps, enforced before and after decompression; only HTML or raster image content types.
- Page content is data only. It is parsed with string rules, never executed and never sent to a model. Links are rebuilt as https URLs, so `javascript:` and `data:` links cannot reach a profile. Every value is trimmed to the profile schema's limits and validated again on save.
- `actions/club-website-import.ts`: a leader needs `club.settings` on that club; without a club id the caller must be a platform admin. 20 imports per account per 10 minutes (`RATE_LIMITS.clubWebsiteImport`).
- Sites that refuse automated readers (403/429/503, bot challenges) or build their page in the browser get a plain message to fill the profile in by hand.

Tests: `tests/club-website-import.test.cjs`.

# Footer, "Built at UVA" and FAQ: evidence

Built from the photo band, FAQ and "CTA + footer" sections of `../Main.mockup.html`.

## What changed

- **Built at UVA** (`components/landing/campus-band.tsx`, homepage only): a full-bleed colonnade photograph
  (lazy) with the mockup's navy shade, and the copy on a navy glass card.
- **FAQ** (`/uva`): every question is its own round light-glass row. The markup is unchanged: the same
  `details`/`summary` elements, ids, deep links, animation, reduced-motion path and answers from
  `lib/public-faq.ts`. Only the classes and CSS differ, and the orange accents are now navy or muted.
- **Footer** (`components/landing/public-footer.tsx`, shared by every public page): one navy glass panel over
  the Rotunda (lazy photograph and the hero's navy shade). It holds:
  - an upright Caslon tagline
  - the link columns, with group headings now `h2` so a page's `h1` is never followed by an `h3`
  - the full-width two-tone wordmark, which is also the home link
  - the legal line and Back to Top
  The homepage passes its final call to action as `invitation`, so "Your next **class** starts here." (the
  only orange besides the wordmark), the audience line and the audience button open the same panel. Other
  pages render the panel without it.
- **Wordmark: reused `InteractiveFooterWordmark`.** It already renders a full-width, two-tone (cream OUT,
  orange CLASS) wordmark sized to its container, with a screen-reader label. Its pointer effect is mouse-only,
  off under reduced motion and on touch, and costs no React renders. The mockup uses the SVG artwork
  (`05-wordmark-two-color-dark.svg`); the component sets the same two-tone word in live Caslon, which stays
  sharp at any width and keeps the existing interaction. Swapping in the SVG would mean dropping that
  interaction or rebuilding it on an image.
- Back to Top lost its decorative arrow icon.

## Checks

`scripts/check-public-footer-panel.cjs` runs against a production build. All of these pass for home
(both audiences), About, UVA, Request School, `/privacy`, `/terms` and a 404, at 1440 and 390:
- One footer panel on every page; the call to action and the "Built at UVA" band appear only on the homepage.
- No horizontal overflow and no italics.
- Orange appears only on "class" (besides the wordmark).
- axe reports 0 violations on the footer, the band and the FAQ.
- Every footer link is reachable by Tab, and the wordmark stays still under reduced motion.
- The FAQ rows are round glass `details` that open with Enter.

`/privacy` and `/terms` return the 404 page while `LEGAL_PAGES_PUBLIC` is off (owner decision), so they
were checked as 404s.

`scripts/public-site-audit.cjs` over all 22 page variants gives the same results as `main`
(`public-site-audit-before.txt` and `-after.txt`):
- 0 axe violations and no overflow at 390.
- The `taps:1` results and the 500s on login, signup and short-link pages are the same before and after;
  those pages need Supabase, which this container lacks.

## Old final-invitation CSS

The `.oc-final-invitation` rules in `components/views/landing.css` and `journey-atmosphere.css` matched no markup
once the call to action moved into the footer; they were removed when this branch was updated after #172.

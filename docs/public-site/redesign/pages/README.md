# Public pages: evidence

/about, /uva, /request-school, /login, /signup, /forgot-password, /reset-password and the legal pages, in the
homepage's design language. Layouts follow `../About.mockup.html`, `../SignIn.mockup.html` and
`../RequestSchool.mockup.html`. Those three predate the glass pass, so their white cards became light glass
and their navy cards navy glass.

Presentation only. Copy, form fields, validation, auth flows, routes and the owner's copy decisions are
unchanged. The only TSX edits are glass class names and removed decorative icons, so the authz matrix
skill did not apply.

## By page

- **About**:
  - The hero photograph and the Rotunda photograph sit in round light-glass frames.
  - "One process. Two different workspaces." is two cards: light glass for students, navy glass for club
    leaders. Before, it was a navy band.
  - "Bring OutClass to your campus." is a light-glass card.
- **Request School**:
  - The campus note is a navy-glass card. It is upright: the `<em>` no longer renders italic. The Rotunda
    line-art illustration is hidden (spec: only logos, headshots and campus photos).
  - The form is a light-glass card with round fields and a navy pill submit.
  - On phones the section heading stays visible, so the form title never follows the `h1` directly.
- **UVA**: the "Not at UVA?" box is a light-glass card instead of an orange-ruled panel. The FAQ rows' glass
  arrives with #174. Its two orange FAQ rules are changed here identically, so the merge is clean.
- **Sign in, sign up, forgot and reset password**: already light-glass form cards beside a navy-glass sample
  panel since the public-site pass. Orange is removed from:
  - the field focus glow
  - the notice rule
  - the sample panel's step marks
- **Legal**: `/privacy` and `/terms` render as one light-glass reading card. While `LEGAL_PAGES_PUBLIC` is off
  they are 404s. They were checked in a throwaway build with the flag on, which was never committed; see
  `legal-flag-on-*`.
- **Shared, on every public page**:
  - No orange before kickers or under text links.
  - The nav's Get Started pill and its current-page dot lose their orange.
  - Public pages use a navy focus ring (`--ring` is scoped to `.oc-landing`; the app is unchanged).
  - Decorative arrow and shield icons are removed from links and buttons. The email-toggle chevron (a
    disclosure cue), the sample status checkmarks and the request-success confirmation stay.

The footer on all of these pages is #174's shared panel; this branch does not change it.

## Checks

`scripts/check-public-pages-glass.cjs` runs against a production build at 1440 and 390. All pages pass:
- one `h1`
- no horizontal overflow
- no italics
- no orange text, underlines, borders or fills in `main` or the header (logos excepted)
- at least one glass surface
- axe reports 0 violations

The footer is excluded because #174's own check covers it.

`scripts/public-site-keyboard.cjs` passes all four checks: the phone menu, the homepage audience toggle,
sign-in field order and announced errors, and the sign-up keyboard path.

Sign-in and sign-up need Supabase settings to render. For these checks the build used placeholder values
pointing at an unreachable local port. Nothing real was contacted and nothing was committed.

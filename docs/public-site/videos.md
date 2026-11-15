# Promo videos on the public site

Status: built on `marketing/promo-video-placements` (task PUBLIC-VIDEOS-1, 2026-11-12). Owner approved the placements in chat.

## What is where

| Video | File (`public/videos/`) | Length | Where it is offered |
| --- | --- | --- | --- |
| Club-leader pitch | `outclass-for-clubs-pitch` | 0:59 | Homepage hero, club-leader view: a "Watch the pitch" card beside "Set up your club" |
| Students | `outclass-for-students` | 1:36 | Homepage hero, student view: a "Watch the video" card beside "Create your profile" |
| Club-leader walkthrough | `outclass-for-clubs-walkthrough` | 2:08 | Homepage "How OutClass works", club-leader view: a card under the heading; `/uva` FAQ answer "What can club leaders do?": a text button |
| Overview | `outclass-overview` | 0:51 | `/about`, section 02, under the two workspace cards |
| Universities | `outclass-for-universities` | 1:36 | `/universities` (new, unlisted) |

Sign-in and sign-up have no video. The first-run card for a new club workspace is not built.

## How it works

- `lib/promo-videos.ts` is the list: file name, title, length and a written summary of each video.
- `components/landing/promo-video.tsx` has the only `<video>` on the site and three ways to reach it:
  `WatchVideoCard` (a glass card with a small frame of the video and a play mark; opens the shared
  `Dialog`), `WatchVideoButton` (the same dialog from a text button, for running copy) and
  `PromoVideoFigure` (a poster that plays in place). None mounts the `<video>` before a click. A card
  loads its frame as a small optimized image (192px wide); the video file is only requested on a click.
- Owner asked on 2026-11-12 for the videos to be "more obviously there": the hero and how-it-works
  placements were text buttons first and are cards now.
- The videos have music and on-screen text and no narration. The written summary is the text alternative:
  it is read to screen readers in the dialog and printed under an inline poster. The captions track
  (`public/videos/instrumental.vtt`, off until a viewer turns captions on) has one cue saying the sound is
  instrumental music. If a video ever gains speech, it needs its own captions file.
- Files are same-origin, which is what `media-src 'self'` in `lib/csp.ts` allows. `middleware.ts` lets
  `.mp4` take the same static shortcut as images, so a player's range requests do not each refresh a session.

## `/universities`

Addressed to university staff: the campus video, one card each for students, student leaders and the
campus, and "Start a conversation" to `/request-school`. It is unlisted until university outreach starts:
`robots` is noindex, and it is not in the sitemap, `llms.txt`, the header or the footer. The only link to it
is on `/request-school`. To list it, set `robots: publicRobots`, add it to `app/sitemap.ts` and
`app/llms.txt/route.ts`, and add a footer link.

The page keeps pricing, employer features and usage numbers out, and repeats that a request does not
promise a launch date. The video itself says "Designed to launch on a new campus in days."

## Deviations from the approved mockups

- Hero: the "See how it works" text link is now the video card. The header link and the scroll cue
  still lead to "How OutClass works".
- "No decorative icons": the buttons and cards carry a play mark, as a control, not as decoration. On a
  card the mark is the filled glyph (12px on a cream disc), where the regular outline would not read.
  Posters and card frames are frames from the videos, a new kind of image beside logos, headshots and
  campus photos.

## Replacing a video

Keep the file name and replace both files. Web copies are 1920 x 1080 at 60 fps, H.264 `crf 26`, with
the index at the front (`-movflags +faststart`), 8 to 18 MB each; `tests/promo-videos.test.cjs` refuses a
file above 20 MB. Masters are not in the repository. Update `seconds` and `summary` in
`lib/promo-videos.ts` if either changes.

On-screen claims to keep true: "Free for clubs and students", "Free for students", "Designed to launch on
a new campus in days", "Works alongside your engagement platform", "University email sign-in", "Roles and
permissions for every club", "Built by students at the University of Virginia".

## Open

- The five music tracks were supplied by the owner; confirm they are cleared for public use before merge.
- Hosting: files are committed (about 60 MB). If videos are re-cut often, move them to object storage,
  add that origin to `media-src`, and point `promoVideoSrc` at it.

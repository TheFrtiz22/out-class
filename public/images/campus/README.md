# UVA campus photographs

Only openly licensed photographs are kept here. Every file below is credited on the
site (the "Photo credits" line in the shared public footer, sourced from
`lib/photo-credits.ts`). Do not add a photograph without a license record in this
file and an entry in `lib/photo-credits.ts`.

## Where each photograph is used

| Placement | File | CSS treatment |
| --- | --- | --- |
| Homepage opening backdrop (`components/landing/landing-intro.tsx`) | `rotunda-1600.webp` | cover, `center 35%`, navy gradient overlay |
| Public footer, every public page (`components/landing/public-footer.tsx`) | `rotunda-1600.webp` | cover, `center 35%`, navy gradient overlay |
| Site share card `/og/outclass.png` (`lib/share-card.tsx`) | `rotunda-1600.webp` | sharp left crop over a blurred wash of the same photo |
| /uva hero (`app/uva/page.tsx`) | `rotunda-1600.webp` | full 3:2 frame, uncropped |
| About, "Built by students at UVA" (`app/about/page.tsx`) | `rotunda-1600.webp` | 4:5 crop at `40% center` (5:4 on phones) |
| About hero (`app/about/page.tsx`) | `colonnade-1600.webp` | 4:4.6 crop (5:4 on phones) |
| Homepage "Built at UVA" band (`components/landing/campus-band.tsx`) | `colonnade-1600.webp` | right 68%, cover, navy gradient from the left |

## Credits and licenses

**Rotunda UVa from the south east** by **terren in Virginia**, photographed November 3, 2007.

- Source: https://commons.wikimedia.org/wiki/File:Rotunda_UVa_from_the_south_east.jpg
- License: [Creative Commons Attribution 2.0 Generic](https://creativecommons.org/licenses/by/2.0/)
- Download: https://upload.wikimedia.org/wikipedia/commons/b/bf/Rotunda_UVa_from_the_south_east.jpg
- Upstream border crop by Beao (2023).
- OutClass adaptations: resized to 960px and 1592px wide, converted to WebP; responsive cropping, blur (share card) and translucent navy overlays. No endorsement by the photographer or the University of Virginia is implied.

**Colonnade UVa academical village** by **Eli Pousson**, photographed March 15, 2009.

- Source: https://commons.wikimedia.org/wiki/File:Colonnade_UVa_academical_village.jpg
- Original Flickr source: https://www.flickr.com/photos/59179756@N00/3430071535/
- License: [Creative Commons Attribution-ShareAlike 2.0 Generic](https://creativecommons.org/licenses/by-sa/2.0/)
- Download: https://upload.wikimedia.org/wikipedia/commons/c/cb/Colonnade_UVa_academical_village.jpg
- OutClass adaptations: resized to 960px and 1600px wide, converted to WebP at quality 80; responsive cropping and translucent navy overlays. These adaptations (the files here and their cropped/tinted renderings) are distributed under **CC BY-SA 2.0**, the same license as the source image. No endorsement is implied.

## Removed on November 13, 2026

Earlier owner-supplied photographs with no license record were deleted from
`public/` so they can no longer be served: `football-*`, `autumn-lawn-*`,
`sunset-rotunda-*`, `rotunda-dusk-*`, `lawn-aerial.jpg` and `trees-300.webp`.
They remain only in git history; do not restore them.

## Swapping in UVA photography later

To use official UVA photographs (for example from UVA Communications, with written
permission), replace the files above or add new ones, record the permission or
license here, and update `lib/photo-credits.ts` and the placements in the table.

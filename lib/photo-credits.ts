/**
 * Credits for the campus photographs rendered on public pages and in the site share card.
 * Every photograph under public/images/campus must appear here with its license (see the README there).
 */
export type PhotoCredit = {
  title: string
  author: string
  source: string
  license: string
  licenseUrl: string
  note?: string
}

export const PHOTO_CREDITS: readonly PhotoCredit[] = [
  {
    title: "Rotunda UVa from the south east",
    author: "terren in Virginia",
    source: "https://commons.wikimedia.org/wiki/File:Rotunda_UVa_from_the_south_east.jpg",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    title: "Colonnade UVa academical village",
    author: "Eli Pousson",
    source: "https://commons.wikimedia.org/wiki/File:Colonnade_UVa_academical_village.jpg",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    note: "cropped and tinted; adaptations shared under CC BY-SA 2.0",
  },
]

import { caslonGlyphs, caslonUnitsPerEm } from "./caslon-glyphs"

/** Safe, code-generated placeholders; never a claim to be an official club logo. */
export function demoMonogram(name: string, color: string) {
  const letters = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
  const scale = 26 / caslonUnitsPerEm
  const width = [...letters].reduce((total, letter) => total + caslonGlyphs[letter].width, 0)
  let cursor = 0
  const paths = [...letters].map(letter => {
    const glyph = caslonGlyphs[letter]
    const path = `<path transform="translate(${cursor} 0)" d="${glyph.path}"/>`
    cursor += glyph.width
    return path
  }).join("")
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="12" fill="${color}"/><g fill="white" transform="translate(${48 - width * scale / 2} 57) scale(${scale} ${-scale})">${paths}</g></svg>`)}`
}

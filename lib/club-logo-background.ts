import { z } from "zod"

export const LOGO_NAVY = "#142D45"
export const LOGO_IVORY = "#F7F5F0"
export const logoBackgroundSchema = z.object({
  mode: z.enum(["auto", "navy", "ivory", "transparent", "custom"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color.").optional(),
}).strict().refine(value => value.mode !== "custom" || !!value.color, "Choose a custom background color.")
export type LogoBackground = z.infer<typeof logoBackgroundSchema>
export type LogoAnalysis = { transparent: boolean; light: boolean; lowContrast: boolean }

/** Analyze decoded pixels only. No artwork is edited or uploaded by this code. */
export function analyzeLogoPixels(pixels: ArrayLike<number>): LogoAnalysis | null {
  let transparent = 0, visible = 0, luminance = 0
  const histogram = Array<number>(256).fill(0)
  const count = Math.floor(pixels.length / 4)
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255
    if (alpha < .98) transparent++
    if (alpha < .1) continue
    const light = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]
    visible += alpha
    luminance += light * alpha
    histogram[Math.round(light)] += alpha
  }
  if (!visible) return null
  const percentile = (fraction: number) => {
    let sum = 0
    return histogram.findIndex(weight => (sum += weight) >= visible * fraction)
  }
  return { transparent: transparent / count > .01, light: luminance / visible > 150, lowContrast: percentile(.99) - percentile(.01) < 40 }
}

/** Old logoOnBrand settings remain in effect until a club explicitly chooses a mode. */
export function logoBackgroundColor(marketing: unknown, brand: string, analysis: LogoAnalysis | null): string {
  const value = marketing as { logoBackground?: unknown; logoOnBrand?: boolean } | null
  const parsed = logoBackgroundSchema.safeParse(value?.logoBackground)
  if (!parsed.success) return value?.logoOnBrand && /^#[0-9a-f]{6}$/i.test(brand) ? brand : automatic(analysis)
  const setting = parsed.data
  switch (setting.mode) {
    case "navy": return LOGO_NAVY
    case "ivory": return LOGO_IVORY
    case "transparent": return "transparent"
    case "custom": return setting.color!
    default: return automatic(analysis)
  }
}
function automatic(analysis: LogoAnalysis | null) {
  if (analysis && !analysis.transparent) return "transparent"
  return analysis?.light ? LOGO_NAVY : LOGO_IVORY
}

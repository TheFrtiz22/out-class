"use client"
import { ClubLogo } from "@/components/club-logo"
import { Input } from "@/components/ui/input"
import { useLogoAnalysis } from "@/hooks/use-logo-analysis"
import { clubAssetSource } from "@/lib/club-assets"
import { LOGO_NAVY, LOGO_IVORY, type LogoBackground } from "@/lib/club-logo-background"
import type { ClubMarketing } from "@/lib/club-marketing"

export function LogoBackgroundPicker({ logoUrl, name, color, marketing, onChange }: {
  logoUrl: string | null; name: string; color: string; marketing: ClubMarketing; onChange: (value: LogoBackground) => void
}) {
  const { analysis, ready } = useLogoAnalysis(clubAssetSource(logoUrl, true))
  const setting = marketing.logoBackground
  const mode = setting?.mode ?? (marketing.logoOnBrand ? "legacy" : "auto")
  return <fieldset className="space-y-3 rounded-lg border p-4">
    <legend className="px-1 text-sm font-medium">Logo background</legend>
    <div className="flex flex-wrap items-center gap-4">
      <ClubLogo logoUrl={logoUrl} text={name.slice(0, 2)} color={color} marketing={marketing} assetPreview size="xl" alt={`${name || "Club"} logo preview`} />
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground" role="status">
        {!logoUrl ? "Upload a logo to preview its background." : !ready ? "Checking your artwork…" : !analysis ? "Automatic analysis is unavailable for this image. Choose a background using the preview." : !analysis.transparent ? "This image has its own background. A color behind it cannot change the artwork’s embedded background." : analysis.light ? "Light artwork detected. Automatic recommends OutClass navy (#142D45)." : "Dark artwork detected. Automatic recommends a light ivory background."}
      </p>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Logo background choices">
      {mode === "legacy" && <button type="button" aria-pressed className="rounded-md border px-3 py-2 text-xs">Current brand color</button>}
      {([['auto','Automatic'],['navy','Navy'],['ivory','Ivory / white'],['transparent','No background'],['custom','Custom']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => onChange({ mode: value, ...(value === "custom" ? { color: setting?.color ?? LOGO_NAVY } : {}) })} className={`min-h-10 rounded-md border px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${mode === value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>{label}</button>)}
    </div>
    {mode === "custom" && <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">Custom background color<input type="color" value={/^#[0-9a-f]{6}$/i.test(setting?.color ?? "") ? setting!.color : LOGO_IVORY} onChange={e => onChange({mode:"custom",color:e.target.value})} className="size-10 cursor-pointer rounded border" /></label><Input aria-label="Custom background hex color" className="max-w-36" value={setting?.color ?? ""} maxLength={7} placeholder="#142D45" onChange={e => onChange({mode:"custom",color:e.target.value})} /></div>}
    {analysis && !analysis.transparent && analysis.lowContrast && <p role="note" className="text-xs leading-relaxed text-muted-foreground">The artwork has little internal contrast. A presentation background will not fix an opaque image. Consider uploading a higher-contrast original or a transparent PNG.</p>}
    <p className="text-xs text-muted-foreground">Your choice is applied when you publish the profile. The uploaded artwork stays unchanged.</p>
  </fieldset>
}

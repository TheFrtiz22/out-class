"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  IdCard,
  Palette as PaletteIcon,
  BarChart3,
  Link2,
  Globe,
  Linkedin,
  Instagram,
  Mail,
  RotateCcw,
  UploadCloud,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { clubCategories, initialClubBrandingProfile, type ClubBrandingProfile } from "@/lib/data"
import { MediaUploader } from "@/components/views/branding/media-uploader"
import { ColorPicker } from "@/components/views/branding/color-picker"
import { TagInput } from "@/components/views/branding/tag-input"
import { AccoladeList } from "@/components/views/branding/accolade-list"
import { ProfilePreviewCard } from "@/components/views/branding/profile-preview-card"

export function ClubBrandingEditorView() {
  const [profile, setProfile] = useState<ClubBrandingProfile>(initialClubBrandingProfile)

  function set<K extends keyof ClubBrandingProfile>(key: K, value: ClubBrandingProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  function discard() {
    setProfile(initialClubBrandingProfile)
    toast("Changes discarded", { description: "Reverted to the last published profile." })
  }

  function publish() {
    toast.success("Profile updates published", { description: "Your public page is now live with these changes." })
  }

  return (
    <div className="pb-24">
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Settings form column */}
        <div className="space-y-4">
          <Accordion type="multiple" defaultValue={["identity", "branding", "stats", "socials"]} className="space-y-4">
            {/* 1. Core Identity & Media */}
            <AccordionItem value="identity" className="rounded-lg border bg-card px-4 last:border-b">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                <span className="flex items-center gap-2">
                  <IdCard className="size-4 text-muted-foreground" /> Core Identity &amp; Media
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pt-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="club-name">Club name</Label>
                    <Input
                      id="club-name"
                      value={profile.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Portico Impact Fund"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category</Label>
                    <Select value={profile.category} onValueChange={(v) => set("category", v as ClubBrandingProfile["category"])}>
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {clubCategories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tagline">One-line pitch</Label>
                  <Input
                    id="tagline"
                    value={profile.tagline}
                    onChange={(e) => set("tagline", e.target.value)}
                    placeholder="UVA's premier student-run ESG investment fund"
                  />
                </div>

                <MediaUploader
                  label="Club logo"
                  helpText="Square image recommended, at least 200×200px. Shown as your circular profile avatar."
                  shape="circle"
                  value={profile.logoUrl}
                  onChange={(url) => set("logoUrl", url)}
                />

                <MediaUploader
                  label="Cover banner image"
                  helpText="Wide image recommended, 1200×400px. Displayed at the top of your public profile."
                  shape="banner"
                  value={profile.bannerUrl}
                  onChange={(url) => set("bannerUrl", url)}
                />
              </AccordionContent>
            </AccordionItem>

            {/* 2. Brand Styling & Theme */}
            <AccordionItem value="branding" className="rounded-lg border bg-card px-4 last:border-b">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                <span className="flex items-center gap-2">
                  <PaletteIcon className="size-4 text-muted-foreground" /> Brand Styling &amp; Theme
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <ColorPicker value={profile.accentColor} onChange={(hex) => set("accentColor", hex)} />
              </AccordionContent>
            </AccordionItem>

            {/* 3. Key Marketing Stats & Metrics */}
            <AccordionItem value="stats" className="rounded-lg border bg-card px-4 last:border-b">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                <span className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-muted-foreground" /> Key Marketing Stats &amp; Metrics
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pt-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="acceptance-rate">Acceptance rate</Label>
                    <Input
                      id="acceptance-rate"
                      value={profile.acceptanceRate}
                      onChange={(e) => set("acceptanceRate", e.target.value)}
                      placeholder="8%"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="member-count">Active member count</Label>
                    <Input
                      id="member-count"
                      value={profile.memberCount}
                      onChange={(e) => set("memberCount", e.target.value)}
                      placeholder="45"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="aum">AUM (Assets Under Management)</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-9 items-center rounded-md border bg-muted px-2.5 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="aum"
                      value={profile.aum}
                      onChange={(e) => set("aum", e.target.value)}
                      placeholder="150,000"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label htmlFor="display-aum" className="text-sm font-medium">
                        Display AUM on public page
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Show your fund size to prospective applicants on your profile.
                      </p>
                    </div>
                    <Switch
                      id="display-aum"
                      checked={profile.displayAum}
                      onCheckedChange={(checked) => set("displayAum", checked)}
                    />
                  </div>
                </div>

                <TagInput
                  label="Notable career placements / outcomes"
                  helpText="Type a company and press Enter to add it."
                  values={profile.placements}
                  onChange={(values) => set("placements", values)}
                  placeholder="Goldman Sachs, Citadel…"
                />

                <AccoladeList values={profile.accolades} onChange={(values) => set("accolades", values)} />
              </AccordionContent>
            </AccordionItem>

            {/* 4. Socials & External Links */}
            <AccordionItem value="socials" className="rounded-lg border bg-card px-4 last:border-b">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                <span className="flex items-center gap-2">
                  <Link2 className="size-4 text-muted-foreground" /> Socials &amp; External Links
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="website" className="flex items-center gap-1.5">
                      <Globe className="size-3.5 text-muted-foreground" /> Website URL
                    </Label>
                    <Input
                      id="website"
                      value={profile.website}
                      onChange={(e) => set("website", e.target.value)}
                      placeholder="porticoimpactfund.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="linkedin" className="flex items-center gap-1.5">
                      <Linkedin className="size-3.5 text-muted-foreground" /> LinkedIn page
                    </Label>
                    <Input
                      id="linkedin"
                      value={profile.linkedin}
                      onChange={(e) => set("linkedin", e.target.value)}
                      placeholder="linkedin.com/company/…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="instagram" className="flex items-center gap-1.5">
                      <Instagram className="size-3.5 text-muted-foreground" /> Instagram handle
                    </Label>
                    <Input
                      id="instagram"
                      value={profile.instagram}
                      onChange={(e) => set("instagram", e.target.value)}
                      placeholder="@porticoimpact"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email" className="flex items-center gap-1.5">
                      <Mail className="size-3.5 text-muted-foreground" /> Exec contact email
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={profile.contactEmail}
                      onChange={(e) => set("contactEmail", e.target.value)}
                      placeholder="exec@yourclub.virginia.edu"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Live preview column */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <UploadCloud className="size-3.5" /> Live public profile preview
          </p>
          <ProfilePreviewCard profile={profile} />
        </div>
      </div>

      {/* Sticky save control */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:left-[var(--sidebar-width)] md:peer-data-[state=collapsed]:left-[var(--sidebar-width-icon)]">
        <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={discard}>
            <RotateCcw className="size-4" /> Discard Changes
          </Button>
          <Button onClick={publish}>Publish Profile Updates</Button>
        </div>
      </div>
    </div>
  )
}

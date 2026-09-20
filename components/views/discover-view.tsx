"use client"

import { useMemo, useState } from "react"
import { Search, Sparkles, Star, X } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { ClubLogo } from "@/components/club-logo"
import { discoverClubs, type ClubCategory, type DiscoverClub, type TimeCommitment } from "@/lib/data"
import { useApplicationState } from "@/lib/application-state"
import { cn } from "@/lib/utils"
import type { ViewId } from "@/lib/views"
import { ClubProfileView } from "@/components/views/club-profile-view"

const CATEGORY_OPTIONS: ClubCategory[] = ["Finance", "Consulting", "Tech/Software", "Pre-Law", "Impact"]

const AUM_OPTIONS = [
  { value: "any", label: "Any AUM" },
  { value: "0-50000", label: "$0 – $50k" },
  { value: "50000-250000", label: "$50k – $250k" },
  { value: "250000-plus", label: "$250k+" },
] as const

const TIME_OPTIONS: { value: TimeCommitment; label: string }[] = [
  { value: "1-3", label: "1–3 hours / wk" },
  { value: "3-5", label: "3–5 hours / wk" },
  { value: "5+", label: "5+ hours / wk" },
]

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "competitive", label: "Most Competitive" },
  { value: "newest", label: "Newest" },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]["value"]

const ACCEPTANCE_MIN = 0
const ACCEPTANCE_MAX = 25

function matchesAum(club: DiscoverClub, aum: string) {
  if (aum === "any") return true
  if (club.aumValue == null) return false
  if (aum === "0-50000") return club.aumValue <= 50000
  if (aum === "50000-250000") return club.aumValue > 50000 && club.aumValue <= 250000
  if (aum === "250000-plus") return club.aumValue > 250000
  return true
}

export function DiscoverView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const [search, setSearch] = useState("")
  const [categories, setCategories] = useState<Set<ClubCategory>>(new Set())
  const [acceptanceRange, setAcceptanceRange] = useState<[number, number]>([ACCEPTANCE_MIN, ACCEPTANCE_MAX])
  const [aum, setAum] = useState<string>("any")
  const [timeCommitments, setTimeCommitments] = useState<Set<TimeCommitment>>(new Set())
  const [sort, setSort] = useState<SortValue>("relevance")
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set())
  const [selectedClub, setSelectedClub] = useState<DiscoverClub | null>(null)

  function toggleCategory(cat: ClubCategory) {
    setCategories((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function toggleTimeCommitment(t: TimeCommitment) {
    setTimeCommitments((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  function toggleSubscribed(id: string) {
    setSubscribed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const acceptanceActive = acceptanceRange[0] !== ACCEPTANCE_MIN || acceptanceRange[1] !== ACCEPTANCE_MAX

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let result = discoverClubs.filter((club) => {
      if (query) {
        const haystack = `${club.name} ${club.category} ${club.pitch}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (categories.size > 0 && !categories.has(club.category)) return false
      if (club.acceptanceRate < acceptanceRange[0] || club.acceptanceRate > acceptanceRange[1]) return false
      if (!matchesAum(club, aum)) return false
      if (timeCommitments.size > 0 && !timeCommitments.has(club.timeCommitment)) return false
      return true
    })

    if (sort === "competitive") {
      result = [...result].sort((a, b) => a.acceptanceRate - b.acceptanceRate)
    } else if (sort === "newest") {
      result = [...result].sort((a, b) => discoverClubs.indexOf(b) - discoverClubs.indexOf(a))
    } else {
      result = [...result].sort((a, b) => Number(b.recommended) - Number(a.recommended))
    }

    return result
  }, [search, categories, acceptanceRange, aum, timeCommitments, sort])

  const activeFilterTags = useMemo(() => {
    const tags: { key: string; label: string; onRemove: () => void }[] = []
    if (search.trim()) {
      tags.push({ key: "search", label: `"${search.trim()}"`, onRemove: () => setSearch("") })
    }
    categories.forEach((cat) => {
      tags.push({ key: `cat-${cat}`, label: cat, onRemove: () => toggleCategory(cat) })
    })
    if (acceptanceActive) {
      tags.push({
        key: "acceptance",
        label: `Acceptance Rate: ${acceptanceRange[0]}%–${acceptanceRange[1]}%`,
        onRemove: () => setAcceptanceRange([ACCEPTANCE_MIN, ACCEPTANCE_MAX]),
      })
    }
    if (aum !== "any") {
      const opt = AUM_OPTIONS.find((o) => o.value === aum)
      tags.push({ key: "aum", label: opt?.label ?? "AUM", onRemove: () => setAum("any") })
    }
    timeCommitments.forEach((t) => {
      const opt = TIME_OPTIONS.find((o) => o.value === t)
      tags.push({ key: `time-${t}`, label: opt?.label ?? t, onRemove: () => toggleTimeCommitment(t) })
    })
    return tags
  }, [search, categories, acceptanceActive, acceptanceRange, aum, timeCommitments])

  const recommendedClubs = useMemo(() => discoverClubs.filter((c) => c.recommended).slice(0, 3), [])

  if (selectedClub) {
    return <ClubProfileView club={selectedClub} onBack={() => setSelectedClub(null)} onNavigate={onNavigate} />
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-full">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">

        {recommendedClubs.length > 0 && (
          <div className="rounded-2xl border border-border bg-white p-6 shadow-none">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-5 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground font-sans tracking-tight">Recommended for You</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommendedClubs.map((club) => (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => setSelectedClub(club)}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:bg-slate-50"
                >
                  <ClubLogo clubId={club.id} logoUrl={club.logoUrl} text={club.logoText} color={club.color} size="lg" />
                  <div className="min-w-0">
                    <h3 className="font-sans text-lg font-semibold leading-tight text-foreground tracking-tight">{club.name}</h3>
                    <Badge variant="secondary" className="mt-1.5 text-[10px] font-medium">
                      {club.category}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Filter sidebar */}
          <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[280px]">
            <Card>
              <CardContent className="flex flex-col gap-6 p-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="club-search" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="club-search"
                      placeholder="Search by name, skill, or keyword..."
                      className="pl-8"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</span>
                  <div className="flex flex-col gap-2.5">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <div key={cat} className="flex items-center gap-2">
                        <Checkbox
                          id={`cat-${cat}`}
                          checked={categories.has(cat)}
                          onCheckedChange={() => toggleCategory(cat)}
                        />
                        <Label htmlFor={`cat-${cat}`} className="text-sm font-normal">
                          {cat}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Acceptance Rate
                    </span>
                    <span className="text-xs font-medium tabular-nums text-foreground">
                      {acceptanceRange[0]}%–{acceptanceRange[1]}%
                    </span>
                  </div>
                  <Slider
                    value={acceptanceRange}
                    min={ACCEPTANCE_MIN}
                    max={ACCEPTANCE_MAX}
                    step={1}
                    onValueChange={(val) => setAcceptanceRange([val[0], val[1]])}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    AUM <span className="font-normal text-muted-foreground/80">(Finance clubs)</span>
                  </span>
                  <RadioGroup value={aum} onValueChange={setAum} className="flex flex-col gap-2.5">
                    {AUM_OPTIONS.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem id={`aum-${opt.value}`} value={opt.value} />
                        <Label htmlFor={`aum-${opt.value}`} className="text-sm font-normal">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Time Commitment
                  </span>
                  <div className="flex flex-col gap-2.5">
                    {TIME_OPTIONS.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`time-${opt.value}`}
                          checked={timeCommitments.has(opt.value)}
                          onCheckedChange={() => toggleTimeCommitment(opt.value)}
                        />
                        <Label htmlFor={`time-${opt.value}`} className="text-sm font-normal">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Results */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {activeFilterTags.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{filtered.length} clubs</span>
                ) : (
                  activeFilterTags.map((tag) => (
                    <Badge
                      key={tag.key}
                      variant="secondary"
                      className="gap-1 pr-1.5 text-xs font-medium"
                    >
                      {tag.label}
                      <button
                        type="button"
                        onClick={tag.onRemove}
                        aria-label={`Remove filter ${tag.label}`}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortValue)}>
                <SelectTrigger className="w-[170px] shrink-0">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      Sort: {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeFilterTags.length > 0 && (
              <p className="-mt-2 text-xs text-muted-foreground">{filtered.length} clubs match your filters</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  isSubscribed={subscribed.has(club.id)}
                  onToggleSubscribed={() => toggleSubscribed(club.id)}
                  onViewProfile={() => setSelectedClub(club)}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-16 text-center">
                <p className="text-sm font-medium">No clubs match your filters</p>
                <p className="text-sm text-muted-foreground">Try widening your search or clearing a filter.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </TooltipProvider>
  )
}

function ClubCard({
  club,
  isSubscribed,
  onToggleSubscribed,
  onViewProfile,
}: {
  club: DiscoverClub
  isSubscribed: boolean
  onToggleSubscribed: () => void
  onViewProfile: () => void
}) {
  const { isApplied, applyToClub } = useApplicationState()
  const applied = isApplied(club.id)

  return (
    <Card className="group relative flex flex-col justify-between gap-4 overflow-hidden border-gray-200 bg-white shadow-none transition-all hover:border-neutral-400 hover:shadow-none">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggleSubscribed}
            aria-pressed={isSubscribed}
            aria-label={isSubscribed ? `Unsubscribe from ${club.name}` : `Subscribe to ${club.name}`}
            className={cn(
              "absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full border bg-white transition-colors hover:bg-accent",
              isSubscribed && "border-border bg-secondary text-foreground hover:bg-secondary",
            )}
          >
            <Star className={cn("size-4 text-foreground", isSubscribed && "fill-primary")} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Subscribe for deadline and status updates</TooltipContent>
      </Tooltip>

      <CardHeader className="flex flex-row items-center gap-3 pb-0">
        <ClubLogo clubId={club.id} logoUrl={club.logoUrl} text={club.logoText} color={club.color} size="lg" />
        <div className="min-w-0">
          <h3 className="font-sans text-xl font-semibold leading-tight tracking-tight text-foreground">{club.name}</h3>
          <Badge variant="secondary" className="mt-1.5 text-[10px] font-medium">
            {club.category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-0">
        <p className="text-sm leading-relaxed text-muted-foreground">{club.pitch}</p>
        <p className="mt-3 text-sm">
          <span className="font-semibold text-foreground">{club.acceptanceRate}%</span>{" "}
          <span className="text-muted-foreground">acceptance rate</span>
        </p>
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Button size="sm" variant="outline" className="flex-1" onClick={onViewProfile}>
          {applied ? "View Application" : "View Profile"}
        </Button>
        <Button
          size="sm"
          disabled={applied}
          className="flex-1 bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
          onClick={() =>
            applyToClub({ id: club.id, name: club.name, logoText: club.logoText, logoUrl: club.logoUrl, color: club.color })
          }
        >
          {applied ? "Applied" : "Apply Now"}
        </Button>
      </CardFooter>
    </Card>
  )
}

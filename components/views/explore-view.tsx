"use client"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/product/page-header"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Search, SlidersHorizontal, X, Compass, BookOpen, BriefcaseBusiness, Globe2, Heart, Mountain, Lightbulb, ChartNoAxesCombined, MessageSquare, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { CorkboardButton } from "@/components/clubs/corkboard-button"
import { DiscoveryCard } from "@/components/clubs/discovery-card"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import { discoverClubs } from "@/lib/data"
import { getClubDirectory } from "@/lib/workspace-api"
import { filterDirectory, emptyDirectoryFilters, directoryFiltersFromParams, directoryFilterParams, type DirectoryClub } from "@/lib/club-directory"
import { ClubProfileView } from "@/components/views/club-profile-view"
import type { ViewId } from "@/lib/views"
import { demoStore, demoDirectory } from "@/lib/demo/store"
import { useDemoMode } from "@/contexts/demo-context"
import { clubRecruitment } from "@/lib/recruitment-presentation"
import "@/components/clubs/club-discovery.css"
import "@/components/clubs/explore-directory.css"

function categoryIcon(category: string) {
  const value = category.toLowerCase()
  if (/academic|education/.test(value)) return BookOpen
  if (/professional|business|finance/.test(value)) return BriefcaseBusiness
  if (/cultur|international/.test(value)) return Globe2
  if (/service|volunteer/.test(value)) return Heart
  if (/recreat|sport|outdoor/.test(value)) return Mountain
  if (/entrepreneur|startup/.test(value)) return Lightbulb
  if (/consult/.test(value)) return ChartNoAxesCombined
  if (/market|communication/.test(value)) return MessageSquare
  return Users
}

export function ExploreView({ onNavigate, section = "explore" }: { onNavigate: (view: ViewId) => void; section?: "explore" | "categories" }) {
  const [clubs, setClubs] = useState<DirectoryClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const searchParams = useSearchParams()
  const filterQuery = searchParams.toString()
  const [filters, setFilters] = useState(() => directoryFiltersFromParams(searchParams))
  useEffect(() => { setFilters(directoryFiltersFromParams(new URLSearchParams(filterQuery))) }, [filterQuery])
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const [selected, setSelected] = useState<DirectoryClub | null>(() => demoStore.active() ? demoDirectory().find(c => [c.id, c.slug].includes(new URLSearchParams(window.location.search).get("demoClub") || "")) || null : null)
  const lastClub = useRef<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const { isDemoEnabled } = useDemoMode()

  useEffect(() => {
    let active = true
    setLoading(true)
    getClubDirectory()
      .then((result) => {
        if (!active) return
        
        setClubs(result.clubs || [])
        setError(result.error || "")
        setLoading(false)
      })
      .catch(() => {
        if (active) {
          setError("We couldn’t load the club directory. Please try again.")
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [retry, isDemoEnabled])
  useEffect(() => {
    if (!selected && lastClub.current) {
      resultsRef.current
        ?.querySelector<HTMLButtonElement>(`[data-directory-entry="${CSS.escape(lastClub.current)}"]`)
        ?.focus({ preventScroll: true })
    }
  }, [selected])
  useEffect(() => { setSelected(null) }, [section])
  const categories = useMemo(
    () => [...new Set(clubs.map((club) => club.category).filter(Boolean))].sort(),
    [clubs],
  )
  const filtered = useMemo(() => filterDirectory(clubs, filters, now), [clubs, filters, now])
  const active = Object.entries(filters).filter(
    ([key, value]) =>
      key !== "sort" && value !== emptyDirectoryFilters[key as keyof typeof filters],
  )
  const recruitmentCounts = useMemo(() => {
    const matches = filterDirectory(clubs, { ...filters, recruitment: "all" }, now)
    return { all: matches.length, open: matches.filter(club => clubRecruitment(club, now).available).length, closing: matches.filter(club => clubRecruitment(club, now).closingSoon).length }
  }, [clubs, filters, now])
  function updateFilters(next: typeof filters) {
    setFilters(next)
    const params = directoryFilterParams(new URLSearchParams(window.location.search), next)
    params.delete("section")
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`)
  }
  function change(key: keyof typeof filters, value: string) { updateFilters({ ...filters, [key]: value }) }
  function open(club: DirectoryClub, entry = club.id) {
    lastClub.current = entry
    setSelected(club)
  }
  const highlights = clubs.some(club => club.recommended)
    ? clubs.filter(club => club.recommended).slice(0, 3)
    : filterDirectory(clubs, emptyDirectoryFilters).slice(0, 3)
  const available = filterDirectory(clubs, emptyDirectoryFilters).filter(club => clubRecruitment(club, now).available)
  function card(club: DirectoryClub, section: string) {
    const entry = `${section}-${club.id}`
    return <DiscoveryCard key={club.id} club={club} now={now} entry={entry} onOpen={() => open(club, entry)} action={<CorkboardButton club={club} onNavigate={onNavigate} />} />
  }
  if (selected)
    return (
      <ClubProfileView club={selected} onBack={() => setSelected(null)} onNavigate={onNavigate} />
    )
  return (
    <div className="oc-discovery" data-explore-section={section} ref={resultsRef}>
      <div className="oc-explore-heading">
        <PageHeader eyebrow="University of Virginia" title="Discover clubs" description="Compare interests, recruitment dates, and what each club asks of you." illustration={{ variant: "rotunda", presentation: "compact" }} action={<Link href="/saved-clubs" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Saved clubs <ArrowRight size={15} className="ml-2" aria-hidden="true" /></Link>} />
      </div>
      <div className="oc-directory-search">
        <Search size={20} aria-hidden="true" />
        <Input
          aria-label="Search clubs"
          placeholder="Search clubs, interests, or keywords"
          value={filters.query}
          onChange={(event) => change("query", event.target.value)}
        />
        {filters.query && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            onClick={() => change("query", "")}
          >
            <X size={16} />
          </Button>
        )}
      </div>
      {!loading && !error && categories.length > 0 && (
        <section className="oc-directory-categories" aria-label="Browse categories">
          <button
            aria-pressed={filters.category === "all"}
            onClick={() => change("category", "all")}
          >
            <Users size={18} aria-hidden="true" />All interests <span>{clubs.length}</span>
          </button>
          {categories.map((category) => {
            const CategoryIcon = categoryIcon(category)
            return (
            <button
              key={category}
              aria-label={`${category}, ${clubs.filter(club => club.category === category).length} clubs`}
              aria-pressed={filters.category.toLowerCase() === category.toLowerCase()}
              onClick={() => change("category", filters.category.toLowerCase() === category.toLowerCase() ? "all" : category)}
            >
              <CategoryIcon size={18} aria-hidden="true" />{category}
              <span>{clubs.filter((club) => club.category === category).length}</span>
            </button>
          )})}
        </section>
      )}
      <div className="oc-directory-recruitment" role="group" aria-label="Recruitment availability">{[{ value: "all", label: "All clubs" }, { value: "open", label: "Applications open" }, { value: "closing", label: "Closing soon" }].map(option => <button type="button" key={option.value} aria-pressed={filters.recruitment === option.value} onClick={() => change("recruitment", option.value)}>{option.label}<span>{recruitmentCounts[option.value as keyof typeof recruitmentCounts]}</span></button>)}</div>
      <div className="oc-directory-tools">
        <details>

          <summary>
            <SlidersHorizontal size={15} />
            Refine search{active.length > 0 && <span>({active.length})</span>}
          </summary>
          <div className="oc-directory-filters">
            <label>Recruitment<select value={filters.recruitment} onChange={event => change("recruitment", event.target.value)}><option value="all">All recruitment</option><option value="open">Applications open</option><option value="closing">Closing in 7 days</option></select></label>
            <label>
              Time commitment
              <select value={filters.time} onChange={(event) => change("time", event.target.value)}>
                <option value="all">Any commitment</option>
                {["1-3", "3-5", "5+"]
                  .filter((time) => clubs.some((club) => club.timeCommitment === time))
                  .map((time) => (
                    <option key={time} value={time}>
                      {time} hours / week
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Club-reported acceptance
              <select
                value={filters.acceptance}
                onChange={(event) => change("acceptance", event.target.value)}
              >
                <option value="all">Any / not reported</option>
                {[5, 10, 25, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    Up to {value}%
                  </option>
                ))}
              </select>
            </label>
            <label>
              Club-reported fund size
              <select value={filters.aum} onChange={(event) => change("aum", event.target.value)}>
                <option value="all">Any / not reported</option>
                <option value="small">Up to $50,000</option>
                <option value="medium">$50,001–$250,000</option>
                <option value="large">Over $250,000</option>
              </select>
            </label>
          </div>
        </details>
        <label className="oc-directory-sort">
          Sort
          <select value={filters.sort} onChange={(event) => change("sort", event.target.value)}>
            <option value="name">Name A–Z</option>
            <option value="deadline">Next deadline</option>
            <option value="acceptance">Reported acceptance rate</option>
          </select>
        </label>
      </div>
      {active.length > 0 && (
        <div className="oc-directory-active">
          <span>Filters applied</span>
          {active.map(([key, value]) => (
            <button
              key={key}
              aria-label={`Remove ${key} filter`}
              onClick={() =>
                change(
                  key as keyof typeof filters,
                  emptyDirectoryFilters[key as keyof typeof filters],
                )
              }
            >
              {key === "query" ? `“${value}”` : key === "recruitment" ? value === "open" ? "Applications open" : "Closing in 7 days" : `${key}: ${value}`}
              <X size={12} />
            </button>
          ))}
          <button onClick={() => { updateFilters(emptyDirectoryFilters) }}>Clear all</button>
        </div>
      )}
      {loading ? (
        <div role="status" aria-label="Loading clubs"><span className="sr-only">Loading clubs…</span><div className="oc-explore-grid" aria-hidden="true">{[1, 2, 3].map(n => <Skeleton key={n} className="h-64 w-full rounded-xl" />)}</div></div>
      ) : error ? (
        <section className="oc-directory-empty" role="status">
          <h2>Let’s try that again.</h2>
          <p>{error}</p>
          <Button onClick={() => setRetry((value) => value + 1)}>Retry directory</Button>
          {discoverClubs.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setClubs(discoverClubs.map((club) => ({ ...club, source: "preview" })))
                setError("")
              }}
            >
              Browse sample clubs
            </Button>
          )}
        </section>
      ) : (
        <>
          {clubs.some(club => club.source === "preview") && <p className="oc-explore-sample" role="note">Sample directory · these profiles are a local preview. Applications are not connected.</p>}
          {!active.length && filters.sort === "name" && highlights.length > 0 && (
            <section className="oc-explore-section" aria-labelledby="curated-title">
              <div className="oc-explore-section-heading"><div><h2 id="curated-title">Worth getting to know</h2></div>
              <p>{clubs.some(club => club.recommended) ? "Clubs highlighted in the directory." : "An A–Z introduction to the directory."}</p></div>
              <ul className="oc-explore-grid">{highlights.map(club => card(club, "featured"))}</ul>
            </section>
          )}
          {!active.length && available.length > 0 && <details className="oc-explore-available"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Applications open · {available.length} clubs</summary>
            <p>An A–Z selection of clubs accepting applications. Check their profiles for requirements.</p>
            <ul>{available.slice(0, 6).map(club => <li key={club.id}><button data-directory-entry={`available-${club.id}`} onClick={() => open(club, `available-${club.id}`)}><DirectoryLogo club={club} /><span><strong>{club.name}</strong><small>Applications open</small></span><ArrowRight size={18} aria-hidden="true" /></button></li>)}</ul>
          </details>}
          <section aria-labelledby="directory-results-title">
            <div className="oc-directory-results-heading">
              <h2 id="directory-results-title">{active.length ? "Search results" : "All clubs"}</h2>
              <p role="status" aria-live="polite">
                {filtered.length} {filtered.length === 1 ? "club" : "clubs"}
              </p>
            </div>
            {filtered.length ? (
              <ul className="oc-explore-grid">{filtered.map(club => card(club, "results"))}</ul>
            ) : (
              <div className="oc-directory-empty">
                <Compass size={26} strokeWidth={1.5} />
                <h3>
                  {clubs.length
                    ? "No clubs match this search."
                    : "The directory is getting started."}
                </h3>
                <p>
                  {clubs.length
                    ? "Try a broader keyword or remove a filter."
                    : "Clubs will appear here as they join OutClass."}
                </p>
                {active.length > 0 && (
                  <Button variant="outline" onClick={() => { updateFilters(emptyDirectoryFilters) }}>
                    Clear search and filters
                  </Button>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

"use client"
import { SearchField } from "@/components/ui/search-field"
import { FilterPopover } from "@/components/ui/filter-popover"
import { FilterChips } from "@/components/ui/filter-chips"
import { PillSelect } from "@/components/ui/pill-select"
import { useSearchParams } from "next/navigation"
import { SavedClubsPopover } from "@/components/clubs/saved-clubs-popover"
import { PageHeader } from "@/components/ui/page-header"
import { ExploreSwitch } from "@/components/explore-switch"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, ChevronDown, SlidersHorizontal, X, Compass, BookOpen, BriefcaseBusiness, Globe2, Heart, Mountain, Lightbulb, ChartNoAxesCombined, MessageSquare, Users } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { CorkboardButton } from "@/components/clubs/corkboard-button"
import { DiscoveryCard } from "@/components/clubs/discovery-card"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import { SuggestedClubTiles } from "@/components/clubs/suggested-clubs"
import { useSuggestedClubs } from "@/hooks/use-suggested-clubs"
import { discoverClubs } from "@/lib/data"
import { searchPublicClubIds } from "@/actions/typesense-search"
import { getClubDirectory, getPublicClub } from "@/lib/workspace-api"
import { filterDirectory, emptyDirectoryFilters, directoryFiltersFromParams, directoryFilterParams, type DirectoryClub } from "@/lib/club-directory"
import { ClubProfileView } from "@/components/views/club-profile-view"
import type { ViewId } from "@/lib/views"
import { isDemoActive, loadedDemoStore } from "@/lib/demo/loader"
import { useDemoMode } from "@/contexts/demo-context"
import { clubRecruitment } from "@/lib/recruitment-presentation"
import { useServerAnchoredNow } from "@/hooks/use-server-now"
import "@/components/clubs/club-discovery.css"
import "@/components/clubs/explore-directory.css"

const recruitmentOptions = [
  { value: "all", label: "All clubs" },
  { value: "open", label: "Applications open" },
  { value: "closed", label: "Not currently open" },
  { value: "closing", label: "Closing in 7 days" },
] as const
const PRIMARY_CATEGORIES = 5

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

export type ExploreDirectory = { clubs: DirectoryClub[]; error?: string }

export function ExploreView({ onNavigate, section = "explore", initialDirectory, serverNow, onInitialDirectoryUsed }: {
  onNavigate: (view: ViewId) => void
  section?: "explore" | "categories"
  /** The public directory read on the server for a direct /explore load; later mounts read it here. */
  initialDirectory?: ExploreDirectory
  /** Server render time for the seeded list, so recruitment state matches the server HTML. */
  serverNow?: number
  onInitialDirectoryUsed?: () => void
}) {
  const [clubs, setClubs] = useState<DirectoryClub[]>(() => initialDirectory?.clubs ?? [])
  const [loading, setLoading] = useState(!initialDirectory)
  const [error, setError] = useState(initialDirectory?.error ?? "")
  const seeded = useRef(!!initialDirectory)
  const [retry, setRetry] = useState(0)
  const searchParams = useSearchParams()
  const filterQuery = searchParams.toString()
  const [filters, setFilters] = useState(() => directoryFiltersFromParams(searchParams))
  useEffect(() => { setFilters(directoryFiltersFromParams(new URLSearchParams(filterQuery))) }, [filterQuery])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has("aum")) { url.searchParams.delete("aum"); window.history.replaceState(null, "", url.pathname + url.search + url.hash) }
  }, [filterQuery])
  const [searchMatches, setSearchMatches] = useState<{ query: string; ids: string[] } | null>(null)
  const now = useServerAnchoredNow(serverNow)
  // Phones, as in the app: Availability, Sort and Refine sit behind a Filter button beside search.
  const [phoneFilters, setPhoneFilters] = useState(false)
  const [selected, setSelected] = useState<DirectoryClub | null>(() => isDemoActive() ? loadedDemoStore().demoDirectory().find(c => [c.id, c.slug].includes(new URLSearchParams(window.location.search).get("demoClub") || "")) || null : null)
  // The directory list carries summary data; the full profile loads on open.
  const [profile, setProfile] = useState<{ id: string; club: DirectoryClub | null } | null>(null)
  useEffect(() => {
    if (!selected || isDemoActive()) return
    let current = true
    getPublicClub(selected.id)
      .then(result => { if (current) setProfile({ id: selected.id, club: result.club }) })
      .catch(() => { if (current) setProfile({ id: selected.id, club: null }) })
    return () => { current = false }
  }, [selected])
  const lastClub = useRef<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const { isDemoEnabled } = useDemoMode()

  useEffect(() => {
    // A server-seeded first mount skips one identical read; retry and Demo changes still read live.
    if (seeded.current) { seeded.current = false; onInitialDirectoryUsed?.(); return }
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
    // onInitialDirectoryUsed is a seed hand-off, not a reason to read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Five chips fit one row at a glance; the long tail of one-club categories lives under More.
  const categoryCount = (category: string) => clubs.filter((club) => club.category === category).length
  const selectedCategory = filters.category === "all" ? "all" : categories.find((category) => category.toLowerCase() === filters.category.toLowerCase()) ?? filters.category
  const rankedCategories = [...categories].sort((a, b) => categoryCount(b) - categoryCount(a) || a.localeCompare(b, "en-US"))
  const primaryCategories = rankedCategories.slice(0, PRIMARY_CATEGORIES)
  if (selectedCategory !== "all" && categories.includes(selectedCategory) && !primaryCategories.includes(selectedCategory)) primaryCategories.push(selectedCategory)
  const moreCategories = rankedCategories.filter((category) => !primaryCategories.includes(category))
  const { suggestions } = useSuggestedClubs(loading || error ? null : clubs)
  // Typesense is an optional relevance/typo index, never an authority on visibility.
  // Cross-check every ID against the current public directory before rendering.
  useEffect(() => {
    const query = filters.query.trim()
    if (query.length < 2 || isDemoEnabled) { setSearchMatches(null); return }
    let live = true
    const timer = window.setTimeout(() => {
      searchPublicClubIds(query).then(ids => {
        if (live) setSearchMatches(ids === null ? null : { query, ids })
      }).catch(() => { if (live) setSearchMatches(null) })
    }, 180)
    return () => { live = false; window.clearTimeout(timer) }
  }, [filters.query, isDemoEnabled])
  const filtered = useMemo(() => {
    const match = searchMatches?.query === filters.query.trim() ? searchMatches : null
    if (!match) return filterDirectory(clubs, filters, now)
    const visible = new Set(match.ids)
    const matches = filterDirectory(clubs.filter(club => visible.has(club.id)), { ...filters, query: "" }, now)
    return filters.sort === "name" ? matches.sort((a, b) => match.ids.indexOf(a.id) - match.ids.indexOf(b.id)) : matches
  }, [clubs, filters, now, searchMatches])
  const active = Object.entries(filters).filter(
    ([key, value]) =>
      key !== "sort" && value !== emptyDirectoryFilters[key as keyof typeof filters],
  )
  // Only the fields inside the Refine search panel; the row's own selects show their value.
  const timeOptions = ["1-3", "3-5", "5+"].filter((time) => clubs.some((club) => club.timeCommitment === time))
  const acceptanceReported = clubs.filter((club) => club.acceptanceRate != null).length >= 3
  const refined = [filters.recruitment !== emptyDirectoryFilters.recruitment, filters.time !== emptyDirectoryFilters.time, filters.acceptance !== emptyDirectoryFilters.acceptance].filter(Boolean).length
  const phoneActive = refined + Number(filters.sort !== emptyDirectoryFilters.sort)
  const recruitmentCounts = useMemo(() => {
    const matches = filterDirectory(clubs, { ...filters, recruitment: "all" }, now)
    return { all: matches.length, open: matches.filter(club => clubRecruitment(club, now).available).length, closed: matches.filter(club => !clubRecruitment(club, now).available).length, closing: matches.filter(club => clubRecruitment(club, now).closingSoon).length }
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
  const featured = clubs.filter(club => club.recommended).slice(0, 3)
  const available = filterDirectory(clubs, emptyDirectoryFilters, now).filter(club => clubRecruitment(club, now).available)
  function card(club: DirectoryClub, section: string) {
    const entry = `${section}-${club.id}`
    return <DiscoveryCard key={club.id} club={club} now={now} entry={entry} onOpen={() => open(club, entry)} action={<CorkboardButton club={club} onNavigate={onNavigate} />} />
  }
  if (selected) {
    // Demo data is already complete. If the full profile cannot load, show the
    // listed summary rather than nothing.
    const loaded = isDemoActive() ? selected : profile?.id === selected.id ? profile.club ?? selected : null
    return loaded
      ? <ClubProfileView club={loaded} onBack={() => setSelected(null)} onNavigate={onNavigate} />
      : <LoadingState label="Loading club profile…" layout="workspace" rows={3} />
  }
  return (
    <div className="oc-discovery" data-explore-section={section} ref={resultsRef}>
      <ExploreSwitch current="clubs" />
      <div className="oc-explore-heading">
        <PageHeader density="compact" title="Explore clubs" action={<SavedClubsPopover onNavigate={onNavigate} />} />
      </div>
      {/* Desktop: search, Refine, Availability and Sort share one row. Phones keep them behind Filter. */}
      <div className="oc-directory-bar">
      <div className="oc-directory-search">
        <SearchField
          aria-label="Search clubs"
          placeholder="Search clubs, interests, or keywords"
          value={filters.query}
          onChange={(event) => change("query", event.target.value)}
          onClear={() => change("query", "")}
          containerClassName="oc-directory-search-field"
        />
        <IconButton className="oc-directory-filter-toggle" aria-label={phoneActive ? `Filter clubs (${phoneActive} active)` : "Filter clubs"} aria-expanded={phoneFilters} aria-controls="directory-tools" onClick={() => setPhoneFilters(open => !open)}>
          <SlidersHorizontal size={20} aria-hidden="true" />{phoneActive > 0 && <span className="oc-directory-filter-count" aria-hidden="true">{phoneActive}</span>}
        </IconButton>
      </div>
      <div id="directory-tools" className="oc-directory-tools oc-toolbar" data-phone-open={phoneFilters || undefined}>
        {/* Filters with fewer than two real options are hidden; acceptance needs at least three clubs reporting a rate. */}
        <FilterPopover title="Filter clubs" count={refined} align="start">
            <div className="oc-filter-field"><span className="oc-filter-field-label">Availability</span>
              <PillSelect label="Availability" size="compact" active={filters.recruitment !== emptyDirectoryFilters.recruitment} describedBy="directory-availability-note" value={filters.recruitment} onChange={(value) => change("recruitment", value)}
                options={recruitmentOptions.map(option => ({ value: option.value, label: `${option.label} (${recruitmentCounts[option.value]})` }))} />
            </div>
            {/* Filters with fewer than two real options are hidden; acceptance needs at least three clubs reporting a rate. */}
            {timeOptions.length >= 2 && <div className="oc-filter-field"><span className="oc-filter-field-label">Time commitment</span>
              <PillSelect label="Time commitment" size="compact" active={filters.time !== emptyDirectoryFilters.time} value={filters.time} onChange={(value) => change("time", value)}
                options={[{ value: "all", label: "Any commitment" }, ...timeOptions.map((time) => ({ value: time, label: `${time} hours / week` }))]} />
            </div>}
            {acceptanceReported && <div className="oc-filter-field"><span className="oc-filter-field-label">Club-reported acceptance</span>
              <PillSelect label="Club-reported acceptance" size="compact" active={filters.acceptance !== emptyDirectoryFilters.acceptance} value={filters.acceptance} onChange={(value) => change("acceptance", value)}
                options={[{ value: "all", label: "Any / not reported" }, ...[5, 10, 25, 50, 100].map((value) => ({ value: String(value), label: `Up to ${value}%` }))]} />
            </div>}
        </FilterPopover>
        <PillSelect label="Sort" prefix="Sort" active={filters.sort !== emptyDirectoryFilters.sort} className="oc-directory-sort" value={filters.sort} onChange={(value) => change("sort", value)}
          options={[{ value: "name", label: "Name A–Z" }, { value: "deadline", label: "Next deadline" }, ...(acceptanceReported ? [{ value: "acceptance", label: "Reported acceptance rate" }] : [])]} />
      </div>
      </div>
      {!loading && !error && categories.length > 0 && (
        <div className="oc-directory-category-row">
          {/* Interests beyond the ranked first few sit behind an inline "+N" chip (formerly the More interests menu). */}
          <FilterChips
            label="Browse categories"
            className="oc-directory-categories"
            visible={primaryCategories.length + 1}
            moreLabel={(n) => `+${n} more interests`}
            value={selectedCategory}
            // Choosing the selected category again returns to all interests, as before.
            onChange={(value) => change("category", value !== "all" && value.toLowerCase() === filters.category.toLowerCase() ? "all" : value)}
            options={[
              { value: "all", label: "All", count: clubs.length, icon: <Users size={16} weight={filters.category === "all" ? "fill" : "regular"} /> },
              ...[...primaryCategories, ...moreCategories].map((category) => {
                const CategoryIcon = categoryIcon(category)
                return { value: category, label: category, count: categoryCount(category), icon: <CategoryIcon size={16} weight={filters.category.toLowerCase() === category.toLowerCase() ? "fill" : "regular"} /> }
              }),
            ]}
          />
        </div>
      )}
      {active.length > 0 && (
        <div className="oc-directory-active">
          <span>Filters applied</span>
          {active.map(([key, value]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              aria-label={`Remove ${key} filter`}
              onClick={() =>
                change(
                  key as keyof typeof filters,
                  emptyDirectoryFilters[key as keyof typeof filters],
                )
              }
            >
              {key === "query" ? `“${value}”` : key === "recruitment" ? value === "open" ? "Applications open" : value === "closed" ? "Not currently open" : "Closing in 7 days" : `${key}: ${value}`}
              <X size={14} />
            </Button>
          ))}
          <Button type="button" variant="link" size="sm" className="min-h-11" onClick={() => { updateFilters(emptyDirectoryFilters) }}>Clear all</Button>
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading clubs…" layout="cards" rows={3} />
      ) : error ? (
        <section className="oc-directory-empty" role="status">
          <h2>Let’s try that again.</h2>
          <p>{error}</p>
          <Button onClick={() => setRetry((value) => value + 1)}>Retry directory</Button>
          {isDemoEnabled && discoverClubs.length > 0 && (
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
          {clubs.some(club => club.source === "preview") && <p className="oc-explore-sample" role="note">Demo directory · fictional profiles for testing only. No real applications are submitted.</p>}
          {!active.length && suggestions.length > 0 && (
            <section className="oc-explore-section oc-explore-suggested" aria-labelledby="suggested-title">
              <div className="oc-explore-section-heading"><div><h2 id="suggested-title">Suggested for you</h2></div>
              <p>Based on the clubs you saved and your major.</p></div>
              <SuggestedClubTiles suggestions={suggestions} onOpen={open} />
            </section>
          )}
          {/* Only clubs the directory actually highlights; an alphabetical slice would repeat "All clubs" below. */}
          {!active.length && filters.sort === "name" && featured.length > 0 && (
            <section className="oc-explore-section" aria-labelledby="curated-title">
              <div className="oc-explore-section-heading"><div><h2 id="curated-title">Featured clubs</h2></div>
              <p>Clubs highlighted in the directory.</p></div>
              <ul className="oc-explore-grid">{featured.map(club => card(club, "featured"))}</ul>
            </section>
          )}
          {!active.length && available.length > 0 && <details className="oc-explore-available group"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"><ChevronDown aria-hidden="true" className="size-4 shrink-0 -rotate-90 transition-transform duration-150 group-open:rotate-0 motion-reduce:transition-none" />Applications open · {available.length} clubs</summary>
            <p>An A–Z selection of clubs accepting applications. Check their profiles for requirements.</p>
            <ul>{available.slice(0, 6).map(club => <li key={club.id}><button data-directory-entry={`available-${club.id}`} onClick={() => open(club, `available-${club.id}`)}><DirectoryLogo club={club} /><span><strong>{club.name}</strong><small>Applications open</small></span><ArrowRight size={16} aria-hidden="true" /></button></li>)}</ul>
          </details>}
          <p id="directory-availability-note" className={filters.recruitment === "all" ? "sr-only" : "oc-explore-directory-note"}>Availability reflects applications on OutClass. Check each club’s website for external recruitment.</p>
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
              <EmptyState density="compact" tone="subtle" icon={<Compass />} title={clubs.length ? "No clubs match this search." : "No clubs available yet."} description={clubs.length ? "No club fits the current keyword or filters." : "No club profiles are published at your school yet."} action={active.length > 0 ? <Button variant="outline" onClick={() => updateFilters(emptyDirectoryFilters)}>Clear search and filters</Button> : <Button variant="outline" onClick={() => onNavigate("corkboard")}>See campus events</Button>} />
            )}
          </section>
        </>
      )}
    </div>
  )
}

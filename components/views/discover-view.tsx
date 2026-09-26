"use client"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Search, SlidersHorizontal, X, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import { discoverClubs } from "@/lib/data"
import { getClubDirectory } from "@/lib/workspace-api"
import { filterDirectory, emptyDirectoryFilters, type DirectoryClub } from "@/lib/club-directory"
import { ClubProfileView } from "@/components/views/club-profile-view"
import type { ViewId } from "@/lib/views"
import { demoStore, demoDirectory } from "@/lib/demo/store"
import { useDemoMode } from "@/contexts/demo-context"
import "@/components/clubs/club-discovery.css"
import "@/components/clubs/explore-directory.css"

export function DiscoverView({ onNavigate, categoriesOnly = false }: { onNavigate: (view: ViewId) => void; categoriesOnly?: boolean }) {
  const [clubs, setClubs] = useState<DirectoryClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [filters, setFilters] = useState(emptyDirectoryFilters)
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
  const previousCategoryMode = useRef(categoriesOnly)
  useEffect(() => { if (previousCategoryMode.current !== categoriesOnly) { setSelected(null); setFilters(emptyDirectoryFilters); previousCategoryMode.current = categoriesOnly } }, [categoriesOnly])
  const categories = useMemo(
    () => [...new Set(clubs.map((club) => club.category).filter(Boolean))].sort(),
    [clubs],
  )
  const filtered = useMemo(() => filterDirectory(clubs, filters), [clubs, filters])
  const active = Object.entries(filters).filter(
    ([key, value]) =>
      key !== "sort" && value !== emptyDirectoryFilters[key as keyof typeof filters],
  )
  function change(key: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }))
  }
  function open(club: DirectoryClub, entry = club.id) {
    lastClub.current = entry
    setSelected(club)
  }
  const highlights = clubs.some(club => club.recommended)
    ? clubs.filter(club => club.recommended).slice(0, 3)
    : filterDirectory(clubs, emptyDirectoryFilters).slice(0, 3)
  const available = filterDirectory(clubs, emptyDirectoryFilters).filter(club => club.source !== "preview" && club.applicationAvailable === true)
  function card(club: DirectoryClub, section: string) {
    const entry = `${section}-${club.id}`
    return <li key={club.id} className="oc-explore-card">
      <article>
        <div className="oc-explore-card-identity"><DirectoryLogo club={club} size="lg" /><span className="oc-explore-category">{club.category || "Student organization"}</span></div>
        <h3><button data-club-id={club.id} data-directory-entry={entry} onClick={() => open(club, entry)}>{club.name}</button></h3>
        <p className="oc-explore-pitch">{club.pitch || club.description || "Get to know this club and explore its profile."}</p>
        <div className="oc-explore-card-footer">
          <span>{club.source === "preview" ? "Sample club" : club.applicationAvailable === true ? "Application available" : club.claimed === false ? "Unclaimed profile" : "Explore club"}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </div>
      </article>
    </li>
  }
  if (selected)
    return (
      <ClubProfileView club={selected} onBack={() => setSelected(null)} onNavigate={onNavigate} />
    )
  return (
    <div className="oc-discovery" ref={resultsRef}>
      <header className="oc-explore-heading">
        <div><p className="oc-club-eyebrow">Explore · University of Virginia</p>
        <h1>{categoriesOnly ? "Follow your interests." : "Find your people."}</h1>
      <p className="oc-directory-intro">
        {categoriesOnly ? "Choose an interest to browse the club directory by category." : "Find a club by name, or follow your interests somewhere new."}
      </p></div>
        <Image src="/images/campus/rotunda-960.webp" alt="" width="180" height="110" className="oc-explore-campus" />
      </header>
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
            All interests <span>{clubs.length}</span>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              aria-label={`${category}, ${clubs.filter(club => club.category === category).length} clubs`}
              aria-pressed={filters.category === category}
              onClick={() => change("category", filters.category === category ? "all" : category)}
            >
              {category}
              <span>{clubs.filter((club) => club.category === category).length}</span>
            </button>
          ))}
        </section>
      )}
      <div className="oc-directory-tools">
        <details>
          <summary>
            <SlidersHorizontal size={15} />
            Refine search{active.length > 0 && <span>({active.length})</span>}
          </summary>
          <div className="oc-directory-filters">
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
              {key === "query" ? `“${value}”` : `${key}: ${value}`}
              <X size={12} />
            </button>
          ))}
          <button onClick={() => setFilters(emptyDirectoryFilters)}>Clear all</button>
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
          {!active.length && !categoriesOnly && highlights.length > 0 && (
            <section className="oc-explore-section" aria-labelledby="curated-title">
              <div className="oc-explore-section-heading"><div><p className="oc-club-eyebrow">From the directory</p><h2 id="curated-title">A few places to start.</h2></div>
              <p>{clubs.some(club => club.recommended) ? "Clubs highlighted in the directory." : "An alphabetical introduction to the directory."}</p></div>
              <ul className="oc-explore-grid">{highlights.map(club => card(club, "featured"))}</ul>
            </section>
          )}
          {!active.length && !categoriesOnly && available.length > 0 && <section className="oc-explore-available" aria-labelledby="available-title">
            <div><h2 id="available-title">Applications on OutClass</h2><p>An A–Z selection of clubs with applications available. Check their profiles for recruitment details.</p></div>
            <ul>{available.slice(0, 6).map(club => <li key={club.id}><button data-directory-entry={`available-${club.id}`} onClick={() => open(club, `available-${club.id}`)}>{club.name}<ArrowRight size={14} aria-hidden="true" /></button></li>)}</ul>
          </section>}
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
                  <Button variant="outline" onClick={() => setFilters(emptyDirectoryFilters)}>
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

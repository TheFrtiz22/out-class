import Link from "next/link"
import { ArrowRight, Search } from "@/components/icons"
import { ClubLogo } from "@/components/club-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelectField } from "@/components/ui/native-select"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import type { PublicExploreClub } from "@/lib/public-explore"
import { recruitmentDate } from "@/lib/recruitment-presentation"
import "./public-explore.css"

const signIn = (clubId: string) => `/login?next=${encodeURIComponent(`/club/${clubId}`)}`

/** Signed-out Explore: public, claimed, active clubs. Apply and Follow ask for sign-in and return to the club. */
export function PublicExplore({ results, categories, category, query, total, error }: {
  results: PublicExploreClub[]; categories: string[]; category: string; query: string; total: number; error?: string
}) {
  const filtered = !!query || category !== "all"
  return <PublicInformationPage className="oc-public-explore" eyebrow="Explore" title="Clubs at UVA" introduction="Browse clubs on OutClass. Sign in to apply or to follow a club.">
    <section className="oc-public-section" aria-labelledby="explore-results">
      <form className="oc-public-explore-search" action="/explore" method="get" role="search" aria-label="Search clubs">
        <label className="oc-public-explore-field">
          <span>Search</span>
          <span className="oc-public-explore-input"><Search size={18} aria-hidden="true" /><Input type="search" name="q" defaultValue={query} maxLength={100} placeholder="Club name, interest or firm" /></span>
        </label>
        <label className="oc-public-explore-field">
          <span>Category</span>
          <NativeSelectField name="category" defaultValue={category}>
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </NativeSelectField>
        </label>
        <Button type="submit">Search</Button>
      </form>
      <h2 id="explore-results" className="oc-public-explore-count" aria-live="polite">
        {error ? "Clubs couldn’t load" : filtered ? `${results.length} of ${total} clubs` : `${total} clubs`}
      </h2>
      {error ? <p className="oc-public-explore-empty">{error} <a href="/explore">Try again</a></p>
        : results.length === 0 ? <p className="oc-public-explore-empty">{filtered ? <>No clubs match this search. <a href="/explore">Show all clubs</a></> : "No clubs are listed yet."}</p>
        : <ul className="oc-public-explore-grid">{results.map(club => <li key={club.id}>
            <article className="oc-public-explore-card" aria-labelledby={`club-${club.id}`}>
              <div className="oc-public-explore-card-head">
                <ClubLogo text={club.logoText} color={club.color} logoUrl={club.logoUrl} marketing={club.logo} size="md" alt="" />
                <div className="min-w-0">
                  <h3 id={`club-${club.id}`}><Link prefetch={false} href={`/club/${encodeURIComponent(club.id)}`}>{club.name}</Link></h3>
                  {club.category && <p className="oc-public-explore-category">{club.category}</p>}
                </div>
              </div>
              {club.pitch && <p className="oc-public-explore-pitch">{club.pitch}</p>}
              <p className="oc-public-explore-status">{club.applicationsOpen ? club.deadline ? `Applications open · closes ${recruitmentDate(club.deadline)}` : "Applications open" : "Applications aren’t open yet"}</p>
              <div className="oc-public-explore-actions">
                {club.applicationsOpen && <Button asChild size="sm"><Link prefetch={false} href={signIn(club.id)}>Sign in to apply<span className="sr-only"> to {club.name}</span><ArrowRight size={16} aria-hidden="true" /></Link></Button>}
                <Button asChild size="sm" variant="outline"><Link prefetch={false} href={signIn(club.id)}>Follow<span className="sr-only"> {club.name} (sign in)</span></Link></Button>
              </div>
            </article>
          </li>)}</ul>}
    </section>
  </PublicInformationPage>
}

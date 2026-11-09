/* Isolated student-screens fixture: the real ProductShell with Explore, a club page and Events on
   fictional data (state.jsx). Local only; no sessions, server actions or production data. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ProductShell } from '@/components/shell/product-shell'
import { ExploreView } from '@/components/views/explore-view'
import { ClubProfileView } from '@/components/views/club-profile-view'
import { CorkboardView } from '@/components/views/corkboard-view'
import { personalRailSections } from '@/lib/navigation'
import { FixtureBoundary, fixtureClubs } from './state'

function Screens() {
  const page = new URLSearchParams(location.search).get('page') || 'explore'
  const active = page === 'corkboard' ? 'corkboard' : 'explore'
  const body = page === 'club' ? <ClubProfileView club={fixtureClubs[0]} onBack={() => {}} onNavigate={() => {}} />
    : page === 'corkboard' ? <CorkboardView /> : <ExploreView onNavigate={() => {}} />
  return <ProductShell sections={personalRailSections()} mode="explore" active={active} title={page === 'corkboard' ? 'Events' : 'Explore'} onSelect={() => {}} onNavigate={() => {}}>{body}</ProductShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><Screens /></FixtureBoundary>)

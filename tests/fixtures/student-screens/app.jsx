/* Isolated student-screens fixture: the real ProductShell with Explore, a club page and Events on
   fictional data (state.jsx). Local only; no sessions, server actions or production data. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ProductShell } from '@/components/shell/product-shell'
import { ExploreView } from '@/components/views/explore-view'
import { ClubProfileView } from '@/components/views/club-profile-view'
import { CorkboardView } from '@/components/views/corkboard-view'
import { InboxView } from '@/components/views/inbox-view'
import { CalendarView } from '@/components/views/calendar-view'
import { UnifiedStudentProfileView } from '@/components/views/unified-student-profile-view'
import { personalRailSections } from '@/lib/navigation'
import { FixtureBoundary, fixtureClubs } from './state'

function Screens() {
  const page = new URLSearchParams(location.search).get('page') || 'explore'
  const screens = {
    explore: ['explore', 'Explore', <ExploreView onNavigate={() => {}} />],
    club: ['explore', 'Explore', <ClubProfileView club={fixtureClubs[0]} onBack={() => {}} onNavigate={() => {}} />],
    corkboard: ['corkboard', 'Events', <CorkboardView />],
    inbox: ['inbox', 'Inbox', <InboxView onNavigate={() => {}} />],
    calendar: ['calendar', 'Calendar', <CalendarView onNavigate={() => {}} />],
    profile: ['student-profile', 'Profile', <UnifiedStudentProfileView />],
  }
  const [active, title, body] = screens[page] || screens.explore
  return <ProductShell sections={personalRailSections()} mode="explore" active={active} title={title} onSelect={() => {}} onNavigate={() => {}}>{body}</ProductShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><Screens /></FixtureBoundary>)

/* Isolated dashboards fixture: the real ProductShell with Personal Home and Recruiting Overview on
   fictional data (state.jsx, ../club-home/data.cjs). Local only; no sessions, server actions or production data. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { ProductShell } from '@/components/shell/product-shell'
import { StudentDashboardView } from '@/components/views/student-dashboard-view'
import { RecruitingOverview } from '@/components/recruiting-overview'
import { ClubOverviewHeader } from '@/components/product/welcome-header'
import { personalRailSections, leaderRailSections } from '@/lib/navigation'
import { FixtureBoundary, useAuth, clubs } from '../floating-header/boundaries'
import { overview } from '../club-home/data.cjs'

const params = () => new URLSearchParams(location.search)
function recruitingData(member) {
  const dto = { id: member.id, isOwner: member.isOwner, permissions: member.permissions, interviewOffices: member.interviewOffices, status: member.status }
  const kind = params().get('fixture') || 'large'
  const data = overview(kind, member.club, dto)
  if (kind !== 'large') return data
  const now = Date.now(), at = h => new Date(now + h * 3600000).toISOString()
  return { ...data, operations: { ...data.operations,
    queue: ['4F8A', '9C1D', '2B7E'].map((code, i) => ({ id: `queue-${i}`, label: `Applicant ${code}`, round: 'Written review', anonymous: true })),
    offers: [{ id: 'offer-1', applicationId: 'app-offer-1', label: 'Jordan Avery', expiresAt: at(50) }],
    scheduled: [{ id: 'scheduled-1', kind: 'DECISION', scheduledAt: at(96) }] } }
}
function Dashboards() {
  const { user } = useAuth(), page = params().get('page') || 'home'
  if (page === 'recruiting') {
    const member = user.memberships[0], data = recruitingData(member)
    return <ProductShell manager sections={leaderRailSections(member, clubs[0].id, 'mode=recruiting')} mode="recruiting" active="overview" clubId={clubs[0].id} clubName={member.club.name} title="Overview" onSelect={() => {}} onNavigate={() => {}}>
      <ClubOverviewHeader density="expressive" clubName={data.club.name} context={{ mode: 'club', clubId: clubs[0].id, membership: member, data }} />
      <RecruitingOverview data={data} />
    </ProductShell>
  }
  return <ProductShell sections={personalRailSections()} mode="explore" active="student-dashboard" clubId="" clubName={user.memberships[0].club.name} title="Home" onSelect={() => {}} onNavigate={() => {}}>
    <StudentDashboardView authenticated initialData={params().get('scenario') === 'error' ? null : { applications: [] }} onNavigate={view => { window.fixtureNavigations = [...(window.fixtureNavigations || []), view] }} />
  </ProductShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><ConfirmProvider><Dashboards /></ConfirmProvider></FixtureBoundary>)

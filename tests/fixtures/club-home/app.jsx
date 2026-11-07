/* Isolated Club home: the real ProductShell, greeting and dashboard with fictional overviews.
   No sessions, server actions, databases or production data. */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ProductShell } from '@/components/shell/product-shell'
import { ClubHomeActions } from '@/components/club-home/club-home-actions'
import { ClubOverviewHeader } from '@/components/product/welcome-header'
import { ManagerOverview } from '@/components/manager-overview'
import { leaderRailSections, memberRailSections } from '@/lib/navigation'
import { FixtureBoundary, useAuth, clubs } from '../floating-header/boundaries'
import { useSearchParams, usePathname } from '../floating-header/navigation'
import { overview } from './data.cjs'

function ClubHomeFixture() {
  const params = useSearchParams(), path = usePathname(), { user, role } = useAuth()
  const clubId = path.match(/\/club\/([^/]+)/)?.[1] || clubs[0].id
  const member = user.memberships.find(item => item.clubId === clubId) || user.memberships[0]
  const manager = !['student', 'member'].includes(role)
  const kind = params.get('fixture') || 'large'
  const [refreshes, setRefreshes] = useState(0)
  const dto = { id: member.id, isOwner: member.isOwner, permissions: member.permissions, interviewOffices: member.interviewOffices, status: member.status }
  const data = overview(kind, kind === 'small' ? { id: clubId, name: 'Campus Chess Club' } : member.club, dto)
  const name = data.club.name
  return <ProductShell manager={manager} sections={manager ? leaderRailSections(member, clubId, params.toString()) : memberRailSections(clubId, name)} mode={manager ? 'club' : 'clubs'} active="overview" clubId={clubId} clubName={name} title="Club home" onSelect={() => {}} onNavigate={() => {}}>
    {/* Same composition as components/club-workspace.tsx for section=overview. */}
    <div className="oc-club-home-hero"><div className="oc-club-home-ambient" aria-hidden="true" /><ClubOverviewHeader className="oc-club-home-greeting" density="expressive" eyebrow={data.operations.cycles[0]?.name} clubName={name} context={{ mode: 'club', clubId, membership: member, data }} action={<ClubHomeActions clubId={clubId} membership={member} />} /></div>
    <section className="shell-content-enter" aria-label="Club home" data-refreshes={refreshes}>
      <ManagerOverview data={data} onChanged={() => setRefreshes(n => n + 1)} />
    </section>
  </ProductShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><ClubHomeFixture /></FixtureBoundary>)

/* Isolated spacing fixture: the real ProductShell and PageHeader in each density, with the real page
   wrapper classes, so the gap between the header and the first title can be measured on every layout.
   Fictional content only; no sessions or data. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { ProductShell } from '@/components/shell/product-shell'
import { PageHeader } from '@/components/ui/page-header'
import { Panel } from '@/components/ui/panel'
import { leaderRailSections, personalRailSections, adminRailSections } from '@/lib/navigation'
import { FixtureBoundary, useAuth, clubs } from '../floating-header/boundaries'
import { useSearchParams } from '../floating-header/navigation'

const layouts = {
  home: { density: 'expressive', eyebrow: 'Friday, November 7', title: 'Good evening, Avery.', wrapper: '' },
  explore: { density: 'editorial', eyebrow: 'Explore', title: 'Find your people.', wrapper: '' },
  applications: { density: 'compact', title: 'Applications', wrapper: 'oc-applications max-w-[var(--oc-content-width)] space-y-5' },
  applicants: { density: 'compact', eyebrow: 'McIntire Investment Institute', title: 'All Applicants', wrapper: '' },
  meetings: { density: 'compact', eyebrow: 'McIntire Investment Institute', title: 'Meetings', wrapper: 'max-w-[var(--oc-content-width)] space-y-8' },
  settings: { density: 'compact', title: 'Settings', wrapper: 'max-w-[var(--oc-reading-width)] space-y-5' },
  admin: { density: 'expressive', eyebrow: 'Platform', title: 'Overview', wrapper: 'max-w-[var(--oc-content-width)] oc-workspace-stack oc-admin-workspace' },
}
function SpacingFixture() {
  const params = useSearchParams(), { user, role } = useAuth()
  const page = layouts[params.get('page') || 'applications'] || layouts.applications
  const member = user.memberships[0], clubId = clubs[0].id
  const leader = ['applicants', 'meetings'].includes(params.get('page')), admin = params.get('page') === 'admin'
  const sections = admin ? adminRailSections() : leader ? leaderRailSections(member, clubId, '') : personalRailSections()
  return <ProductShell manager={leader || admin} workspaceKind={admin ? 'admin' : undefined} sections={sections} mode={leader ? 'club' : 'explore'} active={leader ? 'meetings' : 'student-dashboard'} clubId={leader ? clubId : ''} clubName={member.club.name} title={page.title} onSelect={() => {}} onNavigate={() => {}}>
    <div className={page.wrapper} data-fixture-page={params.get('page')}>
      <PageHeader density={page.density} eyebrow={page.eyebrow} title={page.title} description="Fictional fixture content for spacing measurements." />
      <Panel as="section" aria-label="First section"><h2 className="oc-section-heading">First section</h2><p>Rows and cards start here.</p></Panel>
      <div style={{ minHeight: 1400 }} />
    </div>
  </ProductShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><ConfirmProvider><SpacingFixture /></ConfirmProvider></FixtureBoundary>)

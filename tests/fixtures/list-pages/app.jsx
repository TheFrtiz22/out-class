/* Isolated list pages: the real Members (OrganizationMemberManagement) and Announcements lists, which Demo
   Mode replaces, inside the real shell on fictional records. Server actions are stubbed to throw. Local only. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { ProductShell } from '@/components/shell/product-shell'
import { PageHeader } from '@/components/ui/page-header'
import { OrganizationMemberManagement } from '@/components/organization-member-management'
import { ClubAnnouncements } from '@/components/club-announcements'
import { leaderRailSections } from '@/lib/navigation'
import { FixtureBoundary, useAuth } from '../floating-header/boundaries'
import { useSearchParams } from '../floating-header/navigation'
import { directory, announcements, clubId } from './data'

function Page() {
  const params = useSearchParams(), { user } = useAuth()
  const member = user.memberships[0], page = params.get('page') || 'members'
  return <ProductShell manager clubId={clubId} clubName={member.club.name} sections={leaderRailSections(member, clubId, params.toString())} mode="club" active={page === 'members' ? 'members' : 'announcements'}>
    <PageHeader density="compact" eyebrow={member.club.name} title={page === 'members' ? 'Members' : 'Announcements'} />
    {page === 'members' ? <OrganizationMemberManagement clubId={clubId} initialData={directory()} validatedInitialData /> : <ClubAnnouncements clubId={clubId} initialItems={announcements()} />}
  </ProductShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><ConfirmProvider><Page /></ConfirmProvider></FixtureBoundary>)

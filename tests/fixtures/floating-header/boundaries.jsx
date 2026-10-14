/* Test-only identity/data boundaries. Production auth, search, and notifications are untouched. */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSearchParams, usePathname } from './navigation'
import { clubPermissions } from '@/lib/permissions'
const Context = createContext(null)
export const clubs = [{ id: 'fixture-mii', name: 'McIntire Investment Institute', color: '#142d45' }, { id: 'fixture-volunteers', name: 'Virginia Volunteers', color: '#315b4b' }]
export function FixtureBoundary({ children }) {
  const params = useSearchParams(), pathname = usePathname()
  const [role] = useState(() => params.get('role') || 'owner')
  const [photo] = useState(() => params.has('avatar'))
  const [counts, setCounts] = useState({ unread: 2, invitations: 1 })
  useEffect(() => { const update = event => setCounts(event.detail); window.addEventListener('fixture:counts', update); return () => window.removeEventListener('fixture:counts', update) }, [])
  const value = useMemo(() => {
    const permissions = role === 'settings' ? ['club.settings'] : role === 'reviewer' ? ['applications.review'] : role === 'member' || role === 'student' ? [] : clubPermissions
    return { role, pathname, counts, user: { id: 'fixture-user', email: 'fixture@virginia.edu', profile: { firstName: 'Avery', lastName: 'Morgan', headshotUrl: photo ? '/images/landing/jordan-avery.jpg' : null }, memberships: clubs.map(club => ({ id: `member-${club.id}`, clubId: club.id, club, status: 'ACTIVE', isOwner: role === 'owner', permissions })) } }
  }, [role, pathname, photo, counts])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useAuth() { const value = useContext(Context); return { user: value.user, role: value.role, loading: false, isImpersonating: false } }
export function useDemoMode() { return { isDemoEnabled: false, allowed: false } }
export function useOrganizationInvitations() { const { counts } = useContext(Context); return { invitations: Array.from({ length: counts.invitations }, (_, i) => ({ id: `fixture-invite-${i}` })) } }
const noop = () => {}
export function useApplicationState() {
  const { counts } = useContext(Context)
  return { notifications: [], durableUnread: counts.unread, syncTaskNotifications: noop, syncDurableNotifications: noop, focusApplication: clubId => history.pushState(null, '', `/?view=tracker&applicationClubId=${clubId}`), focusLeader: value => history.pushState(null, '', `/club/${value.clubId}/workspace?section=recruitment&tool=applicants`) }
}
export async function getTaskNotifications() { return [] }
export async function getDurableNotifications() { return { notifications: [], unread: 2 } }
export async function searchWorkspace(query, leader) {
  window.fixtureSearchCalls.push({ query, leader })
  if (new URLSearchParams(location.search).has('searchError')) throw Error('Fixture record search unavailable')
  const role = new URLSearchParams(location.search).get('role') || 'owner'
  if (leader && role !== 'owner') return []
  return query.toLowerCase().includes('avery') ? [{ kind: leader ? 'applicant' : 'application', id: 'fixture-application', clubId: clubs[0].id, title: 'Avery Morgan', detail: 'Isolated test record' }] : []
}
export function createClient() { return { auth: { async signOut() { sessionStorage.setItem('fixtureSignOuts', String(Number(sessionStorage.getItem('fixtureSignOuts') || 0) + 1)); return { error: null } } } } }
export function TutorialWalkthrough() { return null }
export default function Image({ src, alt, priority: _priority, unoptimized: _unoptimized, ...props }) { return <img src={src} alt={alt} {...props} /> }

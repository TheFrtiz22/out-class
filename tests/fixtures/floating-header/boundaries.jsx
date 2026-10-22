/* Test-only identity/data boundaries. Production auth, search, and notifications are untouched. */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSearchParams, usePathname } from './navigation'
import { clubPermissions } from '@/lib/permissions'
const Context = createContext(null)
export const clubs = [{ id: 'fixture-mii', name: 'McIntire Investment Institute', color: '#142d45' }, { id: 'fixture-volunteers', name: 'Virginia Volunteers', color: '#315b4b' }]
export function FixtureBoundary({ children }) {
  const params = useSearchParams(), pathname = usePathname()
  const [role] = useState(() => params.get('role') || 'owner')
  const [revoked, setRevoked] = useState(false)
  useEffect(() => { const update = () => setRevoked(true); window.addEventListener('fixture:revoke-leader', update); return () => window.removeEventListener('fixture:revoke-leader', update) }, [])
  const [photo] = useState(() => params.has('avatar'))
  const [counts, setCounts] = useState({ unread: 2, invitations: 1 })
  useEffect(() => { const update = event => setCounts(event.detail); window.addEventListener('fixture:counts', update); return () => window.removeEventListener('fixture:counts', update) }, [])
  const value = useMemo(() => {
    const permissions = revoked ? [] : role === 'settings' ? ['club.settings'] : role === 'reviewer' ? ['applications.review'] : role === 'member' || role === 'student' ? [] : clubPermissions
    return { role, pathname, counts, setCounts, user: { id: 'fixture-user', email: 'fixture@virginia.edu', profile: { firstName: 'Avery', lastName: 'Morgan', headshotUrl: photo ? '/images/landing/jordan-avery.jpg' : null }, memberships: clubs.map(club => ({ id: `member-${club.id}`, clubId: club.id, club, status: 'ACTIVE', interviewOffices: !revoked && role === 'president' ? ['PRESIDENT'] : [], isOwner: !revoked && role === 'owner', permissions })).concat([{ id: 'ordinary-member', clubId: 'ordinary-club', club: { id: 'ordinary-club', name: 'Campus Arts Society', color: '#142d45' }, status: 'ACTIVE', isOwner: false, permissions: [], interviewOffices: [] }]) } }
  }, [role, pathname, photo, counts, revoked])
  const stableUser = useMemo(() => value.user, [role, photo, revoked])
  return <Context.Provider value={{ ...value, user: stableUser }}>{children}</Context.Provider>
}
export function useAuth() { const value = useContext(Context); return { user: value.user, role: value.role, loading: false, isImpersonating: false, activeClubId: clubs[0].id, refreshUser: async () => { window.fixtureIdentityRefreshes = (window.fixtureIdentityRefreshes || 0) + 1 } } }
export function useDemoMode() { return { isDemoEnabled: false, allowed: false } }
export function useOrganizationInvitations() {
  const { counts, setCounts } = useContext(Context)
  return { invitations: Array.from({ length: counts.invitations }, (_, i) => ({ id: `fixture-invite-${i}`, requestedRole: 'MEMBER', dismissedAt: null, club: clubs[0] })), loading: false, failed: false, refresh() {}, async changed(change) { if (change.kind === 'accepted' || change.kind === 'declined') setCounts(old => ({ ...old, invitations: Math.max(0, old.invitations - 1) })) } }
}
export function ApplicationStateProvider({ children }) { return children }
const noop = () => {}
export function useApplicationState() {
  const { counts } = useContext(Context)
  return { notifications: [], markNotificationRead: async () => true, setNotificationsRead: async () => true, deleteNotifications: async () => true, markAllNotificationsRead: async () => true, durableUnread: counts.unread, syncTaskNotifications: noop, syncDurableNotifications: noop, focusApplication: clubId => history.pushState(null, '', `/?view=tracker&applicationClubId=${clubId}`), focusLeader: value => history.pushState(null, '', `/club/${value.clubId}/workspace?section=recruitment&tool=applicants`) }
}
export async function getTaskNotifications() { return [] }
function notificationBackend() {
  window.fixtureFaults ||= {}
  window.fixtureNotificationCalls ||= []
  if (window.fixtureBackend) return window.fixtureBackend
  const enabled = new URLSearchParams(location.search).has('notificationsFixture')
  const saved = localStorage.getItem('fixture-notifications')
  const types = ['ANNOUNCEMENT', 'APPLICATION', 'INTERVIEW', 'TASK', 'DECISION']
  const titles = ['Welcome to recruitment', 'New application received', 'Interview rescheduled', 'Review your club task', 'Your decision is available']
  const now = Date.now()
  const rows = enabled ? Array.from({ length: 125 }, (_, i) => ({ id: String(i + 1), type: types[i % 5], title: i < 5 ? titles[i] : `Club update ${i + 1}`, body: i === 0 ? 'The next recruitment round opens on Monday. Everything you need is saved here.' : 'A saved, authorized notification. Open the update for its details.', clubId: clubs[0].id, club: { name: clubs[0].name, color: clubs[0].color, logoUrl: null }, href: i % 5 === 0 ? '/?workspace=student&view=inbox' : i % 5 === 1 ? '/club/fixture-mii/workspace?section=recruitment&tool=applicants&applicantId=fixture-app' : i % 5 === 2 ? '/settings/interviews?assignmentId=fixture-assignment' : i % 5 === 3 ? '/club/fixture-mii/workspace?section=tasks&taskId=fixture-task' : '/applications/fixture-app/decision?letterId=fixture-letter', createdAt: new Date(now - (i + 1) * 300000).toISOString(), readAt: i % 4 === 3 ? new Date(now).toISOString() : null, archivedAt: null, eventKey: `fixture:${i}` })) : []
  window.fixtureBackend = saved ? JSON.parse(saved) : rows
  return window.fixtureBackend
}
const saveNotificationBackend = () => localStorage.setItem('fixture-notifications', JSON.stringify(window.fixtureBackend))
export async function getDurableNotifications(cursor) {
  const rows = notificationBackend()
  window.fixtureNotificationCalls.push({ action: 'load', cursor })
  if (window.fixtureFaults.loadDelay) await new Promise(resolve => { window.fixtureReleaseLoad = resolve })
  if (window.fixtureFaults.load) throw Error('Fixture load failed')
  const visible = rows.filter(item => !item.archivedAt), start = cursor ? visible.findIndex(item => item.id === cursor) + 1 : 0
  return { items: structuredClone(visible.slice(start, start + 50)), nextCursor: visible.length > start + 50 ? visible[start + 49].id : null, unread: visible.filter(item => !item.readAt).length }
}
export async function setDurableNotificationsRead(ids, read) {
  notificationBackend(); window.fixtureNotificationCalls.push({ action: 'read', ids, read })
  if (window.fixtureFaults.action) throw Error('Fixture read failed')
  window.fixtureBackend = window.fixtureBackend.map(item => ids.includes(item.id) ? { ...item, readAt: read ? new Date().toISOString() : null } : item)
  saveNotificationBackend(); return { updated: ids.length }
}
export async function setDurableNotificationsArchived(ids, archived) {
  notificationBackend(); window.fixtureNotificationCalls.push({ action: 'archive', ids, archived })
  if (window.fixtureFaults.action) throw Error('Fixture archive failed')
  window.fixtureBackend = window.fixtureBackend.map(item => ids.includes(item.id) ? { ...item, archivedAt: archived ? new Date().toISOString() : null } : item)
  saveNotificationBackend(); return { count: ids.length }
}
export async function acceptIdentityClubInvitation() { window.fixtureInvitationActions ||= []; window.fixtureInvitationActions.push('accept'); return { clubId: clubs[0].id } }
export async function declineIdentityClubInvitation() { return {} }
export async function setOrganizationInvitationDismissed() { return {} }
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

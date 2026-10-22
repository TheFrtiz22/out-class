import React from 'react'
import { createRoot } from 'react-dom/client'
import { ApplicationStateProvider } from '@/lib/application-state'
import { ProductShell } from '@/components/shell/product-shell'
import { Toaster } from '@/components/ui/sonner'
import { FixtureBoundary, useAuth, clubs } from './boundaries'
import { useSearchParams, usePathname, useRouter } from './navigation'
import { personalModes, personalItems, personalDestination, personalMode, managerNavigation } from '@/lib/product-navigation'
import { adminNavigation } from '@/lib/admin-navigation'
import { recruitmentTools } from '@/lib/club-workspace'
window.fixtureSearchCalls = []
for (const name of ['pushState', 'replaceState']) {
  const original = history[name].bind(history)
  history[name] = (...args) => { original(...args); window.dispatchEvent(new Event('fixture:navigation')) }
}
function FixtureApp() {
  const params = useSearchParams(), path = usePathname(), router = useRouter(), { user, role } = useAuth()
  const clubId = path.match(/\/club\/([^/]+)/)?.[1] || clubs[0].id
  const member = user.memberships.find(item => item.clubId === clubId) || user.memberships[0]
  const manager = !['student', 'member'].includes(role), platform = role === 'platform'
  const mode = !manager ? params.get('mode') || 'explore' : params.get('section') === 'recruitment' ? 'recruiting' : 'club'
  const modes = platform ? [] : manager ? [...(recruitmentTools(member).length ? [{ id: 'recruiting', label: 'Recruiting', href: `/club/${clubId}/workspace?section=recruitment&tool=overview&role=${role}` }] : []), { id: 'club', label: 'Club', href: `/club/${clubId}/workspace?section=overview&role=${role}` }] : personalModes
  const view = params.get('view') || 'overview'
  const title = view === 'inbox' ? 'Notifications' : view === 'student-profile' ? 'Your profile' : mode === 'recruiting' ? 'Recruitment' : 'Overview'
  return <><ProductShell manager={manager} workspaceKind={platform ? 'admin' : undefined} modes={modes} mode={mode} active={platform ? path.split("/")[2] || "overview" : manager ? params.get("section") === "recruitment" ? params.get("tool") || "overview" : params.get("section") || "overview" : view === "overview" ? mode === "apply" ? "applications" : mode === "clubs" ? "clubs" : "explore" : ({ tracker: "applications", "my-clubs": "clubs" }[view] || view)} clubId={manager && !platform ? clubId : ''} clubName={member.club.name} title={title} items={platform ? adminNavigation : manager ? managerNavigation(member, clubId, mode) : personalItems(mode)} onSelect={id => { const destination = personalDestination(id); router.push(`/?role=${role}&mode=${destination.section ? personalMode(destination.section) : "explore"}&view=${destination.view}`) }} onNavigate={id => router.push(`${path}?role=${role}&view=${id}`)}>
    <p style={{ color: '#52606d', fontSize: 12 }}>ISOLATED UI VERIFICATION · FICTIONAL IDENTITY AND RECORDS</p>
    <h1 style={{ fontFamily: 'Libre Caslon Text, Georgia, serif', fontSize: 'clamp(28px,4vw,40px)', margin: '12px 0 8px', color: '#142d45' }}>{title}</h1>
    <p style={{ color: '#52606d', marginBottom: 28 }}>The real shared navigation, with safe local identity and data boundaries.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>{['Applications', 'Upcoming interviews', 'Workspace activity'].map((label, i) => <section key={label} style={{ padding: 24, background: '#fffefa', border: '1px solid #dfe2de', borderRadius: 12 }}><p>{label}</p><strong style={{ fontSize: 32 }}>{[24, 6, 12][i]}</strong></section>)}</div>
    <section style={{ marginTop: 28, padding: 24, minHeight: 1200, background: '#fffefa', border: '1px solid #dfe2de', borderRadius: 12 }}><h2 style={{ fontSize: 20, marginBottom: 16 }}>Workspace content</h2><p>Scroll to verify floating controls and portaled menus.</p></section>
  </ProductShell><Toaster /></>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><ApplicationStateProvider initialData={{}} persistLocalState={false}><FixtureApp /></ApplicationStateProvider></FixtureBoundary>)

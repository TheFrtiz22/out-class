/* Isolated club leader screens: the real workspace shell and ClubWorkspace running on Demo Mode's
   fictional, in-browser data. Local only; no sessions, server actions, databases or production data. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { DemoDataProvider } from '@/contexts/demo-context'
import { AuthProvider } from '@/contexts/auth-context'
import { WorkspaceShell } from '@/components/shell/workspace-shell'
import { ClubWorkspace } from '@/components/club-workspace'
import { createDemoSeed } from '@/lib/demo/seed'
// Only the invitations count comes from the shared fixture boundary; identity is Demo Mode's.
import { FixtureBoundary } from '../floating-header/boundaries'

// As in Next.js (and the floating-header fixture), history changes update useSearchParams, so client-side
// redirects (old club workspace links) and query-only navigation re-render the page.
for (const name of ['pushState', 'replaceState']) {
  const original = history[name].bind(history)
  history[name] = (...args) => { original(...args); window.dispatchEvent(new Event('fixture:navigation')) }
}
// Anchored to today (Eastern), like Demo Mode itself: a fixed date aged the fixture's
// interviews into the past, and the Interviews list then had no rows (CI, Nov 13).
const seed = createDemoSeed()
seed.perspective = { role: 'leader', clubId: seed.clubs[0].id }
window.__leaderClubId = seed.clubs[0].id
const clubId = location.pathname.match(/\/club\/([^/]+)\/workspace/)?.[1]
function Screen() {
  if (!seed.clubs.some(club => club.id === decodeURIComponent(clubId || ''))) { history.replaceState(null, '', `/club/${encodeURIComponent(seed.clubs[0].id)}/workspace${location.search}`); location.reload(); return null }
  return <WorkspaceShell><ClubWorkspace clubId={decodeURIComponent(clubId)} section="" /></WorkspaceShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><ConfirmProvider><DemoDataProvider enabled allowed template={seed}><AuthProvider hasSession={false}><Screen /></AuthProvider></DemoDataProvider></ConfirmProvider></FixtureBoundary>)

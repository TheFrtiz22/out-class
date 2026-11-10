/* Isolated club leader screens: the real workspace shell and ClubWorkspace running on Demo Mode's
   fictional, in-browser data. Local only; no sessions, server actions, databases or production data. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { DemoDataProvider } from '@/contexts/demo-context'
import { AuthProvider } from '@/contexts/auth-context'
import { WorkspaceShell } from '@/components/shell/workspace-shell'
import { ClubWorkspace } from '@/components/club-workspace'
import { createDemoSeed } from '@/lib/demo/seed'
// Only the invitations count comes from the shared fixture boundary; identity is Demo Mode's.
import { FixtureBoundary } from '../floating-header/boundaries'

const seed = createDemoSeed('2026-11-09')
seed.perspective = { role: 'leader', clubId: seed.clubs[0].id }
window.__leaderClubId = seed.clubs[0].id
const clubId = location.pathname.match(/\/club\/([^/]+)\/workspace/)?.[1]
function Screen() {
  if (!seed.clubs.some(club => club.id === decodeURIComponent(clubId || ''))) { history.replaceState(null, '', `/club/${encodeURIComponent(seed.clubs[0].id)}/workspace${location.search}`); location.reload(); return null }
  return <WorkspaceShell><ClubWorkspace clubId={decodeURIComponent(clubId)} section="" /></WorkspaceShell>
}
createRoot(document.getElementById('root')).render(<FixtureBoundary><DemoDataProvider enabled allowed template={seed}><AuthProvider hasSession={false}><Screen /></AuthProvider></DemoDataProvider></FixtureBoundary>)

/* Test-only stand-ins for the lazy dashboard drawers, which call server actions. */
import React from 'react'
const Stub = name => props => <div data-fixture-drawer={name}><p>Fixture {name}</p>{props.booking && <p>{props.booking.candidate}</p>}</div>
export const DashboardTask = Stub('task')
export const DashboardMeeting = Stub('meeting')
export const DashboardPreparation = Stub('preparation')
// The setup checklist reads a server action; the recruiting strip reads its own small summary. Neither has a
// server in this fixture, so the checklist renders nothing and the strip comes from window.__clubHomeStrip.
export function OrganizationSetupChecklist() { return null }
export function useRecruitingStrip() { return typeof window !== 'undefined' ? window.__clubHomeStrip ?? null : null }

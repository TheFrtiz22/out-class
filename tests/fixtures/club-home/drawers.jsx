/* Test-only stand-ins for the lazy dashboard drawers, which call server actions. */
import React from 'react'
const Stub = name => props => <div data-fixture-drawer={name}><p>Fixture {name}</p>{props.booking && <p>{props.booking.candidate}</p>}</div>
export const DashboardTask = Stub('task')
export const DashboardMeeting = Stub('meeting')
export const DashboardPreparation = Stub('preparation')

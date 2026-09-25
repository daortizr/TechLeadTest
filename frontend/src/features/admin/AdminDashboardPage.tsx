import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { FlightDTO } from '@flight-reservations/shared'
import { ADMIN_LABELS } from '../../lib/labels'
import FlightSearch from '../flights/FlightSearch'
import type { CardAction } from '../flights/FlightCard'

// The administrator can open the dashboard of ANY flight, including a cancelled or sold-out one:
// its numbers stay visible (architecture.md 10.7). So nothing here is disabled or muted.
function dashboardAction(flight: FlightDTO, open: (flightId: string) => void): CardAction {
  return {
    label: ADMIN_LABELS.dashboard.view,
    disabled: false,
    muted: false,
    reason: null,
    onClick: () => open(flight.id)
  }
}

// Same look as the public search; each result leads to that flight's dashboard
export default function AdminDashboardPage(): React.ReactElement {
  const navigate = useNavigate()

  return (
    <>
      <h1 className="visually-hidden">{ADMIN_LABELS.dashboard.title}</h1>
      <FlightSearch describeFlight={(flight) => dashboardAction(flight, (id) => navigate(`/admin/dashboard/${id}`))} />
    </>
  )
}

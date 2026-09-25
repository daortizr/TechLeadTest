import React from 'react'
import { useNavigate } from 'react-router-dom'
import FlightSearch from './FlightSearch'
import { customerAction } from './customerAction'

// The public home: search flights and open the seat map of one that is on sale
export default function SearchPage(): React.ReactElement {
  const navigate = useNavigate()

  return <FlightSearch describeFlight={(flight) => customerAction(flight, (id) => navigate(`/flights/${id}`))} />
}

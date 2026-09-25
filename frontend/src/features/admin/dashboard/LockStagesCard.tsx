import React from 'react'
import type { LockStagesDTO } from '@flight-reservations/shared'
import { ADMIN_LABELS } from '../../../lib/labels'

interface LockStagesCardProps {
  stages: LockStagesDTO | null
  failed: boolean
}

const D = ADMIN_LABELS.dashboard

export default function LockStagesCard({ stages, failed }: LockStagesCardProps): React.ReactElement {
  const selecting = stages?.selecting ?? 0
  const paying = stages?.checkout ?? 0
  const active = selecting + paying
  const summary = `${selecting} ${D.selecting}, ${paying} ${D.paying}`

  return (
    <section className="card dash-card" aria-labelledby="stages-title">
      <h2 id="stages-title" className="dash-subtitle">
        {D.stages}
      </h2>

      <div className="stage-bar" role="img" aria-label={summary}>
        <span className="stage-bar__selecting" style={{ width: active === 0 ? '0%' : `${(selecting / active) * 100}%` }} />
        <span className="stage-bar__paying" style={{ width: active === 0 ? '0%' : `${(paying / active) * 100}%` }} />
      </div>

      <div className="stage-legend">
        <p className="stage-legend__item">
          <span className="stage-swatch stage-swatch--selecting" aria-hidden="true" />
          <span>
            <strong>{selecting}</strong> {D.selecting}
          </span>
        </p>
        <p className="stage-legend__item">
          <span className="stage-swatch stage-swatch--paying" aria-hidden="true" />
          <span>
            <strong>{paying}</strong> {D.paying}
          </span>
        </p>
      </div>

      {failed && <p className="dash-note">{D.stagesUnavailable}</p>}
    </section>
  )
}

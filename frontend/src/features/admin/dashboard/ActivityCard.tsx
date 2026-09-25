import React from 'react'
import { ADMIN_LABELS } from '../../../lib/labels'
import type { ActivityItem } from '../../../realtime'
import { describeActivity, relativeTime } from '../activity'

interface ActivityCardProps {
  items: ActivityItem[]
  // Local time in ms: "hace 4 s" counts from when the event reached this tab
  now: number
}

const D = ADMIN_LABELS.dashboard

// The last 10 events of the flight, newest first. It lives in memory: a reload starts it empty.
export default function ActivityCard({ items, now }: ActivityCardProps): React.ReactElement {
  return (
    <section className="card dash-card" aria-labelledby="activity-title">
      <h2 id="activity-title" className="dash-subtitle">
        {D.activity}
      </h2>

      {items.length === 0 ? (
        <p className="dash-note">{D.noActivity}</p>
      ) : (
        <ul className="activity-list">
          {items.map((item) => (
            <li key={item.id} className="activity-row">
              <span>{describeActivity(item.event)}</span>
              <span className="activity-row__time">{relativeTime(item.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

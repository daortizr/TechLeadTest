import React from 'react'
import { useStore } from '../realtime'
import { AlertIcon } from './icons'
import './AppLayout.css'

// Temporary notices ("Tu bloqueo venció"), announced politely. Shared by the public and admin frames.
export default function NoticeRegion(): React.ReactElement {
  const { state } = useStore()
  const { notice } = state

  return (
    <div className="notice-region" role="status" aria-live="polite">
      {notice && (
        <div className={`notice notice--${notice.kind}`}>
          <AlertIcon size={18} />
          <span>{notice.text}</span>
        </div>
      )}
    </div>
  )
}

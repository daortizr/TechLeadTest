import { useCallback, useEffect, useRef, useState } from 'react'
import { BOOKING_LABELS } from '../../lib/labels'

interface UseCopy {
  // Text to announce/show after the last copy attempt, empty otherwise
  feedback: string
  copy: (text: string, successMessage: string) => Promise<void>
}

const FEEDBACK_MS = 2500

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (error) {
    console.warn('Clipboard API refused the copy, trying the fallback', error)
  }
  // Older browsers and non-secure origins
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(area)
  }
}

export function useCopy(): UseCopy {
  const [feedback, setFeedback] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const copy = useCallback(async (text: string, successMessage: string) => {
    const copied = await writeToClipboard(text)
    setFeedback(copied ? successMessage : BOOKING_LABELS.copyFailed)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFeedback(''), FEEDBACK_MS)
  }, [])

  return { feedback, copy }
}

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { speak } from './speech'

type Politeness = 'polite' | 'assertive'
type Announce = (message: string, politeness?: Politeness) => void

const AnnouncerContext = createContext<Announce>(() => {})

export function useAnnounce(): Announce {
  return useContext(AnnouncerContext)
}

/**
 * Screen-reader announcements via two visually hidden live regions.
 * With `voice` on (audio mode without a screen reader), messages are also spoken aloud.
 */
export function AnnouncerProvider({ voice, children }: { voice: boolean; children: ReactNode }) {
  const [messages, setMessages] = useState({ polite: '', assertive: '' })
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const announce = useCallback<Announce>((message, politeness = 'polite') => {
    // Clearing first makes repeated identical messages announce again.
    setMessages((m) => ({ ...m, [politeness]: '' }))
    window.setTimeout(() => setMessages((m) => ({ ...m, [politeness]: message })), 60)
    if (voiceRef.current) speak(message)
  }, [])

  const value = useMemo(() => announce, [announce])

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {messages.polite}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {messages.assertive}
      </div>
    </AnnouncerContext.Provider>
  )
}

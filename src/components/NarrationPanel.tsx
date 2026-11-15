import { useEffect, useMemo, useRef, useState } from 'react'
import { readingSeconds } from '../a11y/speech'
import type { Cue } from '../data/narration'
import { formatNumber } from '../data/time'
import { audioEngine } from '../sound/audioEngine'
import { NarrationArt } from './NarrationArt'
import { chunkText, typedAt, type TypedState } from './typing'
import styles from './NarrationPanel.module.css'

interface Props {
  cue: Cue
  index: number
  count: number
  scope: string
  reducedMotion: boolean
}

/**
 * Follows the narration voice: while it plays, typing tracks its progress; when it stops, the text
 * freezes where it was. Before any voice starts for this chapter, it types at reading speed.
 */
function useTyped(chunks: string[], text: string, resetKey: string): TypedState {
  const [state, setState] = useState<TypedState>({ chunk: 0, chars: 0 })
  const last = useRef(state)

  useEffect(() => {
    const start = performance.now()
    const estimate = readingSeconds(text)
    let synced = false
    let progress = 0
    let raf = 0
    const loop = (now: number) => {
      const voice = audioEngine.getNarrationProgress()
      if (voice !== null) {
        synced = true
        progress = voice
      } else if (!synced) {
        progress = Math.min(1, (now - start) / 1000 / estimate)
      }
      const next = typedAt(chunks, progress)
      if (next.chunk !== last.current.chunk || next.chars !== last.current.chars) {
        last.current = next
        setState(next)
      }
      raf = requestAnimationFrame(loop)
    }
    last.current = { chunk: 0, chars: 0 }
    setState(last.current)
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [chunks, text, resetKey])

  return state
}

export function NarrationPanel({ cue, index, count, scope, reducedMotion }: Props) {
  const key = `${scope}-${index}`
  const chunks = useMemo(() => chunkText(cue.text), [cue.text])
  const typed = useTyped(chunks, cue.text, key)
  const passage = chunks[typed.chunk] ?? ''
  const shown = reducedMotion ? passage : passage.slice(0, typed.chars)
  const typing = !reducedMotion && typed.chars < passage.length

  // On short screens the column can be shorter than a passage: keep the line being typed in view.
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = panelRef.current
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight
  }, [typed])

  return (
    <aside ref={panelRef} className={styles.panel} aria-labelledby="narration-heading" data-tour="narration">
      <h2 id="narration-heading" className="sr-only">
        Narration
      </h2>
      <div key={key} className={`${styles.story} appear`}>
        <NarrationArt kind={cue.art} alt={cue.alt} />
        <p className="eyebrow">
          {index + 1} / {count}
        </p>
        <h3 className={styles.title}>{cue.title}</h3>
        {/* Screen readers get the whole chapter at once; the typed passage is visual only. */}
        <p className="sr-only">{cue.text}</p>
        <p key={typed.chunk} className={styles.text} aria-hidden="true" data-typing={typing || undefined}>
          {shown}
        </p>
        {chunks.length > 1 && (
          <div className={styles.passages} aria-hidden="true">
            {chunks.map((_, i) => (
              <span key={i} data-on={i === typed.chunk || undefined} data-done={i < typed.chunk || undefined} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

/** Number over a bracketed hairline, after inspo-2's "8 / 54 / 1235" stats. Used by the ending screen. */
export function Counter({ id, label, value, big = false }: { id: 'ari' | 'land'; label: string; value: number; big?: boolean }) {
  return (
    <div className={big ? `${styles.counter} ${styles.big}` : styles.counter} data-counter={big ? undefined : id}>
      <span className={styles.value}>{formatNumber(value)}</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}

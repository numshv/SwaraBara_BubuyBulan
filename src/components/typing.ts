/**
 * Splits narration into short passages and maps narration progress (0–1) to how much of which
 * passage is typed. Each passage types out, lingers, then gives way to the next, so the panel never
 * holds a whole long chapter at once.
 */

/** A passage holds at most this many sentences... */
const MAX_SENTENCES = 2
/** ...and grows past one sentence only while it stays under this many characters. */
const MAX_CHARS = 240
/** Time a finished passage stays on screen, in characters of typing. */
const LINGER_CHARS = 40

export function splitSentences(text: string): string[] {
  // A sentence ends at . ! ? (plus closing quotes) followed by whitespace or the end, so "1.6" stays whole.
  const parts = text.match(/.+?(?:[.!?]+["'”’)\]]*(?=\s|$)|$)\s*/gs) ?? [text]
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function chunkText(text: string): string[] {
  const chunks: string[] = []
  let cur: string[] = []
  for (const s of splitSentences(text)) {
    const len = cur.join(' ').length
    if (cur.length && (cur.length >= MAX_SENTENCES || len + 1 + s.length > MAX_CHARS)) {
      chunks.push(cur.join(' '))
      cur = []
    }
    cur.push(s)
  }
  if (cur.length) chunks.push(cur.join(' '))
  return chunks.length ? chunks : ['']
}

export interface TypedState {
  chunk: number
  /** Characters of that chunk shown. */
  chars: number
}

export function typedAt(chunks: string[], progress: number): TypedState {
  const weights = chunks.map((c) => c.length + LINGER_CHARS)
  const total = weights.reduce((a, b) => a + b, 0)
  let pos = Math.min(1, Math.max(0, progress)) * total
  for (let i = 0; i < chunks.length; i++) {
    if (pos < weights[i] || i === chunks.length - 1) {
      return { chunk: i, chars: Math.min(chunks[i].length, Math.floor(pos)) }
    }
    pos -= weights[i]
  }
  return { chunk: 0, chars: 0 }
}

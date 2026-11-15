import { describe, expect, it } from 'vitest'
import { CUES } from '../data/narration'
import { chunkText, splitSentences, typedAt } from './typing'

const text = 'One short. Two short. Three is a little longer than the others! Four?'

describe('narration typing', () => {
  it('splits on sentence ends', () => {
    expect(splitSentences(text)).toEqual(['One short.', 'Two short.', 'Three is a little longer than the others!', 'Four?'])
    expect(splitSentences('No ending')).toEqual(['No ending'])
  })

  it('groups at most two sentences per passage and loses no words', () => {
    const chunks = chunkText(text)
    expect(chunks).toEqual(['One short. Two short.', 'Three is a little longer than the others! Four?'])
    for (const cues of Object.values(CUES)) {
      for (const c of cues) {
        expect(chunkText(c.text).join(' ').replace(/\s+/g, ' ')).toBe(c.text.trim().replace(/\s+/g, ' '))
      }
    }
  })

  it('types the first passage from the start and ends on the full last one', () => {
    const chunks = chunkText(text)
    expect(typedAt(chunks, 0)).toEqual({ chunk: 0, chars: 0 })
    expect(typedAt(chunks, 1)).toEqual({ chunk: 1, chars: chunks[1].length })
    const mid = typedAt(chunks, 0.2)
    expect(mid.chunk).toBe(0)
    expect(mid.chars).toBeGreaterThan(0)
  })
})

/** Thin wrapper over the Web Speech API, preferring an English (US) voice. */

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang === 'en-US') ?? voices.find((v) => v.lang.startsWith('en'))
}

export function speak(text: string, onEnd?: () => void): void {
  if (!speechSupported) {
    onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 1
  const voice = englishVoice()
  if (voice) u.voice = voice
  if (onEnd) {
    u.onend = () => onEnd()
    u.onerror = () => onEnd()
  }
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (speechSupported) window.speechSynthesis.cancel()
}

/** Rough time a screen reader needs to read a text at ~170 words per minute. */
export function readingSeconds(text: string): number {
  return text.split(/\s+/).length / 2.8 + 1.2
}

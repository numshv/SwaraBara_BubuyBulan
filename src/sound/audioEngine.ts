import type { Layers } from '../components/SoundLayers'
import { readingSeconds, speak, stopSpeaking } from '../a11y/speech'
import type { SongId } from '../data/regions'
import { SONG_SLICES, STEMS, hasStemAudio, stemGains, stemUrls, type StemId } from './manifest'

type StemBuffers = Record<StemId, AudioBuffer>

interface StemAnchor {
  song: SongId
  sliceIndex: number
  startFrame: number
  endFrame: number
  durationSec: number
  offsetSec: number
  ctxStartTime: number
  wallStartMs: number
  speed: number
  virtual: boolean
}

const CACHE_LIMIT = 4

class SoundEngine {
  private ctx: AudioContext | null = null
  private stemGainNodes: Record<StemId, GainNode> | null = null
  private activeSources: AudioBufferSourceNode[] = []
  private bufferCache = new Map<string, StemBuffers>()
  private inflightLoads = new Map<string, Promise<StemBuffers | null>>()

  private narrationAudio: HTMLAudioElement | null = null
  private narrationTimer = 0
  private narrationToken = 0
  /** performance.now() when the current narration started, and its estimated length (text fallback). */
  private narrationStart = 0
  private narrationEstimateSec = 0
  private narrationActive = false
  private stemToken = 0

  private anchor: StemAnchor | null = null
  private loadingFrame: number | null = null
  private currentLayers: Layers = { wildfire: true, aerosol: true, elnino: true, iod: true, co: true }

  /** Create or resume AudioContext inside a user gesture handler. */
  unlock(): void {
    if (typeof window === 'undefined') return
    const ctx = this.ensureContext()
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (this.ctx) return this.ctx
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null

    const ctx = new Ctor()
    const master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)

    const gains = {} as Record<StemId, GainNode>
    const values = stemGains(this.currentLayers)
    for (const stem of STEMS) {
      const g = ctx.createGain()
      g.gain.value = values[stem]
      g.connect(master)
      gains[stem] = g
    }

    this.ctx = ctx
    this.stemGainNodes = gains
    return ctx
  }

  private cacheKey(song: SongId, sliceId: string): string {
    return `${song}/${sliceId}`
  }

  private putCache(key: string, buffers: StemBuffers): void {
    if (this.bufferCache.has(key)) this.bufferCache.delete(key)
    this.bufferCache.set(key, buffers)
    if (this.bufferCache.size > CACHE_LIMIT) {
      const oldest = this.bufferCache.keys().next().value
      if (oldest) this.bufferCache.delete(oldest)
    }
  }

  async loadSliceBuffers(song: SongId, sliceId: string): Promise<StemBuffers | null> {
    if (!hasStemAudio(song)) return null
    const key = this.cacheKey(song, sliceId)
    const cached = this.bufferCache.get(key)
    if (cached) return cached

    const inflight = this.inflightLoads.get(key)
    if (inflight) return inflight

    const ctx = this.ensureContext()
    const urls = stemUrls(song, sliceId)
    if (!ctx || !urls) return null

    const task = (async () => {
      try {
        const entries = await Promise.all(
          STEMS.map(async (stem) => {
            const res = await fetch(urls[stem])
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${urls[stem]}`)
            const arr = await res.arrayBuffer()
            const decoded = await ctx.decodeAudioData(arr)
            return [stem, decoded] as const
          }),
        )
        const map = Object.fromEntries(entries) as StemBuffers
        this.putCache(key, map)
        return map
      } catch {
        return null
      } finally {
        this.inflightLoads.delete(key)
      }
    })()

    this.inflightLoads.set(key, task)
    return task
  }

  preloadSlice(song: SongId, sliceIndex: number): void {
    if (!hasStemAudio(song)) return
    const slices = SONG_SLICES[song]
    const slice = slices[sliceIndex]
    if (!slice) return
    void this.loadSliceBuffers(song, slice.id)
  }

  /** Stop active instrument stem sources immediately. */
  stopStems(): void {
    this.stemToken += 1
    this.anchor = null
    this.loadingFrame = null
    for (const src of this.activeSources) {
      src.onended = null
      try {
        src.stop()
      } catch {
        // already stopped
      }
      src.disconnect()
    }
    this.activeSources = []
  }

  /**
   * How far the current narration has played, 0–1, or null when none is playing.
   * Uses the audio file's own clock when available, otherwise elapsed time over the reading estimate.
   */
  getNarrationProgress(): number | null {
    if (!this.narrationActive) return null
    const a = this.narrationAudio
    if (a) {
      if (!Number.isFinite(a.duration) || a.duration <= 0) return 0
      return Math.min(1, a.currentTime / a.duration)
    }
    const elapsed = (performance.now() - this.narrationStart) / 1000
    return Math.min(1, elapsed / Math.max(1, this.narrationEstimateSec))
  }

  /** Stop active narration audio & browser speech immediately. */
  stopNarration(): void {
    this.narrationToken += 1
    this.narrationActive = false
    window.clearTimeout(this.narrationTimer)
    this.narrationTimer = 0
    if (this.narrationAudio) {
      this.narrationAudio.onended = null
      this.narrationAudio.onerror = null
      this.narrationAudio.pause()
      this.narrationAudio.src = ''
      this.narrationAudio = null
    }
    stopSpeaking()
  }

  stopAll(): void {
    this.stopStems()
    this.stopNarration()
  }

  /**
   * Play narration while muting/stopping all sonification stems.
   * Calls onDone when narration finishes (or immediately via fallback timer if playback fails).
   */
  playNarration(
    url: string | null,
    fallbackText: string,
    useTtsFallback: boolean,
    onDone: () => void,
  ): void {
    this.stopStems()
    this.stopNarration()
    const token = ++this.narrationToken
    this.narrationActive = true
    this.narrationStart = performance.now()
    this.narrationEstimateSec = readingSeconds(fallbackText)

    let finished = false
    const finishOnce = () => {
      if (finished || token !== this.narrationToken) return
      finished = true
      this.narrationActive = false
      window.clearTimeout(this.narrationTimer)
      if (this.narrationAudio) {
        this.narrationAudio.onended = null
        this.narrationAudio.onerror = null
        this.narrationAudio = null
      }
      onDone()
    }

    const runTextFallback = () => {
      if (token !== this.narrationToken) return
      // Text fallback: restart the progress clock from now.
      this.narrationAudio = null
      this.narrationStart = performance.now()
      const waitMs = readingSeconds(fallbackText) * 1000
      if (useTtsFallback) {
        speak(fallbackText, finishOnce)
        // Guard in case speechSynthesis is silent/blocked and never fires onend.
        this.narrationTimer = window.setTimeout(finishOnce, waitMs + 3000)
      } else {
        this.narrationTimer = window.setTimeout(finishOnce, waitMs)
      }
    }

    if (url && typeof Audio !== 'undefined') {
      const audio = new Audio(url)
      audio.preload = 'auto'
      this.narrationAudio = audio
      audio.onended = finishOnce
      audio.onerror = runTextFallback
      void audio.play().catch(runTextFallback)
      return
    }

    runTextFallback()
  }

  /**
   * Start synchronized playback of all 6 stems for a given slice.
   * Stops any narration so stems and narration never overlap.
   */
  async playSliceStems(
    song: SongId,
    sliceIndex: number,
    frameT: number,
    speed: number,
    layers: Layers,
    onSliceEnd: (endFrame: number) => void,
  ): Promise<void> {
    this.stopNarration()
    this.stopStems()
    this.currentLayers = layers

    const slice = SONG_SLICES[song][sliceIndex]
    if (!slice) return

    const token = ++this.stemToken
    const span = Math.max(1, slice.endFrame - slice.startFrame)
    const clampedT = Math.min(slice.endFrame, Math.max(slice.startFrame, frameT))
    const frac = Math.min(0.999, Math.max(0, (clampedT - slice.startFrame) / span))

    if (!hasStemAudio(song)) {
      this.anchor = {
        song,
        sliceIndex,
        startFrame: slice.startFrame,
        endFrame: slice.endFrame,
        durationSec: slice.defaultDurationSec,
        offsetSec: frac * slice.defaultDurationSec,
        ctxStartTime: 0,
        wallStartMs: performance.now(),
        speed,
        virtual: true,
      }
      return
    }

    this.loadingFrame = clampedT
    const ctx = this.ensureContext()
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
    }

    const buffers = await this.loadSliceBuffers(song, slice.id)
    if (token !== this.stemToken) return
    this.loadingFrame = null

    if (!ctx || !this.stemGainNodes || !buffers) {
      // Fallback timing if stems failed to fetch/decode.
      this.anchor = {
        song,
        sliceIndex,
        startFrame: slice.startFrame,
        endFrame: slice.endFrame,
        durationSec: slice.defaultDurationSec,
        offsetSec: frac * slice.defaultDurationSec,
        ctxStartTime: 0,
        wallStartMs: performance.now(),
        speed,
        virtual: true,
      }
      return
    }

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {})
      if (token !== this.stemToken) return
    }

    const durationSec = buffers.peking.duration || slice.defaultDurationSec
    const offsetSec = Math.min(Math.max(0, durationSec - 0.05), frac * durationSec)
    const startWhen = ctx.currentTime + 0.015
    const gains = stemGains(this.currentLayers)

    const sources: AudioBufferSourceNode[] = []
    for (const stem of STEMS) {
      const gainNode = this.stemGainNodes[stem]
      gainNode.gain.setValueAtTime(gains[stem], ctx.currentTime)

      const src = ctx.createBufferSource()
      src.buffer = buffers[stem]
      src.playbackRate.value = speed
      src.connect(gainNode)
      src.start(startWhen, offsetSec)
      sources.push(src)
    }

    // Track slice completion from the primary stem.
    sources[0].onended = () => {
      if (token !== this.stemToken) return
      this.stopStems()
      onSliceEnd(slice.endFrame)
    }

    this.activeSources = sources
    this.anchor = {
      song,
      sliceIndex,
      startFrame: slice.startFrame,
      endFrame: slice.endFrame,
      durationSec,
      offsetSec,
      ctxStartTime: startWhen,
      wallStartMs: performance.now(),
      speed,
      virtual: false,
    }

    // Preload next slice smoothly while this slice is playing.
    if (sliceIndex + 1 < SONG_SLICES[song].length) {
      this.preloadSlice(song, sliceIndex + 1)
    }
  }

  /** Smoothly apply updated layer mutes to the 6 stem gain nodes. */
  setLayers(layers: Layers): void {
    this.currentLayers = layers
    if (!this.ctx || !this.stemGainNodes) return
    const gains = stemGains(layers)
    const now = this.ctx.currentTime
    for (const stem of STEMS) {
      this.stemGainNodes[stem].gain.setTargetAtTime(gains[stem], now, 0.02)
    }
  }

  /** Adjust playback speed without restarting the active stems. */
  setSpeed(speed: number): void {
    if (!this.anchor) return
    const currentOffset = this.elapsedSec()
    this.anchor.offsetSec = currentOffset
    this.anchor.speed = speed
    if (this.anchor.virtual) {
      this.anchor.wallStartMs = performance.now()
      return
    }
    if (this.ctx) {
      const now = this.ctx.currentTime
      this.anchor.ctxStartTime = now
      for (const src of this.activeSources) {
        src.playbackRate.setValueAtTime(speed, now)
      }
    }
  }

  private elapsedSec(): number {
    if (!this.anchor) return 0
    if (this.anchor.virtual) {
      const dt = Math.max(0, (performance.now() - this.anchor.wallStartMs) / 1000)
      return Math.min(this.anchor.durationSec, this.anchor.offsetSec + dt * this.anchor.speed)
    }
    if (!this.ctx) return this.anchor.offsetSec
    const dt = Math.max(0, this.ctx.currentTime - this.anchor.ctxStartTime)
    return Math.min(this.anchor.durationSec, this.anchor.offsetSec + dt * this.anchor.speed)
  }

  /**
   * Read the synchronized frame position for the currently playing slice.
   * Returns null when no stem session is active.
   */
  getSyncState(): { t: number; loading: boolean; sliceEnded: boolean; endFrame: number; sliceIndex: number } | null {
    if (this.loadingFrame !== null) {
      return { t: this.loadingFrame, loading: true, sliceEnded: false, endFrame: this.loadingFrame, sliceIndex: -1 }
    }
    if (!this.anchor) return null
    const sec = this.elapsedSec()
    const progress = this.anchor.durationSec > 0 ? Math.min(1, sec / this.anchor.durationSec) : 1
    const span = this.anchor.endFrame - this.anchor.startFrame
    const t = this.anchor.startFrame + progress * span
    return {
      t,
      loading: false,
      sliceEnded: sec >= this.anchor.durationSec - 0.01,
      endFrame: this.anchor.endFrame,
      sliceIndex: this.anchor.sliceIndex,
    }
  }
}

export const audioEngine = new SoundEngine()

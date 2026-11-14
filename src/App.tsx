import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AnnouncerProvider, useAnnounce } from './a11y/Announcer'
import { readingSeconds, speak, stopSpeaking } from './a11y/speech'
import { REPO_URL } from './config'
import { HelpDialog, SettingsDialog } from './components/Dialogs'
import { EndOverlay } from './components/EndOverlay'
import { AudioGuide } from './components/Guides'
import { Legend } from './components/Legend'
import { ModeGate } from './components/ModeGate'
import { NarrationPanel } from './components/NarrationPanel'
import { Player } from './components/Player'
import { LAYER_NAMES, SoundLayers, type LayerId, type Layers } from './components/SoundLayers'
import { INTRO_STEPS, PLAY_STEPS, Tour } from './components/Tour'
import { describeHaze, getAerosol, type AerosolField } from './data/aerosol'
import { getClimate } from './data/climate'
import { cumulativeAt, getSongs, type SongData } from './data/generate'
import { CUES, INTRO_TEXT, cueIndexAt, type Cue } from './data/narration'
import { REGIONS, REGION_BY_ID, songName, songTitle, type RegionId, type SongId } from './data/regions'
import { MONTH_COUNT, clampFrame, frameLabel, frameMonth, formatNumber } from './data/time'
import { MapView } from './map/MapView'
import { usePrefs, useReducedMotion, type Prefs } from './prefs'
import { clockReducer, initialClock, type ClockState } from './timeline/clock'
import styles from './App.module.css'

export default function App() {
  const { prefs, update } = usePrefs()
  return (
    <AnnouncerProvider voice={prefs.mode === 'audio' && prefs.builtInVoice}>
      {prefs.mode ? <Experience prefs={prefs} update={update} /> : <ModeGate onChoose={(mode) => update({ mode })} />}
    </AnnouncerProvider>
  )
}

type Stage = 'intro' | 'play'
type DialogId = 'settings' | 'help'

function monthSummary(song: SongData, aerosol: AerosolField, frame: number): string {
  const f = song.frames[clampFrame(frame)]
  const where = f.topProvince ? `, most in ${f.topProvince}` : ''
  const haze = describeHaze(aerosol.peaks[song.id][clampFrame(frame)])
  return `${frameLabel(frame)}: ${formatNumber(f.detections)} fire spots${where}. ${haze}.`
}

function Experience({ prefs, update }: { prefs: Prefs; update: (p: Partial<Prefs>) => void }) {
  const announce = useAnnounce()
  const reducedMotion = useReducedMotion()
  const audioMode = prefs.mode === 'audio'

  const [songs, setSongs] = useState<Record<SongId, SongData> | null>(null)
  const [song, setSong] = useState<SongId>('indonesia')
  const [clock, dispatch] = useReducer(clockReducer, initialClock)
  const [layers, setLayers] = useState<Layers>({ wildfire: true, aerosol: true, elnino: true, co2: true, co: true, rain: true })
  const [unlocked, setUnlocked] = useState(false)
  const [tour, setTour] = useState<Stage | null>(null)
  const [dialog, setDialog] = useState<DialogId | null>(null)
  const [holding, setHolding] = useState(false)
  const [endDismissed, setEndDismissed] = useState(false)

  const savedNational = useRef<ClockState | null>(null)
  const lastCue = useRef(-1)
  const lastMonth = useRef(-1)
  const playAfterTour = useRef(false)
  const holdTimer = useRef(0)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Generating ~10k dummy dots takes a moment; let the page paint first.
  useEffect(() => {
    const id = window.setTimeout(() => setSongs(getSongs()), 30)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (songs && !prefs.introTourDone && !tour && !dialog) setTour('intro')
  }, [songs, prefs.introTourDone, tour, dialog])

  const cues = CUES[song]
  const cueIdx = cueIndexAt(cues, clock.t)
  const data = songs?.[song]
  const frame = data?.frames[clampFrame(clock.t)]
  // The haze field is national; island views read the same grid, zoomed in.
  const aerosol = useMemo(() => (songs ? getAerosol(songs.indonesia.frames) : null), [songs])
  const climate = getClimate()

  // Playback loop.
  const running = clock.playing && !holding && !tour
  useEffect(() => {
    if (!running) return
    let raf = 0
    let prev = performance.now()
    const loop = (now: number) => {
      dispatch({ type: 'tick', dt: Math.min(0.1, (now - prev) / 1000) })
      prev = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const releaseHold = useCallback(() => {
    window.clearTimeout(holdTimer.current)
    setHolding(false)
  }, [])

  const narrate = useCallback(
    (cue: Cue, index: number, hold: boolean) => {
      if (audioMode) {
        const message = `Chapter ${index + 1}: ${cue.title}. ${cue.text}`
        announce(message)
        if (hold) {
          setHolding(true)
          window.clearTimeout(holdTimer.current)
          holdTimer.current = window.setTimeout(() => setHolding(false), readingSeconds(message) * 1000)
        }
      } else if (prefs.narrationVoice) {
        speak(`${cue.title}. ${cue.text}`)
      }
    },
    [announce, audioMode, prefs.narrationVoice],
  )

  // Narration fires when playback crosses into a new chapter.
  useEffect(() => {
    if (!clock.playing || lastCue.current === cueIdx) return
    lastCue.current = cueIdx
    narrate(cues[cueIdx], cueIdx, true)
  }, [clock.playing, cueIdx, cues, narrate])

  // Audio mode: spoken map summary every January and at seasonal peaks.
  const month = clampFrame(clock.t)
  useEffect(() => {
    if (!audioMode || !clock.playing || !data || !aerosol || lastMonth.current === month) return
    lastMonth.current = month
    if (cues.some((c) => c.frame === month)) return
    const d = data.frames
    const peak = Math.max(...d.map((f) => f.detections))
    const isPeak =
      d[month].detections >= 0.5 * peak &&
      d[month].detections >= (d[month - 1]?.detections ?? 0) &&
      d[month].detections >= (d[month + 1]?.detections ?? 0)
    if (frameMonth(month) === 0 || isPeak) announce(monthSummary(data, aerosol, month))
  }, [audioMode, clock.playing, month, data, aerosol, cues, announce])

  // Song end.
  useEffect(() => {
    if (!clock.ended || !data) return
    stopSpeaking()
    setEndDismissed(false)
    const ari = data.cumulativeAri[MONTH_COUNT]
    const ha = data.cumulativeHectares[MONTH_COUNT]
    announce(
      `The end. From 2018 to 2025 in ${songName(song)}, ${formatNumber(ari)} people were treated for acute respiratory infections, and ${formatNumber(ha)} hectares of land burned.`,
    )
  }, [clock.ended, data, song, announce])

  // Built-in voice: speak whatever receives focus (region labels announce their own stats).
  useEffect(() => {
    if (!audioMode || !prefs.builtInVoice) return
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('[data-tour="map"]')) return
      const name = el.getAttribute('aria-label') ?? el.textContent?.trim()
      if (name) speak(name.slice(0, 200))
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [audioMode, prefs.builtInVoice])

  useEffect(() => () => stopSpeaking(), [])

  const play = useCallback(() => {
    if (!unlocked) {
      setUnlocked(true)
      if (!prefs.playTourDone) {
        playAfterTour.current = true
        setTour('play')
        return
      }
    }
    if (clock.ended) lastCue.current = -1
    dispatch({ type: 'play' })
  }, [unlocked, prefs.playTourDone, clock.ended])

  const togglePlay = useCallback(() => {
    if (clock.playing) {
      dispatch({ type: 'pause' })
      releaseHold()
      stopSpeaking()
    } else {
      play()
    }
  }, [clock.playing, play, releaseHold])

  function finishTour() {
    const stage = tour
    setTour(null)
    if (stage === 'intro') update({ introTourDone: true })
    if (stage === 'play') {
      update({ playTourDone: true })
      if (playAfterTour.current) {
        playAfterTour.current = false
        dispatch({ type: 'play' })
      }
    }
  }

  function seek(t: number) {
    releaseHold()
    lastCue.current = cueIndexAt(cues, t)
    dispatch({ type: 'seek', t })
  }

  function step(months: number) {
    releaseHold()
    const t = Math.min(Math.max(Math.floor(clock.t) + months, 0), MONTH_COUNT - 1)
    dispatch({ type: 'step', months })
    if (data && aerosol) announce(monthSummary(data, aerosol, t))
  }

  // Narrates the chapter landed on, immediately if playing, otherwise once playback resumes.
  function chapter(dir: -1 | 1) {
    releaseHold()
    stopSpeaking()
    dispatch({ type: 'chapter', dir, frames: cues.map((c) => c.frame) })
    lastCue.current = -1
  }

  function openRegion(id: RegionId) {
    if (song === id) return
    if (song === 'indonesia') savedNational.current = { ...clock, playing: false }
    releaseHold()
    stopSpeaking()
    setSong(id)
    setEndDismissed(false)
    lastCue.current = -1
    lastMonth.current = -1
    dispatch({ type: 'restore', state: { ...initialClock, speed: clock.speed } })
    announce(`${REGION_BY_ID[id].name}. 96 months, 2018 to 2025. Press Space to play.`)
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  function backToIndonesia() {
    if (song === 'indonesia') return
    releaseHold()
    stopSpeaking()
    const restored = savedNational.current ?? initialClock
    setSong('indonesia')
    setEndDismissed(false)
    lastCue.current = cueIndexAt(CUES.indonesia, restored.t)
    lastMonth.current = -1
    dispatch({ type: 'restore', state: { ...restored, playing: false, speed: clock.speed } })
    announce(`Back to Indonesia, ${frameLabel(restored.t)}. Press Space to play.`)
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  function exploreRegion(id: RegionId) {
    if (!songs || !aerosol) return
    const f = songs[id].frames[clampFrame(clock.t)]
    const peak = f.peakFrp ? `, strongest fire ${Math.round(f.peakFrp)} megawatts` : ''
    const haze = describeHaze(aerosol.peaks[id][clampFrame(clock.t)])
    announce(
      `${REGION_BY_ID[id].name}, ${frameLabel(clock.t)}: ${formatNumber(f.detections)} fire spots${peak}. ${haze}. Press Enter to open.`,
    )
  }

  function toggleLayer(id: LayerId) {
    const on = !layers[id]
    setLayers((l) => ({ ...l, [id]: on }))
    announce(`${LAYER_NAMES[id]} layer ${on ? 'on' : 'muted'}.`)
  }

  // Global keyboard shortcuts. A ref keeps the listener stable while reading fresh state.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e: KeyboardEvent) => {
    if (tour || dialog || e.ctrlKey || e.metaKey || e.altKey) return
    const target = e.target as HTMLElement
    const inField = !!target.closest('input:not([type="range"]), textarea, select')
    const onControl = !!target.closest('button, a, [role="switch"]')
    if (inField) return
    const region = REGIONS.find((r) => r.key === e.key)
    if (region) {
      e.preventDefault()
      openRegion(region.id)
      return
    }
    switch (e.key) {
      case ' ':
        if (onControl) return
        e.preventDefault()
        if (holding) releaseHold()
        else togglePlay()
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        if (target.closest('input')) return
        e.preventDefault()
        step(e.key === 'ArrowRight' ? 1 : -1)
        break
      case 'Escape':
        backToIndonesia()
        break
      case 'n':
      case 'N':
        narrate(cues[cueIdx], cueIdx, clock.playing)
        break
      case '?':
        setDialog('help')
        break
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!songs || !data || !frame || !aerosol) {
    return (
      <div className={styles.loading} role="status">
        Preparing eight years of fire data…
      </div>
    )
  }

  const national = song === 'indonesia'
  const ari = cumulativeAt(data.cumulativeAri, clock.t)
  const hectares = cumulativeAt(data.cumulativeHectares, clock.t)
  const showEnd = clock.ended && !endDismissed

  return (
    <div className={styles.app} data-unlocked={unlocked || undefined} data-ended={showEnd || undefined}>
      <a className={styles.skip} href="#player">
        Skip to player
      </a>

      <header className={styles.header}>
        <div className={styles.topbar}>
          {!national && (
            <button type="button" className="link" onClick={backToIndonesia} aria-keyshortcuts="Escape">
              ← Back to Indonesia
            </button>
          )}
          <nav className={styles.nav} aria-label="Tools" data-tour="help">
            <a
              className="link"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Project repository on GitHub (opens in new tab)"
            >
              Repository ↗
            </a>
            <button type="button" className="link" onClick={() => setDialog('help')} aria-keyshortcuts="?">
              Help
            </button>
            <button type="button" className="link" onClick={() => setDialog('settings')}>
              Settings
            </button>
          </nav>
        </div>
        <div className={styles.titleBlock}>
          <h1 key={song} ref={titleRef} tabIndex={-1} className={`${styles.title} appear`}>
            {songTitle(song)}
          </h1>
          {/* Always rendered so it can collapse smoothly; hidden from AT while collapsed. */}
          <div className={styles.introWrap} data-hidden={(unlocked && national) || undefined} aria-hidden={(unlocked && national) || undefined}>
            <p key={song} className={`${styles.intro} appear`}>
              {national ? INTRO_TEXT : REGION_BY_ID[song].blurb}
            </p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {unlocked && (
          <NarrationPanel
            cue={cues[cueIdx]}
            index={cueIdx}
            count={cues.length}
            ari={ari}
            hectares={hectares}
            scope={songName(song)}
          />
        )}
        <section className={styles.mapArea} aria-label={`Fire map of ${songName(song)}, ${frameLabel(clock.t)}`}>
          <MapView
            song={song}
            frames={data.frames}
            t={clock.t}
            wildfireOn={layers.wildfire}
            aerosol={aerosol}
            smokeOn={layers.aerosol}
            reducedMotion={reducedMotion}
            onOpenRegion={openRegion}
            onExploreRegion={exploreRegion}
          />
        </section>
        {/* Top-right: the month first, sound-layer switches beneath it. */}
        <div className={styles.side}>
          <p className={styles.date} aria-hidden="true">
            {frameLabel(clock.t)}
          </p>
          {unlocked && (
            <div className={styles.sideLayers}>
              <SoundLayers
                layers={layers}
                frames={data.frames}
                aerosolPeaks={aerosol.peaks[song]}
                climate={climate}
                t={clock.t}
                playing={running}
                reducedMotion={reducedMotion}
                onToggle={toggleLayer}
              />
            </div>
          )}
        </div>
      </main>

      <footer className={styles.bottom}>
        <div className={styles.bottomSide}>{unlocked && <Legend />}</div>
        <Player
          clock={clock}
          songLabel={`${songName(song)}'s fire story`}
          cues={cues}
          holding={holding}
          onToggle={togglePlay}
          onSeek={seek}
          onChapter={chapter}
        />
        {/* Empty, keeps the side columns equal so the player stays centred. */}
        <div className={styles.bottomSide} />
      </footer>

      {showEnd && (
        <EndOverlay
          scope={songName(song)}
          ari={data.cumulativeAri[MONTH_COUNT]}
          hectares={data.cumulativeHectares[MONTH_COUNT]}
          national={national}
          reducedMotion={reducedMotion}
          onReplay={() => {
            setEndDismissed(true)
            lastCue.current = -1
            dispatch({ type: 'play' })
          }}
          onExplore={() => {
            setEndDismissed(true)
            if (national) {
              requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-tour="map"] button[tabindex="0"]')?.focus())
            } else {
              backToIndonesia()
            }
          }}
        />
      )}

      {tour && !audioMode && (
        <Tour key={tour} steps={tour === 'intro' ? INTRO_STEPS : PLAY_STEPS} label={tour === 'intro' ? 'Welcome tour' : 'Player tour'} onDone={finishTour} />
      )}
      {tour && audioMode && <AudioGuide key={tour} stage={tour} onDone={finishTour} />}

      <SettingsDialog open={dialog === 'settings'} prefs={prefs} onChange={update} onClose={() => setDialog(null)} />
      <HelpDialog
        open={dialog === 'help'}
        onClose={() => setDialog(null)}
        onReplay={(stage) => {
          setDialog(null)
          if (stage === 'play') setUnlocked(true)
          setTour(stage)
        }}
      />
    </div>
  )
}

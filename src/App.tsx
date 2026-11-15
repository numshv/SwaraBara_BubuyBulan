import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { AnnouncerProvider, useAnnounce } from './a11y/Announcer'
import { speak, stopSpeaking } from './a11y/speech'
import { REPO_URL } from './config'
import { HelpDialog, SettingsDialog } from './components/Dialogs'
import { EndOverlay } from './components/EndOverlay'
import { AudioGuide } from './components/Guides'
import { Legend } from './components/Legend'
import { ModeGate } from './components/ModeGate'
import { NarrationPanel } from './components/NarrationPanel'
import { Player } from './components/Player'
import { Splash } from './components/Splash'
import { LAYER_NAMES, SoundLayers, type LayerId, type Layers } from './components/SoundLayers'
import { INTRO_STEPS, PLAY_STEPS, Tour } from './components/Tour'
import { describeHaze, getAerosol, type AerosolField } from './data/aerosol'
import { getClimate, type ClimateSeries } from './data/climate'
import { getCo, type CoField } from './data/co'
import { loadSongs, type SongData } from './data/generate'
import { CUES, INTRO_TEXT, cueIndexAt, type Cue } from './data/narration'
import { REGIONS, REGION_BY_ID, songName, songTitle, type RegionId, type SongId } from './data/regions'
import { MONTH_COUNT, clampFrame, frameLabel, frameMonth, formatNumber } from './data/time'
import { MapView } from './map/MapView'
import { audioEngine } from './sound/audioEngine'
import { narrationUrl, sliceIndexAt, toggleLinkedLayers } from './sound/manifest'
import { glide } from './sound/meters'
import { usePrefs, useReducedMotion, type Prefs } from './prefs'
import { clockReducer, initialClock, type ClockState } from './timeline/clock'
import styles from './App.module.css'

export default function App() {
  const { prefs, update } = usePrefs()
  const [splash, setSplash] = useState(!prefs.splashSeen)
  const endSplash = useCallback(() => {
    setSplash(false)
    update({ splashSeen: true })
    // update is recreated every render; only the first call matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (splash) return <Splash onDone={endSplash} />
  return (
    <AnnouncerProvider voice={prefs.mode === 'audio'}>
      {prefs.mode ? <Experience prefs={prefs} update={update} /> : <ModeGate onChoose={(mode) => update({ mode })} />}
    </AnnouncerProvider>
  )
}

type Stage = 'intro' | 'play'
type DialogId = 'settings' | 'help'

function monthSummary(song: SongData, aerosol: AerosolField, co: CoField, climate: ClimateSeries, frame: number): string {
  const i = clampFrame(frame)
  const f = song.frames[i]
  const where = f.topProvince ? `, most in ${f.topProvince}` : ''
  const haze = describeHaze(aerosol.peaks[song.id][i])
  const sign = (v: number) => `${v > 0 ? 'plus ' : v < 0 ? 'minus ' : ''}${Math.abs(v).toFixed(1)}`
  return `${frameLabel(frame)}: ${formatNumber(f.detections)} fire spots${where}. ${haze}. Carbon monoxide ${Math.round(co.values[song.id][i])} ppb. ENSO ${sign(climate.enso[i])}, IOD ${sign(climate.iod[i])}.`
}

function Experience({ prefs, update }: { prefs: Prefs; update: (p: Partial<Prefs>) => void }) {
  const announce = useAnnounce()
  const reducedMotion = useReducedMotion()
  const audioMode = prefs.mode === 'audio'

  const [songs, setSongs] = useState<Record<SongId, SongData> | null>(null)
  const [song, setSong] = useState<SongId>('indonesia')
  const [clock, dispatch] = useReducer(clockReducer, initialClock)
  const [layers, setLayers] = useState<Layers>({ wildfire: true, aerosol: true, elnino: true, iod: true, co: true })
  const [unlocked, setUnlocked] = useState(false)
  const [tour, setTour] = useState<Stage | null>(null)
  const [dialog, setDialog] = useState<DialogId | null>(null)
  const [holding, setHolding] = useState(false)
  const [endDismissed, setEndDismissed] = useState(false)
  const [seekSeq, setSeekSeq] = useState(0)

  const savedNational = useRef<ClockState | null>(null)
  const lastCue = useRef(-1)
  const lastMonth = useRef(-1)
  const playAfterTour = useRef(false)
  const latestT = useRef(clock.t)
  latestT.current = clock.t
  const latestSpeed = useRef(clock.speed)
  latestSpeed.current = clock.speed
  const latestLayers = useRef(layers)
  latestLayers.current = layers
  const titleRef = useRef<HTMLHeadingElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLElement>(null)
  // The legend floats up over the narration column; keep the narration clear of its real height.
  const [legendClearance, setLegendClearance] = useState<number | null>(null)
  useLayoutEffect(() => {
    const legend = legendRef.current?.firstElementChild
    const footer = footerRef.current
    if (!legend || !footer) return
    const measure = () => {
      const over = legend.getBoundingClientRect().height - footer.getBoundingClientRect().height
      setLegendClearance(Math.max(0, Math.ceil(over)) + 24)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(legend)
    ro.observe(footer)
    return () => ro.disconnect()
  }, [unlocked, songs])

  // The VIIRS fire file loads as its own chunk; the page paints first.
  useEffect(() => {
    let alive = true
    void loadSongs().then((s) => {
      if (alive) setSongs(s)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (songs && !prefs.introTourDone && !tour && !dialog) setTour('intro')
  }, [songs, prefs.introTourDone, tour, dialog])

  const cues = CUES[song]
  const cueIdx = cueIndexAt(cues, clock.t)
  const sliceIdx = sliceIndexAt(song, clock.t)
  const data = songs?.[song]
  const frame = data?.frames[clampFrame(clock.t)]
  // The haze field is national; island views read the same grid, zoomed in.
  const aerosol = useMemo(() => (songs ? getAerosol() : null), [songs])
  const climate = getClimate()
  const co = useMemo(() => (songs ? getCo() : null), [songs])

  const handleSliceEnd = useCallback(
    (endFrame: number) => {
      audioEngine.stopStems()
      if (endFrame >= MONTH_COUNT) {
        const hasClosingCue = cues.some((c) => c.frame >= MONTH_COUNT)
        if (hasClosingCue && lastCue.current < cues.length - 1) {
          dispatch({ type: 'seek', t: MONTH_COUNT })
        } else {
          dispatch({ type: 'tick', dt: MONTH_COUNT })
        }
      } else {
        dispatch({ type: 'seek', t: endFrame })
      }
    },
    [cues],
  )

  // Playback loop synchronized to active Web Audio stem clock.
  const running = clock.playing && !holding && !tour
  useEffect(() => {
    if (!running) return
    let raf = 0
    let prev = performance.now()
    const loop = (now: number) => {
      const sync = audioEngine.getSyncState()
      if (sync) {
        if (!sync.loading) {
          if (sync.sliceEnded) {
            handleSliceEnd(sync.endFrame)
          } else {
            dispatch({ type: 'seek', t: sync.t })
          }
        }
      } else if (latestT.current < MONTH_COUNT) {
        dispatch({ type: 'tick', dt: Math.min(0.1, (now - prev) / 1000) })
      }
      prev = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, handleSliceEnd])

  // Start the 6 synchronized stems for the current slice whenever active playback runs.
  useEffect(() => {
    if (!running) {
      audioEngine.stopStems()
      return
    }
    if (latestT.current >= MONTH_COUNT) {
      audioEngine.stopStems()
      const hasClosingCue = cues.some((c) => c.frame >= MONTH_COUNT)
      if (!hasClosingCue || lastCue.current >= cues.length - 1) {
        dispatch({ type: 'tick', dt: MONTH_COUNT })
      }
      return
    }
    void audioEngine.playSliceStems(
      song,
      sliceIdx,
      latestT.current,
      latestSpeed.current,
      latestLayers.current,
      handleSliceEnd,
    )
    return () => audioEngine.stopStems()
  }, [running, song, sliceIdx, seekSeq, cues, handleSliceEnd])

  // Keep stem mutes and playback rate synced live without restarting stems.
  useEffect(() => {
    audioEngine.setLayers(layers)
  }, [layers])

  useEffect(() => {
    audioEngine.setSpeed(clock.speed)
  }, [clock.speed])

  const releaseHold = useCallback(() => {
    audioEngine.stopNarration()
    setHolding(false)
  }, [])

  const narrate = useCallback(
    (cue: Cue, index: number, hold: boolean) => {
      audioEngine.stopStems()
      audioEngine.preloadSlice(song, index)
      const spoken = `${cue.title}. ${cue.text}`
      if (audioMode) {
        announce(`Chapter ${index + 1}: ${spoken}`)
      }
      if (hold) setHolding(true)
      audioEngine.playNarration(
        narrationUrl(song, index),
        spoken,
        audioMode || prefs.narrationVoice,
        () => {
          if (hold) setHolding(false)
        },
      )
    },
    [announce, audioMode, prefs.narrationVoice, song],
  )

  // Narration fires when playback crosses into a new chapter (pause stems during narration).
  useEffect(() => {
    if (!clock.playing || lastCue.current === cueIdx) return
    lastCue.current = cueIdx
    narrate(cues[cueIdx], cueIdx, true)
  }, [clock.playing, cueIdx, cues, narrate])

  // Audio mode: spoken map summary every January and at seasonal peaks.
  const month = clampFrame(clock.t)
  useEffect(() => {
    if (!audioMode || !clock.playing || !data || !aerosol || !co || lastMonth.current === month) return
    lastMonth.current = month
    if (cues.some((c) => c.frame === month)) return
    const d = data.frames
    const peak = Math.max(...d.map((f) => f.detections))
    const isPeak =
      d[month].detections >= 0.5 * peak &&
      d[month].detections >= (d[month - 1]?.detections ?? 0) &&
      d[month].detections >= (d[month + 1]?.detections ?? 0)
    if (frameMonth(month) === 0 || isPeak) announce(monthSummary(data, aerosol, co, climate, month))
  }, [audioMode, clock.playing, month, data, aerosol, co, climate, cues, announce])

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
    if (!audioMode) return
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('[data-tour="map"]')) return
      const name = el.getAttribute('aria-label') ?? el.textContent?.trim()
      if (name) speak(name.slice(0, 200))
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [audioMode])

  useEffect(() => () => audioEngine.stopAll(), [])

  const play = useCallback(() => {
    audioEngine.unlock()
    if (!unlocked) {
      setUnlocked(true)
      if (!prefs.playTourDone) {
        playAfterTour.current = true
        setTour('play')
        return
      }
    }
    if (clock.ended || clock.t >= MONTH_COUNT) lastCue.current = -1
    dispatch({ type: 'play' })
  }, [unlocked, prefs.playTourDone, clock.ended, clock.t])

  const togglePlay = useCallback(() => {
    if (clock.playing) {
      dispatch({ type: 'pause' })
      releaseHold()
      audioEngine.stopAll()
    } else {
      play()
    }
  }, [clock.playing, play, releaseHold])

  // Set while "Show onboarding again" runs the intro tour, then the player tour, then the shortcut list.
  const replaying = useRef(false)

  function replayOnboarding() {
    replaying.current = true
    playAfterTour.current = false
    releaseHold()
    audioEngine.stopAll()
    dispatch({ type: 'pause' })
    setDialog(null)
    setUnlocked(true)
    setTour('intro')
  }

  function finishTour() {
    const stage = tour
    setTour(null)
    if (stage === 'intro') {
      update({ introTourDone: true })
      if (replaying.current) setTour('play')
    }
    if (stage === 'play') {
      update({ playTourDone: true })
      if (playAfterTour.current) {
        playAfterTour.current = false
        audioEngine.unlock()
        dispatch({ type: 'play' })
      }
      if (replaying.current) {
        replaying.current = false
        // The audio guide already lists the shortcuts; the visual tour doesn't.
        if (!audioMode) setDialog('help')
      }
    }
  }

  function seek(t: number) {
    audioEngine.unlock()
    releaseHold()
    lastCue.current = cueIndexAt(cues, t)
    dispatch({ type: 'seek', t })
    setSeekSeq((s) => s + 1)
  }

  function step(months: number) {
    audioEngine.unlock()
    releaseHold()
    const t = Math.min(Math.max(Math.floor(clock.t) + months, 0), MONTH_COUNT - 1)
    dispatch({ type: 'step', months })
    setSeekSeq((s) => s + 1)
    if (data && aerosol && co) announce(monthSummary(data, aerosol, co, climate, t))
  }

  // Narrates the chapter landed on, immediately if playing, otherwise once playback resumes.
  function chapter(dir: -1 | 1) {
    audioEngine.unlock()
    releaseHold()
    audioEngine.stopAll()
    dispatch({ type: 'chapter', dir, frames: cues.map((c) => c.frame) })
    lastCue.current = -1
  }

  function openRegion(id: RegionId) {
    if (song === id) return
    if (song === 'indonesia') savedNational.current = { ...clock, playing: false }
    releaseHold()
    audioEngine.stopAll()
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
    audioEngine.stopAll()
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
    const next = toggleLinkedLayers(layers, id)
    setLayers(next)
    audioEngine.setLayers(next)
    const on = next[id]
    if (id === 'elnino' || id === 'iod') {
      announce(`El Niño and IOD (Jenglong) ${on ? 'on' : 'muted'}.`)
    } else {
      announce(`${LAYER_NAMES[id]} layer ${on ? 'on' : 'muted'}.`)
    }
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
        audioEngine.unlock()
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
        audioEngine.unlock()
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

  if (!songs || !data || !frame || !aerosol || !co) {
    return (
      <div className={styles.loading} role="status">
        <img src="/spaceappslogo.png" alt="NASA Space Apps Challenge" className={styles.loadingLogo} />
        <p className={styles.loadingText}>Preparing eight years of NASA satellite data…</p>
      </div>
    )
  }

  const national = song === 'indonesia'
  const showEnd = clock.ended && !endDismissed

  return (
    <div
      className={styles.app}
      data-unlocked={unlocked || undefined}
      data-ended={showEnd || undefined}
      style={legendClearance === null ? undefined : ({ '--legend-clearance': `${legendClearance}px` } as CSSProperties)}
    >
      <a className={styles.skip} href="#player">
        Skip to player
      </a>

      <header className={styles.header}>
        <div className={styles.topbar}>
          <div className={styles.topLeft}>
            <img src="/spaceappslogo.png" alt="NASA Space Apps Challenge" className={styles.brandLogo} />
            {!national && (
              <button type="button" className="link" onClick={backToIndonesia} aria-keyshortcuts="Escape">
                ← Back to Indonesia
              </button>
            )}
          </div>
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
            {national ? (
              <>
                Swara Bara{' '}
                <span className={styles.tagline}>
                  — listening to Indonesia&apos;s wildfires, <span className={styles.nowrap}>2018–2025</span>
                </span>
              </>
            ) : (
              songTitle(song)
            )}
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
            scope={songName(song)}
            reducedMotion={reducedMotion}
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
            co={co}
            coOn={layers.co}
            dramatic={true}
            oceans={{
              enso: layers.elnino ? glide(climate.enso, clock.t) : null,
              iod: layers.iod ? glide(climate.iod, clock.t) : null,
            }}
            reducedMotion={reducedMotion}
            onOpenRegion={openRegion}
            onExploreRegion={exploreRegion}
          />
        </section>
        {/* Top-right, only once the music has started: the month first, sound-layer switches beneath it. */}
        {unlocked && (
          <div className={styles.side}>
            <p className={styles.date} aria-hidden="true">
              {frameLabel(clock.t)}
            </p>
            <div className={styles.sideLayers}>
              <SoundLayers
                layers={layers}
                frames={data.frames}
                aot={aerosol.series[song]}
                co={co.values[song]}
                climate={climate}
                t={clock.t}
                playing={running}
                reducedMotion={reducedMotion}
                onToggle={toggleLayer}
              />
            </div>
          </div>
        )}
      </main>

      <footer ref={footerRef} className={styles.bottom}>
        {/* The legend floats over the bottom-left corner, so it never takes height from the map. */}
        <div ref={legendRef} className={`${styles.bottomSide} ${styles.legendSlot}`}>{unlocked && <Legend />}</div>
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
            audioEngine.unlock()
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

      <SettingsDialog
        open={dialog === 'settings'}
        prefs={prefs}
        onChange={update}
        onReplayOnboarding={replayOnboarding}
        onClose={() => setDialog(null)}
      />
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

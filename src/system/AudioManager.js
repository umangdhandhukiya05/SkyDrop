export default class AudioManager {
  constructor(experience) {
    this.experience = experience
    this.ctx = null
    this.masterGain = null
    this.isMuted = false
    this.masterVolume = 0.85

    // Procedural noise buffer
    this.noiseBuffer = null

    // Engine sound state
    this.engineGain = null
    this.engineOscSub = null
    this.engineOscSaw = null
    this.engineFilter = null
    this.engineChopLfo = null
    this.engineChopGain = null
    this.engineNoiseSource = null
    this.engineNoiseGain = null
    this.isEngineRunning = false

    // Diving wind sound state
    this.windGain = null
    this.windSource = null
    this.windBPFilter = null
    this.windLPFilter = null
    this.whistleOsc = null
    this.whistleGain = null
    this.isWindRunning = false

    this._setupUserGestureUnlock()
  }

  _setupUserGestureUnlock() {
    const unlock = () => {
      this.ensureContext()
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
    }

    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true, passive: true })
    window.addEventListener('touchstart', unlock, { once: true, passive: true })
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return null
      this.ctx = new AudioContextClass()

      // Master bus
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime)
      this.masterGain.connect(this.ctx.destination)

      // Generate reusable 3-second noise buffer
      this.noiseBuffer = this._generateNoiseBuffer(3.0)
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    return this.ctx
  }

  _generateNoiseBuffer(durationSeconds) {
    if (!this.ctx) return null
    const sampleRate = this.ctx.sampleRate
    const bufferSize = Math.floor(sampleRate * durationSeconds)
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate)
    const data = buffer.getChannelData(0)

    // Pinkish/white noise with smooth wraparound for seamless looping
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      const pink = b0 + b1 + b2 + white * 0.5362
      data[i] = pink * 0.16
    }
    return buffer
  }

  toggleMute() {
    this.isMuted = !this.isMuted
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : this.masterVolume
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime)
      this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.05)
    }
    this._updateMuteUI()
    return this.isMuted
  }

  _updateMuteUI() {
    const btn = document.getElementById('audio-toggle-btn')
    const icon = document.getElementById('audio-icon')
    if (btn) {
      if (this.isMuted) {
        btn.classList.add('muted')
        btn.setAttribute('title', 'Unmute Sound (M)')
      } else {
        btn.classList.remove('muted')
        btn.setAttribute('title', 'Mute Sound (M)')
      }
    }
    if (icon) {
      if (this.isMuted) {
        // SVG: Volume Mute / X (feather volume-x)
        icon.innerHTML = `<svg class="audio-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="22" y1="9" x2="16" y2="15"></line><line x1="16" y1="9" x2="22" y2="15"></line></svg>`
      } else {
        // SVG: Volume High / Active Sound Waves (feather volume-2)
        icon.innerHTML = `<svg class="audio-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 1. AIRPLANE ENGINE & TAKEOFF SOUND SYSTEM
  // ═════════════════════════════════════════════════════════════════════════
  startPlaneEngine() {
    const ctx = this.ensureContext()
    if (!ctx || this.isEngineRunning) return

    this.isEngineRunning = true
    const now = ctx.currentTime

    // Engine Master Node
    this.engineGain = ctx.createGain()
    this.engineGain.gain.setValueAtTime(0.001, now)
    // Smooth initial engine spool-up
    this.engineGain.gain.exponentialRampToValueAtTime(0.42, now + 1.2)
    this.engineGain.connect(this.masterGain)

    // Sub rumble oscillator (propeller cylinder ignition pulses)
    this.engineOscSub = ctx.createOscillator()
    this.engineOscSub.type = 'sawtooth'
    this.engineOscSub.frequency.setValueAtTime(48, now)

    // Mid harmonic oscillator (airframe & engine casing vibration)
    this.engineOscSaw = ctx.createOscillator()
    this.engineOscSaw.type = 'triangle'
    this.engineOscSaw.frequency.setValueAtTime(96, now)

    // Engine Low-pass filter (muffles raw harsh saw into deep engine purr)
    this.engineFilter = ctx.createBiquadFilter()
    this.engineFilter.type = 'lowpass'
    this.engineFilter.frequency.setValueAtTime(260, now)
    this.engineFilter.Q.setValueAtTime(2.5, now)

    // Propeller Chop Amplitude Modulator (LFO)
    this.engineChopGain = ctx.createGain()
    this.engineChopGain.gain.setValueAtTime(0.7, now)

    this.engineChopLfo = ctx.createOscillator()
    this.engineChopLfo.type = 'sine'
    this.engineChopLfo.frequency.setValueAtTime(16, now) // 16 Hz idle propeller chop

    // LFO controls chop gain depth
    const chopDepth = ctx.createGain()
    chopDepth.gain.setValueAtTime(0.3, now)
    this.engineChopLfo.connect(chopDepth)
    chopDepth.connect(this.engineChopGain.gain)

    // Connect oscillators -> filter -> chop -> engine master
    this.engineOscSub.connect(this.engineFilter)
    this.engineOscSaw.connect(this.engineFilter)
    this.engineFilter.connect(this.engineChopGain)
    this.engineChopGain.connect(this.engineGain)

    // Propeller Slipstream Air Wash (filtered noise)
    if (this.noiseBuffer) {
      this.engineNoiseSource = ctx.createBufferSource()
      this.engineNoiseSource.buffer = this.noiseBuffer
      this.engineNoiseSource.loop = true

      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.setValueAtTime(320, now)
      noiseFilter.Q.setValueAtTime(1.2, now)

      this.engineNoiseGain = ctx.createGain()
      this.engineNoiseGain.gain.setValueAtTime(0.12, now)

      this.engineNoiseSource.connect(noiseFilter)
      noiseFilter.connect(this.engineNoiseGain)
      this.engineNoiseGain.connect(this.engineGain)
      this.engineNoiseSource.start(now)
    }

    this.engineOscSub.start(now)
    this.engineOscSaw.start(now)
    this.engineChopLfo.start(now)
  }

  updatePlaneEngine(flightTime) {
    if (!this.ctx || !this.isEngineRunning || !this.engineGain) return

    const now = this.ctx.currentTime
    // Runway acceleration (0 to 4.5s) and liftoff climb (4.5 to 10s)
    const prog = Math.min(1.0, flightTime / 9.0)

    // Frequency accelerates with plane velocity
    const subFreq = THREE_MathLerp(48, 86, prog)
    const sawFreq = THREE_MathLerp(96, 172, prog)
    const chopRate = THREE_MathLerp(16, 38, prog)
    const filterCutoff = THREE_MathLerp(260, 680, prog)
    const volume = THREE_MathLerp(0.42, 0.65, prog)

    this.engineOscSub.frequency.setTargetAtTime(subFreq, now, 0.1)
    this.engineOscSaw.frequency.setTargetAtTime(sawFreq, now, 0.1)
    this.engineChopLfo.frequency.setTargetAtTime(chopRate, now, 0.1)
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.1)
    this.engineGain.gain.setTargetAtTime(volume, now, 0.15)
  }

  fadePlaneEngine(duration = 2.5) {
    if (!this.ctx || !this.isEngineRunning || !this.engineGain) return

    const now = this.ctx.currentTime
    // Ramp volume down to zero as plane recedes in the distance
    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now)
    this.engineGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    if (this.engineFilter) {
      // Muffle high frequencies into the distance
      this.engineFilter.frequency.setTargetAtTime(120, now, 0.5)
    }

    setTimeout(() => {
      this._stopPlaneEngine()
    }, duration * 1000 + 100)
  }

  _stopPlaneEngine() {
    this.isEngineRunning = false
    try {
      if (this.engineOscSub) { this.engineOscSub.stop(); this.engineOscSub.disconnect() }
      if (this.engineOscSaw) { this.engineOscSaw.stop(); this.engineOscSaw.disconnect() }
      if (this.engineChopLfo) { this.engineChopLfo.stop(); this.engineChopLfo.disconnect() }
      if (this.engineNoiseSource) { this.engineNoiseSource.stop(); this.engineNoiseSource.disconnect() }
    } catch (e) {}
    this.engineOscSub = null
    this.engineOscSaw = null
    this.engineChopLfo = null
    this.engineNoiseSource = null
    this.engineGain = null
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 2. CABIN JUMP / EJECTION WHOOSH
  // ═════════════════════════════════════════════════════════════════════════
  playJumpWhoosh() {
    const ctx = this.ensureContext()
    if (!ctx || !this.noiseBuffer) return

    const now = ctx.currentTime

    // Filtered noise rush
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1400, now)
    bp.frequency.exponentialRampToValueAtTime(320, now + 0.85)
    bp.Q.setValueAtTime(2.0, now)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.7, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)

    src.connect(bp)
    bp.connect(gain)
    gain.connect(this.masterGain)

    src.start(now)
    src.stop(now + 0.9)
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 3. DYNAMIC AERODYNAMIC DIVING WIND SYSTEM
  // ═════════════════════════════════════════════════════════════════════════
  startDivingWind() {
    const ctx = this.ensureContext()
    if (!ctx || this.isWindRunning || !this.noiseBuffer) return

    this.isWindRunning = true
    const now = ctx.currentTime

    // Master Wind Gain
    this.windGain = ctx.createGain()
    this.windGain.gain.setValueAtTime(0.001, now)
    this.windGain.gain.linearRampToValueAtTime(0.35, now + 0.4)
    this.windGain.connect(this.masterGain)

    // Wind Noise Source
    this.windSource = ctx.createBufferSource()
    this.windSource.buffer = this.noiseBuffer
    this.windSource.loop = true

    // Highpass to eliminate low frequency mud
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(85, now)

    // Resonant Bandpass for aerodynamic whistling rush
    this.windBPFilter = ctx.createBiquadFilter()
    this.windBPFilter.type = 'bandpass'
    this.windBPFilter.frequency.setValueAtTime(650, now)
    this.windBPFilter.Q.setValueAtTime(1.8, now)

    // Dynamic Lowpass for atmospheric roar
    this.windLPFilter = ctx.createBiquadFilter()
    this.windLPFilter.type = 'lowpass'
    this.windLPFilter.frequency.setValueAtTime(1600, now)

    // High velocity aerodynamic slipstream whistle
    this.whistleOsc = ctx.createOscillator()
    this.whistleOsc.type = 'sine'
    this.whistleOsc.frequency.setValueAtTime(800, now)

    this.whistleGain = ctx.createGain()
    this.whistleGain.gain.setValueAtTime(0.015, now)

    this.whistleOsc.connect(this.whistleGain)
    this.whistleGain.connect(this.windGain)

    // Chain: Noise -> HP -> BP + LP -> WindGain
    this.windSource.connect(hp)
    hp.connect(this.windBPFilter)
    hp.connect(this.windLPFilter)
    this.windBPFilter.connect(this.windGain)
    this.windLPFilter.connect(this.windGain)

    this.windSource.start(now)
    this.whistleOsc.start(now)
  }

  updateDivingWind(fallSpeedAbs, forwardSpeedAbs, isParachuteOpen) {
    if (!this.ctx || !this.isWindRunning || !this.windGain) return

    const now = this.ctx.currentTime

    if (isParachuteOpen) {
      // Gentle calm flutter under parachute canopy
      this.windGain.gain.setTargetAtTime(0.12, now, 0.25)
      this.windLPFilter.frequency.setTargetAtTime(450, now, 0.25)
      this.windBPFilter.frequency.setTargetAtTime(320, now, 0.25)
      this.whistleGain.gain.setTargetAtTime(0.0001, now, 0.2)
      return
    }

    // Freefall aerodynamics:
    // fallSpeed ranges from ~6.0 m/s (S brake) up to ~28.0 m/s (dive forward W / Space)
    const speedRatio = Math.max(0, Math.min(1.0, (fallSpeedAbs - 6.0) / 22.0))

    // Wind roar volume swells from 0.22 up to 0.72
    const targetGain = THREE_MathLerp(0.22, 0.72, speedRatio)

    // Filter sweeps up: higher frequency whistle & crisp roar as velocity surges
    const targetBPFreq = THREE_MathLerp(450, 1400, speedRatio)
    const targetLPFreq = THREE_MathLerp(900, 3600, speedRatio)

    // Aerodynamic whistle frequency and intensity
    const whistleFreq = THREE_MathLerp(650, 1350, speedRatio)
    const whistleVol = THREE_MathLerp(0.005, 0.045, speedRatio)

    this.windGain.gain.setTargetAtTime(targetGain, now, 0.08)
    this.windBPFilter.frequency.setTargetAtTime(targetBPFreq, now, 0.08)
    this.windLPFilter.frequency.setTargetAtTime(targetLPFreq, now, 0.08)
    this.whistleOsc.frequency.setTargetAtTime(whistleFreq, now, 0.08)
    this.whistleGain.gain.setTargetAtTime(whistleVol, now, 0.08)
  }

  stopDivingWind(fadeDuration = 0.4) {
    if (!this.ctx || !this.isWindRunning || !this.windGain) return

    const now = this.ctx.currentTime
    this.windGain.gain.setValueAtTime(this.windGain.gain.value, now)
    this.windGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration)

    setTimeout(() => {
      this.isWindRunning = false
      try {
        if (this.windSource) { this.windSource.stop(); this.windSource.disconnect() }
        if (this.whistleOsc) { this.whistleOsc.stop(); this.whistleOsc.disconnect() }
      } catch (e) {}
      this.windSource = null
      this.whistleOsc = null
      this.windGain = null
    }, fadeDuration * 1000 + 80)
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 4. PARACHUTE OPENING AUDIO (CANOPY SNAP, INFLATION & AIR POP)
  // ═════════════════════════════════════════════════════════════════════════
  playParachuteDeploy() {
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime

    // 1. High Velocity Fabric Snap / Crack
    if (this.noiseBuffer) {
      const snapSrc = ctx.createBufferSource()
      snapSrc.buffer = this.noiseBuffer

      const snapHp = ctx.createBiquadFilter()
      snapHp.type = 'highpass'
      snapHp.frequency.setValueAtTime(1600, now)

      const snapGain = ctx.createGain()
      snapGain.gain.setValueAtTime(0.001, now)
      snapGain.gain.linearRampToValueAtTime(0.75, now + 0.015)
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

      snapSrc.connect(snapHp)
      snapHp.connect(snapGain)
      snapGain.connect(this.masterGain)

      snapSrc.start(now)
      snapSrc.stop(now + 0.18)
    }

    // 2. Heavy Low-Frequency Inflation Thump (catching air violently)
    const thumpOsc = ctx.createOscillator()
    thumpOsc.type = 'triangle'
    thumpOsc.frequency.setValueAtTime(145, now)
    thumpOsc.frequency.exponentialRampToValueAtTime(36, now + 0.28)

    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(0.65, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

    thumpOsc.connect(thumpGain)
    thumpGain.connect(this.masterGain)

    thumpOsc.start(now)
    thumpOsc.stop(now + 0.35)

    // 3. Trailing Fabric Flutter Pop
    setTimeout(() => {
      if (!this.ctx || !this.noiseBuffer) return
      const tNow = this.ctx.currentTime
      const flutSrc = this.ctx.createBufferSource()
      flutSrc.buffer = this.noiseBuffer

      const flutBp = this.ctx.createBiquadFilter()
      flutBp.type = 'bandpass'
      flutBp.frequency.setValueAtTime(800, tNow)
      flutBp.Q.setValueAtTime(2.0, tNow)

      const flutGain = this.ctx.createGain()
      flutGain.gain.setValueAtTime(0.35, tNow)
      flutGain.gain.exponentialRampToValueAtTime(0.001, tNow + 0.28)

      flutSrc.connect(flutBp)
      flutBp.connect(flutGain)
      flutGain.connect(this.masterGain)

      flutSrc.start(tNow)
      flutSrc.stop(tNow + 0.3)
    }, 120)
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 5. RING COLLECTION REWARD CHIME
  // ═════════════════════════════════════════════════════════════════════════
  playRingChime() {
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Ascending celebratory arpeggio: C5 -> E5 -> G5 -> C6
    const freqs = [523.25, 659.25, 783.99, 1046.50]

    freqs.forEach((freq, idx) => {
      const noteTime = now + idx * 0.05

      // Harmonic dual oscillator (sine + triangle for rich bell sparkle)
      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq, noteTime)

      const osc2 = ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(freq * 2.0, noteTime) // Octave shimmer overtone

      const noteGain = ctx.createGain()
      noteGain.gain.setValueAtTime(0, noteTime)
      noteGain.gain.linearRampToValueAtTime(0.24, noteTime + 0.015)
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.42)

      const overtoneGain = ctx.createGain()
      overtoneGain.gain.setValueAtTime(0.08, noteTime)
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25)

      osc1.connect(noteGain)
      osc2.connect(overtoneGain)
      overtoneGain.connect(noteGain)
      noteGain.connect(this.masterGain)

      osc1.start(noteTime)
      osc1.stop(noteTime + 0.45)
      osc2.start(noteTime)
      osc2.stop(noteTime + 0.45)
    })
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 6. TOUCHDOWN IMPACT & LANDING CELEBRATION
  // ═════════════════════════════════════════════════════════════════════════
  playTouchdown(isBullseye = false, isTargetHit = true) {
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime

    // 1. Solid Ground Touchdown Impact Thump
    const impactOsc = ctx.createOscillator()
    impactOsc.type = 'triangle'
    impactOsc.frequency.setValueAtTime(110, now)
    impactOsc.frequency.exponentialRampToValueAtTime(26, now + 0.22)

    const impactGain = ctx.createGain()
    impactGain.gain.setValueAtTime(0.55, now)
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    impactOsc.connect(impactGain)
    impactGain.connect(this.masterGain)

    impactOsc.start(now)
    impactOsc.stop(now + 0.28)

    // 2. Touchdown Turf/Gravel Scuff Rustle
    if (this.noiseBuffer) {
      const scuffSrc = ctx.createBufferSource()
      scuffSrc.buffer = this.noiseBuffer

      const scuffLp = ctx.createBiquadFilter()
      scuffLp.type = 'lowpass'
      scuffLp.frequency.setValueAtTime(450, now)

      const scuffGain = ctx.createGain()
      scuffGain.gain.setValueAtTime(0.4, now)
      scuffGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

      scuffSrc.connect(scuffLp)
      scuffLp.connect(scuffGain)
      scuffGain.connect(this.masterGain)

      scuffSrc.start(now)
      scuffSrc.stop(now + 0.24)
    }

    // 3. Victory Landing Fanfare (ONLY when landing on target!)
    if (isTargetHit) {
      setTimeout(() => {
        if (!this.ctx) return
        this._playLandingFanfare(isBullseye)
      }, 280)
    } else {
      // Subdued tone for target miss / game over
      setTimeout(() => {
        if (!this.ctx) return
        this._playMissTone()
      }, 280)
    }
  }

  _playMissTone() {
    if (!this.ctx) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.45)

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(280, now)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.5)
  }

  _playLandingFanfare(isBullseye) {
    if (!this.ctx) return
    const now = this.ctx.currentTime

    // Triumphant landing chords
    const chord = isBullseye
      ? [523.25, 659.25, 783.99, 1046.50, 1318.51] // C Major 9 Bullseye
      : [440.00, 554.37, 659.25, 880.00]          // A Major Landing

    chord.forEach((freq, idx) => {
      const noteTime = now + idx * 0.08
      const osc = this.ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, noteTime)

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0, noteTime)
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.85)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(noteTime)
      osc.stop(noteTime + 0.9)
    })
  }
}

function THREE_MathLerp(x, y, t) {
  return (1 - t) * x + t * y
}


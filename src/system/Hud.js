import * as THREE from 'three'

// Screen-space guidance: off-screen-aware markers for the next ring and the landing target,
// context hints, jump/chute prompts, speed and live score
export default class Hud {
  constructor(experience) {
    this.experience = experience

    this.ringMarker = document.getElementById('ring-marker')
    this.ringMarkerDist = this.ringMarker?.querySelector('.marker-dist')
    this.targetMarker = document.getElementById('target-marker')
    this.targetMarkerDist = this.targetMarker?.querySelector('.marker-dist')
    this.hintEl = document.getElementById('hud-hint')
    this.speedEl = document.getElementById('hud-speed')
    this.scoreEl = document.getElementById('hud-score')
    this.jumpPrompt = document.getElementById('jump-prompt')
    this.jumpBar = document.getElementById('jump-prompt-bar')
    this.jumpCount = document.getElementById('jump-prompt-count')
    this.chutePrompt = document.getElementById('chute-prompt')
    this.flashEl = document.getElementById('screen-flash')
    this.controlsCard = document.getElementById('hud-controls-card')

    // Controls card auto-collapses after this many seconds of flight
    this.controlsAutoHide = 10
    this.flightTime = 0
    this.controlsTouched = false

    this._projected = new THREE.Vector3()
    this._hint = ''
  }

  showJumpCountdown(visible, secondsLeft = 0, remainingRatio = 1) {
    if (!this.jumpPrompt) return
    this.jumpPrompt.classList.toggle('visible', visible)
    if (this.jumpCount) this.jumpCount.innerText = Math.max(1, Math.ceil(secondsLeft))
    if (this.jumpBar) this.jumpBar.style.transform = `scaleX(${remainingRatio})`
  }

  showChutePrompt(visible) {
    if (this.chutePrompt) this.chutePrompt.classList.toggle('visible', visible)
  }

  setHint(text) {
    if (!this.hintEl || text === this._hint) return
    this._hint = text
    this.hintEl.classList.remove('animate')
    this.hintEl.innerText = text
    void this.hintEl.offsetWidth
    if (text) this.hintEl.classList.add('animate')
  }

  flash() {
    if (!this.flashEl) return
    this.flashEl.classList.remove('animate')
    void this.flashEl.offsetWidth
    this.flashEl.classList.add('animate')
  }

  hideMarkers() {
    this.ringMarker?.classList.remove('visible')
    this.targetMarker?.classList.remove('visible')
  }

  // Places a marker over a world position; clamps to the screen edge (with an arrow) when off-screen
  _placeMarker(el, distEl, worldPos, distance) {
    if (!el) return
    const camera = this.experience.camera.instance
    const { width, height } = this.experience.sizes

    this._projected.copy(worldPos).project(camera)
    const behind = this._projected.z > 1
    let x = this._projected.x
    let y = this._projected.y
    if (behind) {
      x = -x
      y = -y
    }

    // Tighter vertical margin leaves room for the distance readout under the icon
    const marginX = 0.9
    const marginY = 0.78
    const offscreen = behind || Math.abs(x) > marginX || Math.abs(y) > marginY
    if (offscreen) {
      const scale = 1 / Math.max(Math.abs(x) / marginX, Math.abs(y) / marginY, 0.0001)
      x *= scale
      y *= scale
    }

    const px = (x * 0.5 + 0.5) * width
    const py = (-y * 0.5 + 0.5) * height
    el.style.transform = `translate(${px}px, ${py}px)`
    el.classList.add('visible')
    el.classList.toggle('offscreen', offscreen)
    el.style.setProperty('--arrow-angle', `${Math.atan2(-y, x) + Math.PI / 2}rad`)
    if (distEl) distEl.innerText = `${Math.round(distance)} m`
  }

  update() {
    const world = this.experience.world
    const character = world?.character
    if (!character || character.state !== 'playable') {
      this.hideMarkers()
      return
    }

    // Controls card: collapse automatically once, then H toggles freely
    const controls = this.experience.controls
    this.flightTime += this.experience.time.delta
    if (this.controlsCard) {
      if (controls && controls.wasPressed('toggleControls')) {
        this.controlsTouched = true
        this.controlsCard.classList.toggle('collapsed')
      } else if (!this.controlsTouched && this.flightTime >= this.controlsAutoHide) {
        this.controlsTouched = true
        this.controlsCard.classList.add('collapsed')
      }
    }

    const charPos = character.group.position
    const rings = world.rings
    const nextRing = rings ? rings.getNextRing() : null

    if (nextRing && !character.isParachuteOpen) {
      this._placeMarker(this.ringMarker, this.ringMarkerDist, nextRing.center, charPos.distanceTo(nextRing.center))
    } else {
      this.ringMarker?.classList.remove('visible')
    }

    // Landing target becomes the focus once rings are done or the chute is out
    if (!nextRing || character.isParachuteOpen) {
      const dist = Math.hypot(charPos.x - character.targetPos.x, charPos.z - character.targetPos.z)
      this._placeMarker(this.targetMarker, this.targetMarkerDist, character.targetPos, dist)
    } else {
      this.targetMarker?.classList.remove('visible')
    }

    // Speed (km/h) and live score
    if (this.speedEl) this.speedEl.innerText = `${Math.round(character.velocity.length() * 3.6)} km/h`
    if (this.scoreEl) {
      const pts = (rings ? rings.getRingPoints() : 0) + (character.chuteBonus || 0)
      this.scoreEl.innerText = `${pts} PTS`
    }

    // Context hints
    if (controls && !controls.mouse.isPointerLocked) {
      this.setHint('Click the screen to capture mouse / trackpad steering')
    } else if (character.isParachuteOpen) {
      this.setHint('Steer onto the bullseye  ·  SHIFT to flare')
    } else if (nextRing) {
      this.setHint('Dive through the glowing rings')
    } else {
      this.setHint('Head for the landing target')
    }
  }
}

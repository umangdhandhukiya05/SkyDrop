import * as THREE from 'three'
import ringUrl from '../assets/models/skyDrop_ring.glb?url'

export default class Rings {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.loader = experience.loader

    this.group = new THREE.Group()
    this.group.name = 'Diving_Rings'
    this.scene.add(this.group)

    this.ringTemplate = null
    this.rings = []
    this.totalRings = 3
    this.collectedCount = 0
    this.pointsPerRing = 10
    this.ringDefinitions = []

    this._audioCtx = null

    // Diver's hands-off glide (m/s) — rings are laid along this slope
    this.glideForward = 12.0
    this.glideFall = 14.6

    this.glowGroup = new THREE.Group()
    this.glowGroup.name = 'Diving_Ring_Glows'
    this.scene.add(this.glowGroup)
    this.glowMaterial = this._createGlowMaterial()

    this._load()
  }

  _createGlowMaterial() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255, 230, 140, 1)')
    g.addColorStop(0.25, 'rgba(255, 170, 0, 0.75)')
    g.addColorStop(1, 'rgba(255, 120, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.SpriteMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: false,
      fog: false
    })
  }

  async _load() {
    try {
      const gltf = await this.loader.loadGLTF(ringUrl)
      this.ringTemplate = gltf.scene

      // 100% solid, fully opaque, normal visibility - zero transparency!
      this.ringTemplate.traverse((child) => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
            mat.side = THREE.DoubleSide
            mat.depthWrite = true
            mat.depthTest = true
            mat.transparent = false
            mat.opacity = 1.0

            // Normal, clean, bright solid arcade materials
            if (mat.name && mat.name.toLowerCase().includes('orange')) {
              mat.emissive = new THREE.Color(0xff4400)
              mat.emissiveIntensity = 0.7
            } else {
              mat.emissive = new THREE.Color(0xffcc00)
              mat.emissiveIntensity = 0.5
            }
          })
        }
      })

      this._spawnRings()
      console.log(`✅ ${this.rings.length} Diving stunt rings spawned along flight route`)
    } catch (err) {
      console.error('❌ Failed to load skyDrop_ring.glb:', err)
    }
  }

  _generateRingDefinitions(dropPos) {
    // Rings sit on the line a hands-off diver naturally glides along from the jump point,
    // so holding course (with small corrections) threads every ring
    const count = Math.random() < 0.5 ? 3 : 4
    this.totalRings = count
    this.ringDefinitions = []

    const jumpPos = dropPos ? dropPos.clone() : new THREE.Vector3(660, 956, 0)
    const target = new THREE.Vector3(0, jumpPos.y, 0)
    const dir = new THREE.Vector3().subVectors(target, jumpPos).setY(0).normalize()
    const side = new THREE.Vector3(-dir.z, 0, dir.x)

    // Neutral freefall: ~12 m/s forward, ~14.6 m/s down (see Character playable update)
    const forwardPerMetreDrop = this.glideForward / this.glideFall

    // Altitudes spread from shortly after exit down to just above chute height
    const altitudes = count === 3 ? [800, 600, 400] : [820, 660, 500, 340]

    altitudes.forEach((alt, idx) => {
      const drop = jumpPos.y - alt
      const along = drop * forwardPerMetreDrop
      // Gentle alternating side offset keeps it interesting but always within an easy correction
      const lateral = idx === 0 ? 0 : (idx % 2 === 0 ? 1 : -1) * 7
      const pos = new THREE.Vector3()
        .copy(jumpPos)
        .addScaledVector(dir, along)
        .addScaledVector(side, lateral)
      pos.y = alt
      this.ringDefinitions.push({ id: idx + 1, pos, dir: dir.clone(), scale: 8.0 })
    })
  }

  _spawnRings(dropPos) {
    if (dropPos) this.dropPos = dropPos.clone()
    if (!this.ringTemplate) return

    // Clear old rings if re-spawning
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
    while (this.glowGroup.children.length > 0) {
      this.glowGroup.remove(this.glowGroup.children[0])
    }
    this.rings = []
    this.collectedCount = 0
    this.prevCharPos = null

    this._generateRingDefinitions(this.dropPos)

    this.ringDefinitions.forEach((def, index) => {
      const ringRoot = this.ringTemplate.clone(true)
      ringRoot.position.copy(def.pos)
      ringRoot.scale.setScalar(def.scale)

      // Hole (local Z) faces straight down the glide path so the diver flies cleanly through
      const glideVel = new THREE.Vector3().copy(def.dir).multiplyScalar(this.glideForward).setY(-this.glideFall)
      ringRoot.lookAt(new THREE.Vector3().addVectors(def.pos, glideVel))

      // Guarantee 100% solid opacity across all child meshes
      ringRoot.traverse((child) => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((m) => {
            m.transparent = false
            m.opacity = 1.0
            m.depthWrite = true
            m.depthTest = true
          })
        }
      })

      // Add warm point light inside the ring hole
      const beaconLight = new THREE.PointLight(0xffaa00, 2.5, 55)
      ringRoot.add(beaconLight)

      this.group.add(ringRoot)

      // Constant-screen-size glow so rings are easy to spot from far away
      const glow = new THREE.Sprite(this.glowMaterial)
      glow.position.copy(def.pos)
      glow.scale.setScalar(0.09)
      this.glowGroup.add(glow)

      this.rings.push({
        id: def.id,
        root: ringRoot,
        light: beaconLight,
        glow,
        center: def.pos.clone(),
        radius: 18.0, // Generous collection radius (ring hole is 16 m)
        collected: false,
        missed: false,
        pulseTime: index * 0.8,
        collectAnimTime: 0
      })
    })

    this.updateHUD()
  }

  update(delta, charPos) {
    if (!charPos || this.rings.length === 0) return

    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i]

      if (!ring.collected) {
        // ── 1. ROBUST INSTANTANEOUS & SWEPT HIT DETECTION ──
        const dist = charPos.distanceTo(ring.center)
        const horizDist = Math.hypot(charPos.x - ring.center.x, charPos.z - ring.center.z)
        const vertDist = Math.abs(charPos.y - ring.center.y)

        let isHit = (dist <= ring.radius) || (horizDist <= ring.radius && vertDist <= ring.radius)

        // Swept segment check between previous frame and current frame (catches high-speed dives)
        if (!isHit && this.prevCharPos) {
          const seg = new THREE.Vector3().subVectors(charPos, this.prevCharPos)
          const segLenSq = seg.lengthSq()
          if (segLenSq > 0.001) {
            const toCenter = new THREE.Vector3().subVectors(ring.center, this.prevCharPos)
            const t = THREE.MathUtils.clamp(toCenter.dot(seg) / segLenSq, 0.0, 1.0)
            const closestPoint = new THREE.Vector3().copy(this.prevCharPos).addScaledVector(seg, t)
            if (closestPoint.distanceTo(ring.center) <= ring.radius) {
              isHit = true
            }
          }
        }

        if (isHit) {
          this._collectRing(ring)
          continue
        }

        // Only mark missed when character has descended FAR below the ring (> 25m below)
        if (!ring.missed && charPos.y < (ring.center.y - 25.0)) {
          ring.missed = true
          if (ring.light) ring.light.intensity = 0.2
          if (ring.glow) ring.glow.visible = false
        }

        if (!ring.missed) {
          // Idle animation: gentle spin and subtle warm pulse
          ring.pulseTime += delta
          ring.root.rotateZ(delta * 0.4)
          if (ring.light) {
            ring.light.intensity = 2.0 + Math.sin(ring.pulseTime * 3.5) * 0.6
          }
        }
      }
    }

    // The next ring to fly through pulses bigger so the route reads at a glance
    const next = this.getNextRing()
    for (const ring of this.rings) {
      if (!ring.glow || !ring.glow.visible) continue
      const pulse = ring === next ? 0.12 + Math.sin(ring.pulseTime * 4.0) * 0.025 : 0.07
      ring.glow.scale.setScalar(pulse)
    }

    // Save previous character position for swept collision detection on next tick
    if (!this.prevCharPos) this.prevCharPos = new THREE.Vector3()
    this.prevCharPos.copy(charPos)
  }

  _collectRing(ring) {
    if (ring.collected) return // Prevent any duplicate trigger
    ring.collected = true
    this.collectedCount++
    ring.root.visible = false
    if (ring.glow) ring.glow.visible = false

    // Play arcade chime
    this._playChime()

    // Show floating on-screen popup
    this._showCollectPopup(`+${this.pointsPerRing} PTS RING COLLECTED!`)

    // Update HUD telemetry immediately
    this.updateHUD()

    // Screen flash + camera punch for tactile feedback
    if (this.experience.hud) this.experience.hud.flash()
    if (this.experience.camera) this.experience.camera.kick(0.6)

    console.log(`🎯 RING ${ring.id} COLLECTED! (${this.collectedCount} / ${this.totalRings}) -> +${this.getRingPoints()} PTS`)
  }

  _playChime() {
    try {
      if (this.experience.audio) {
        this.experience.audio.playRingChime()
        return
      }

      if (!this._audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        this._audioCtx = new AudioContext()
      }
      if (this._audioCtx.state === 'suspended') {
        this._audioCtx.resume()
      }

      const now = this._audioCtx.currentTime
      const freqs = [523.25, 659.25, 783.99, 1046.50]
      freqs.forEach((freq, idx) => {
        const osc = this._audioCtx.createOscillator()
        const gain = this._audioCtx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.05)

        gain.gain.setValueAtTime(0, now + idx * 0.05)
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.05 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35)

        osc.connect(gain)
        gain.connect(this._audioCtx.destination)
        osc.start(now + idx * 0.05)
        osc.stop(now + idx * 0.05 + 0.38)
      })
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  _showCollectPopup(text) {
    const el = document.getElementById('ring-popup')
    if (!el) return

    el.innerText = text
    el.classList.remove('animate')
    // Trigger reflow to restart CSS animation
    void el.offsetWidth
    el.classList.add('animate')
  }

  updateHUD() {
    const hudRings = document.getElementById('hud-rings')
    if (hudRings) {
      hudRings.innerText = `${this.collectedCount} / ${this.totalRings} (+${this.getRingPoints()} PTS)`
    }
  }

  getNextRing() {
    return this.rings.find((ring) => !ring.collected && !ring.missed) || null
  }

  getRingPoints() {
    return this.collectedCount * this.pointsPerRing
  }

  reset() {
    this._spawnRings()
  }

  clear() {
    this.dropPos = null
    this.group.clear()
    this.glowGroup.clear()
    this.rings = []
    this.collectedCount = 0
    this.updateHUD()
  }

  shiftBy(offset) {
    for (const ring of this.rings) {
      ring.root.position.add(offset)
      ring.center.add(offset)
      if (ring.glow) ring.glow.position.add(offset)
    }
  }

  spawnAlong(dropPos) {
    this._spawnRings(dropPos)
  }
}


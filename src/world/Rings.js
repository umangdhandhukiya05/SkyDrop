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

    this._load()
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

  _generateRingDefinitions() {
    // Procedural ring placement: randomly spawn 3 or 4 rings along flight corridor
    const count = Math.random() < 0.5 ? 3 : 4
    this.totalRings = count
    this.ringDefinitions = []

    // Actual drop position from plane at 10s takeoff: (532, 960, 137)
    const jumpPos = new THREE.Vector3(532, 960, 137)
    const targetPos = new THREE.Vector3(0, 22.8, 0)

    if (count === 3) {
      // 3 Rings evenly spaced along freefall glide path (730m, 520m, 320m)
      const configs = [
        { progress: 0.24, baseAlt: 730, jitterY: 20, jitterXZ: 20 },
        { progress: 0.52, baseAlt: 520, jitterY: 20, jitterXZ: 22 },
        { progress: 0.78, baseAlt: 320, jitterY: 20, jitterXZ: 20 }
      ]
      configs.forEach((cfg, idx) => {
        const posX = THREE.MathUtils.lerp(jumpPos.x, targetPos.x, cfg.progress) + (Math.random() - 0.5) * cfg.jitterXZ
        const posY = cfg.baseAlt + (Math.random() - 0.5) * cfg.jitterY
        const posZ = THREE.MathUtils.lerp(jumpPos.z, targetPos.z, cfg.progress) + (Math.random() - 0.5) * cfg.jitterXZ
        this.ringDefinitions.push({
          id: idx + 1,
          pos: new THREE.Vector3(Math.round(posX), Math.round(posY), Math.round(posZ)),
          scale: 7.0
        })
      })
    } else {
      // 4 Rings distributed along freefall descent (780m, 615m, 440m, 280m)
      const configs = [
        { progress: 0.18, baseAlt: 780, jitterY: 18, jitterXZ: 18 },
        { progress: 0.40, baseAlt: 615, jitterY: 18, jitterXZ: 20 },
        { progress: 0.63, baseAlt: 440, jitterY: 18, jitterXZ: 20 },
        { progress: 0.84, baseAlt: 280, jitterY: 18, jitterXZ: 18 }
      ]
      configs.forEach((cfg, idx) => {
        const posX = THREE.MathUtils.lerp(jumpPos.x, targetPos.x, cfg.progress) + (Math.random() - 0.5) * cfg.jitterXZ
        const posY = cfg.baseAlt + (Math.random() - 0.5) * cfg.jitterY
        const posZ = THREE.MathUtils.lerp(jumpPos.z, targetPos.z, cfg.progress) + (Math.random() - 0.5) * cfg.jitterXZ
        this.ringDefinitions.push({
          id: idx + 1,
          pos: new THREE.Vector3(Math.round(posX), Math.round(posY), Math.round(posZ)),
          scale: 7.0
        })
      })
    }
  }

  _spawnRings() {
    if (!this.ringTemplate) return

    // Clear old rings if re-spawning
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
    this.rings = []
    this.collectedCount = 0
    this.prevCharPos = null

    this._generateRingDefinitions()

    const targetPos = new THREE.Vector3(0, 22.8, 0)

    this.ringDefinitions.forEach((def, index) => {
      const ringRoot = this.ringTemplate.clone(true)
      ringRoot.position.copy(def.pos)
      ringRoot.scale.setScalar(def.scale)

      // Aim ring square towards incoming flyer from jump point
      const dirToTarget = new THREE.Vector3().subVectors(targetPos, def.pos).normalize()
      const lookPos = new THREE.Vector3().addVectors(def.pos, dirToTarget)
      ringRoot.lookAt(lookPos)
      ringRoot.rotateX(-0.15)

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

      this.rings.push({
        id: def.id,
        root: ringRoot,
        light: beaconLight,
        center: def.pos.clone(),
        radius: 16.0, // Large generous collection radius (diameter 32m)
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

        let isHit = (dist <= ring.radius) || (horizDist <= 16.0 && vertDist <= 16.0)

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

    // Save previous character position for swept collision detection on next tick
    if (!this.prevCharPos) this.prevCharPos = new THREE.Vector3()
    this.prevCharPos.copy(charPos)
  }

  _collectRing(ring) {
    if (ring.collected) return // Prevent any duplicate trigger
    ring.collected = true
    this.collectedCount++
    ring.root.visible = false

    // Play arcade chime
    this._playChime()

    // Show floating on-screen popup
    this._showCollectPopup(`+${this.pointsPerRing} PTS RING COLLECTED!`)

    // Update HUD telemetry immediately
    this.updateHUD()

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

  getRingPoints() {
    return this.collectedCount * this.pointsPerRing
  }

  reset() {
    this._spawnRings()
  }
}


import * as THREE from 'three'
import planeUrl from '../assets/models/skyDrop_plane.glb?url'

export default class Plane {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.loader = experience.loader

    this.propeller = null
    this.group = new THREE.Group()
    this.group.name = 'User_Plane'
    this.scene.add(this.group)

    // Runway centreline (fitted from the island model's runway edge lights): through (520, 440) at 140°.
    // Start sits on that line so the roll tracks dead-centre to the far end.
    this.runwayHeading = THREE.MathUtils.degToRad(140)
    this.currentHeading = this.runwayHeading

    this.startPos = new THREE.Vector3(427.0, 11.35, 550.84)
    this.group.position.copy(this.startPos)

    this.group.rotation.set(0, this.runwayHeading + Math.PI / 2, 0)

    // State: 'parked' → 'roll' (full runway) → 'climb' (climb-out + banked turn) → 'cruise' (drop run)
    this.state = 'parked'
    this.flightTime = 0
    this.airborneTime = 0
    this.speed = 0

    // Landing target the drop run heads for
    this.target = new THREE.Vector3(0, 0, 0)

    // Runway from the parked spot runs ~325 m along the heading; lift off near its far end
    this.flight = {
      rollLength: 295,
      rollTime: 6.5,
      rotateTime: 1.2,
      liftoffSpeed: (2 * 295) / 6.5, // ≈ 91 m/s at the end of the constant-acceleration roll
      climbOutTime: 2.5,
      turnSpeed: 98,
      maxTurnRate: 0.7,
      climbTime: 6.5,
      cruiseAltitude: 960,
      cruiseSpeed: 76
    }
    this.turnRate = 0
    this.pitch = 0
    this.bank = 0

    this._load()
  }
    
  async _load() {
    try {
      const gltf = await this.loader.loadGLTF(planeUrl)
      this.model = gltf.scene

      this.model.traverse((child) => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
            mat.needsUpdate = true
          })
        }
        if (child.name === 'SKY_Aircraft_Propeller') {
          this.propeller = child
        }
      })

      this.model.position.y = -0.55
      this.model.scale.setScalar(1.4)
      this.group.add(this.model)

      await this._addWingBranding()
    } catch (err) {
      console.warn('⚠️ Plane failed to load:', err)
    }
  }

  async _addWingBranding() {
    // Wait for Poppins so the canvas wordmark doesn't fall back to a system font
    try {
      await document.fonts.load('700 200px Poppins')
    } catch (e) {}

    // One centred wordmark across the wing
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    // White badge with Zignuts Vivid Blue wordmark
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 56)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#1490FE'
    ctx.stroke()

    ctx.fillStyle = '#1490FE'
    ctx.font = '700 190px Poppins, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '14px'
    ctx.fillText('ZIGNUTS', canvas.width / 2 + 7, canvas.height / 2 + 10)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.experience.renderer?.instance?.capabilities.getMaxAnisotropy() || 4

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.55,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    })

    // Wing (model space): chord x ∈ [-1.35, 0.25], span z ∈ [-5.5, 5.5], top y ≈ 2.2, bottom y ≈ 1.9.
    // Nose points to -X, so text runs toward -Z (reads left→right from behind the plane).
    const geometry = new THREE.PlaneGeometry(4.6, 0.92)
    const decals = [
      // Top surface — letters' top toward the nose
      { y: 2.215, right: [0, 0, -1], up: [-1, 0, 0] },
      // Under surface — visible from the ground and during the climb
      { y: 1.885, right: [0, 0, -1], up: [1, 0, 0] }
    ]

    decals.forEach(({ y, right, up }) => {
      const r = new THREE.Vector3(...right)
      const u = new THREE.Vector3(...up)
      const n = new THREE.Vector3().crossVectors(r, u)
      const decal = new THREE.Mesh(geometry, material)
      decal.name = 'Zignuts_Wing_Branding'
      decal.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n))
      decal.position.set(-0.55, y, 0)
      this.model.add(decal)
    })
  }

  startTakeoff() {
    this.state = 'roll'
    this.flightTime = 0
    this.airborneTime = 0
    this.speed = 0
    this.rollDistance = 0
    this.currentHeading = this.runwayHeading
    this.turnRate = 0
    this.pitch = 0
    this.bank = 0
    this.group.position.copy(this.startPos)
  }

  // Heading that points the nose at the landing target from the current position
  _headingToTarget() {
    return Math.atan2(this.target.x - this.group.position.x, this.target.z - this.group.position.z)
  }

  _applyAttitude() {
    // Yaw, then nose-up pitch, then bank about the nose axis (nose is model -X, so nose-up is -Z rotation)
    this.group.rotation.set(this.bank, this.currentHeading + Math.PI / 2, -this.pitch, 'YZX')
  }

  update(delta) {
    // Propeller idle/flight spin
    if (this.propeller) {
      const spinSpeed = this.state === 'parked' ? 0.35 : 3.0
      this.propeller.rotation.x += spinSpeed
    }

    if (this.state === 'parked') return

    this.flightTime += delta
    const t = this.flightTime
    const f = this.flight

    if (this.state === 'roll') {
      // Takeoff roll down the full runway: constant acceleration to rotation speed at the liftoff point
      const u = Math.min(1, t / f.rollTime)
      this.rollDistance = f.rollLength * u * u
      this.speed = (2 * f.rollLength * u) / f.rollTime

      const fX = Math.sin(this.runwayHeading)
      const fZ = Math.cos(this.runwayHeading)
      this.group.position.set(
        this.startPos.x + fX * this.rollDistance,
        this.startPos.y,
        this.startPos.z + fZ * this.rollDistance
      )

      // Rotation: nose comes up over the last stretch of the roll
      const rotateT = THREE.MathUtils.clamp((t - (f.rollTime - f.rotateTime)) / f.rotateTime, 0, 1)
      this.pitch = THREE.MathUtils.smoothstep(rotateT, 0, 1) * 0.16
      this.bank = 0
      this._applyAttitude()

      if (u >= 1) {
        this.state = 'climb'
        this.airborneTime = 0
      }
      return
    }

    // ── Airborne: climb out, fast banked climbing turn back over the island, then cruise ──
    this.airborneTime += delta
    const at = this.airborneTime

    // Altitude: gentle initial climb that steepens, then levels off exactly at drop altitude
    const climbU = Math.min(1, at / f.climbTime)
    const prevY = this.group.position.y
    const easedClimb = climbU * climbU * (3 - 2 * climbU)
    const newY = THREE.MathUtils.lerp(this.startPos.y, f.cruiseAltitude, easedClimb)

    if (this.state === 'climb') {
      this.speed = THREE.MathUtils.lerp(f.liftoffSpeed, f.turnSpeed, Math.min(1, at / 2))

      // After a short straight climb-out past the runway end, bank hard toward the target
      let targetTurnRate = 0
      if (at >= f.climbOutTime) {
        const diff = THREE.MathUtils.euclideanModulo(this._headingToTarget() - this.currentHeading + Math.PI, Math.PI * 2) - Math.PI
        targetTurnRate = THREE.MathUtils.clamp(diff * 2.2, -f.maxTurnRate, f.maxTurnRate)
      }
      this.turnRate = THREE.MathUtils.damp(this.turnRate, targetTurnRate, 3.5, delta)
      this.currentHeading += this.turnRate * delta

      if (climbU >= 1) {
        this.state = 'cruise'
        this.turnRate = 0
      }
    } else {
      // Cruise: straight and level over the ring corridor toward the target
      this.speed = THREE.MathUtils.damp(this.speed, f.cruiseSpeed, 1.5, delta)
      const diff = THREE.MathUtils.euclideanModulo(this._headingToTarget() - this.currentHeading + Math.PI, Math.PI * 2) - Math.PI
      this.turnRate = THREE.MathUtils.damp(this.turnRate, THREE.MathUtils.clamp(diff * 1.5, -0.3, 0.3), 3.0, delta)
      this.currentHeading += this.turnRate * delta
    }

    const fX = Math.sin(this.currentHeading)
    const fZ = Math.cos(this.currentHeading)
    this.group.position.x += fX * this.speed * delta
    this.group.position.z += fZ * this.speed * delta
    this.group.position.y = this.state === 'cruise' ? f.cruiseAltitude : newY

    // Attitude follows the flight path: pitch from climb angle, bank from turn rate
    const verticalSpeed = delta > 0 ? (this.group.position.y - prevY) / delta : 0
    const climbAngle = Math.atan2(verticalSpeed, Math.max(this.speed, 1))
    this.pitch = THREE.MathUtils.damp(this.pitch, THREE.MathUtils.clamp(climbAngle, 0, 0.42), 4.0, delta)
    this.bank = THREE.MathUtils.damp(this.bank, THREE.MathUtils.clamp(this.turnRate * 1.25, -0.85, 0.85), 5.0, delta)
    this._applyAttitude()
  }
}

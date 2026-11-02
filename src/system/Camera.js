import * as THREE from 'three'

export default class Camera {
  constructor(experience) {
    this.experience = experience
    this.sizes = experience.sizes
    this.scene = experience.scene
    this.canvas = experience.canvas
    this.time = experience.time

    // Mode: 'cinematic_menu', 'cinematic_takeoff', 'cinematic_dive', 'follow_skydiver'
    this.mode = 'cinematic_menu'

    // Smooth interpolated look-at target to eliminate camera shaking
    this.currentLookTarget = new THREE.Vector3()
    this.takeoffOffset = new THREE.Vector3()

    // PUBG 360° Free-Look offsets (when holding Alt or Right-Click)
    this.freeLookYaw = 0
    this.freeLookPitch = 0
    this.orbitIdle = 0
    this.orbitReturnDelay = 2.5
    this.recentering = false
    this.glideAngle = 0.5
    this.chuteBlend = 0
    this.chuteDistance = 13.5
    this.chutePitch = 0 // Vertical pitch angle under canopy (controllable via mouse / trackpad)

    // Chase distance behind the diver (freefall); canopy uses chuteDistance
    this.followDistance = 5.2

    // Camera punch (ring collect, chute snap) and speed-driven FOV
    this.shake = 0
    this.baseFov = 45

    this._createCamera()
    this._listenResize()
  }

  _createCamera() {
    this.instance = new THREE.PerspectiveCamera(
      45,
      this.sizes.aspect,
      0.5, // 0.5m near plane prevents Z-fighting
      8000
    )

    // Initial runway menu view
    this.basePosition = new THREE.Vector3(426.0, 12.7, 564.5)
    this.target = new THREE.Vector3(426.0, 12.3, 558.0)

    this.instance.position.copy(this.basePosition)
    this.instance.lookAt(this.target)

    this.scene.add(this.instance)
  }

  _listenResize() {
    this.sizes.addEventListener('resize', () => {
      this.instance.aspect = this.sizes.aspect
      this.instance.updateProjectionMatrix()
    })
  }

  setMode(mode) {
    this.mode = mode
    const world = this.experience.world

    if (mode === 'cinematic_takeoff') {
      if (world && world.plane) {
        this.currentLookTarget.copy(world.plane.group.position)
        // Start the chase offset from wherever the menu camera currently is
        this.takeoffOffset.subVectors(this.instance.position, world.plane.group.position)
      }
    } else if (mode === 'follow_skydiver') {
      this.freeLookYaw = 0
      this.freeLookPitch = 0
      this.chutePitch = 0
      this.chuteBlend = 0
      this.orbitIdle = this.orbitReturnDelay

      if (world && world.character) {
        const char = world.character
        const charPos = char.group.position
        const heading = char.headingAngle

        const dist = 5.2
        const height = 1.6

        this.instance.position.set(
          charPos.x - Math.sin(heading) * dist,
          charPos.y + height,
          charPos.z - Math.cos(heading) * dist
        )
        this.instance.lookAt(charPos.x, charPos.y + 0.9, charPos.z)
      }
    }
  }

  kick(amount) {
    this.shake = Math.min(1.2, this.shake + amount)
  }

  update() {
    const delta = this.experience.time.delta
    const world = this.experience.world
    if (!world || !world.plane || !world.character) return

    const plane = world.plane
    const character = world.character
    const controls = this.experience.controls

    if (this.mode === 'cinematic_menu') {
      // Subtle cinematic camera sway on runway
      const t = this.time.elapsed * 0.4
      this.instance.position.x = this.basePosition.x + Math.sin(t) * 0.15
      this.instance.position.y = this.basePosition.y + Math.cos(t * 0.7) * 0.08
      this.instance.position.z = this.basePosition.z + Math.cos(t) * 0.12
      this.instance.lookAt(this.target)
    } else if (this.mode === 'cinematic_takeoff') {
      // High-angle chase locked to the plane. Only the framing offset is smoothed, so the plane
      // stays centred even during the very fast climb (~200 m/s vertical) — lerping the absolute
      // position used to leave the camera below the plane and lose it for several seconds.
      const planePos = plane.group.position
      const heading = plane.currentHeading !== undefined ? plane.currentHeading : plane.runwayHeading

      const takeoffProgress = Math.min(1.0, plane.flightTime / 3.0)
      const climbProgress = plane.state === 'roll' ? 0 : THREE.MathUtils.clamp(plane.airborneTime / 2.0, 0, 1)
      const topElevation = THREE.MathUtils.lerp(18.0, 38.0, takeoffProgress) - climbProgress * 6.0
      const trailOffset = THREE.MathUtils.lerp(6.0, 10.0, takeoffProgress) + climbProgress * 8.0

      const desiredOffset = new THREE.Vector3(
        -Math.sin(heading) * trailOffset,
        topElevation,
        -Math.cos(heading) * trailOffset
      )
      const smoothFactor = 1.0 - Math.exp(-4.0 * delta)
      this.takeoffOffset.lerp(desiredOffset, smoothFactor)
      this.instance.position.copy(planePos).add(this.takeoffOffset)

      this.currentLookTarget.set(
        planePos.x + Math.sin(heading) * 6.0,
        planePos.y,
        planePos.z + Math.cos(heading) * 6.0
      )
      this.instance.lookAt(this.currentLookTarget)
    } else if (this.mode === 'follow_skydiver') {
      const charPos = character.group.position

      // ── 360° Orbit Look & Vertical Pitch Control ─────────────────────────
      // In canopy flight, vertical mouse movement directly pitches the camera downwards
      // to easily spot and line up the landing target and rings.
      let orbitInput = false
      if (controls) {
        const mouseDelta = controls.getMouseDelta()
        const wheel = controls.getWheelDelta()

        // Two-finger swipe / wheel adjusts look orbit
        if (wheel.deltaX !== 0 || wheel.deltaY !== 0) {
          this.freeLookYaw += wheel.deltaX * 0.004
          if (character.isParachuteOpen) {
            this.chutePitch += wheel.deltaY * 0.003
            this.chutePitch = THREE.MathUtils.clamp(this.chutePitch, -0.65, 0.95)
          } else {
            this.freeLookPitch += wheel.deltaY * 0.003
          }
          orbitInput = true
        }

        if (controls.keys.freeLook) {
          // Alt / RMB Free Look: yaw orbits around character without turning character heading
          this.freeLookYaw -= mouseDelta.x * 0.004
          if (character.isParachuteOpen) {
            this.chutePitch += mouseDelta.y * 0.0035
            this.chutePitch = THREE.MathUtils.clamp(this.chutePitch, -0.65, 0.95)
          } else {
            this.freeLookPitch += mouseDelta.y * 0.003
          }
          orbitInput = true
        } else if (character.isParachuteOpen && character.state !== 'landed') {
          // Normal mouse look under canopy: vertical mouse movement directly pitches the camera
          // downward to clearly target the bullseye and island ground below
          if (Math.abs(mouseDelta.y) > 0.05) {
            this.chutePitch += mouseDelta.y * 0.0035
            this.chutePitch = THREE.MathUtils.clamp(this.chutePitch, -0.65, 0.95)
          }
        }

        // C: swing the view straight back behind the diver and reset pitch
        if (controls.wasPressed('recenter')) {
          this.recentering = true
        }
      }
      if (orbitInput) this.recentering = false
      if (this.recentering) {
        this.freeLookYaw = THREE.MathUtils.damp(this.freeLookYaw, 0, 10.0, delta)
        this.freeLookPitch = THREE.MathUtils.damp(this.freeLookPitch, 0, 10.0, delta)
        this.chutePitch = THREE.MathUtils.damp(this.chutePitch, 0, 10.0, delta)
        if (Math.abs(this.freeLookYaw) < 0.001 && Math.abs(this.freeLookPitch) < 0.001 && Math.abs(this.chutePitch) < 0.001) {
          this.recentering = false
        }
      }
      // Keep the orbit continuous without unbounded growth
      this.freeLookYaw = THREE.MathUtils.euclideanModulo(this.freeLookYaw + Math.PI, Math.PI * 2) - Math.PI
      this.freeLookPitch = THREE.MathUtils.clamp(this.freeLookPitch, -0.9, 1.3)

      this.orbitIdle = orbitInput ? 0 : this.orbitIdle + delta
      if (this.orbitIdle >= this.orbitReturnDelay) {
        this.freeLookYaw = THREE.MathUtils.damp(this.freeLookYaw, 0, 2.5, delta)
        this.freeLookPitch = THREE.MathUtils.damp(this.freeLookPitch, 0, 2.5, delta)
      }

      if (character.state === 'landed') {
        this.chutePitch = THREE.MathUtils.damp(this.chutePitch, 0, 4.0, delta)
      }

      // Camera coordinates synchronized directly with character heading and dive pitch
      const totalYaw = character.headingAngle + this.freeLookYaw
      // Sit a little above the actual descent line so the path ahead (and the rings on it)
      // shows just below the diver instead of off the bottom of the screen
      const v = character.velocity
      const glideAngle = character.state === 'landed'
        ? 0
        : Math.atan2(-v.y, Math.max(Math.hypot(v.x, v.z), 0.5))
      this.glideAngle = THREE.MathUtils.damp(this.glideAngle, THREE.MathUtils.clamp(glideAngle, 0, 1.2), 3.0, delta)
      // Under canopy pull back and frame parachute while keeping the island / target clearly in view
      this.chuteBlend = THREE.MathUtils.damp(
        this.chuteBlend,
        character.isParachuteOpen && character.state !== 'landed' ? 1 : 0,
        2.5,
        delta
      )
      // Freefall: ride just above the descent line. Canopy: angled down toward the target (~27° default) + player pitch.
      const basePitch = THREE.MathUtils.lerp(this.glideAngle + 0.18, 0.48, this.chuteBlend)
      const totalPitch = THREE.MathUtils.clamp(
        basePitch + this.freeLookPitch + this.chutePitch,
        -0.45,
        1.42
      )

      const flightDist = THREE.MathUtils.lerp(this.followDistance, this.chuteDistance, this.chuteBlend)
      const dist = (character.state === 'landed') ? 4.0 : flightDist

      const cosP = Math.cos(totalPitch)
      const sinP = Math.sin(totalPitch)

      const camX = charPos.x - Math.sin(totalYaw) * cosP * dist
      // Never dip the camera below the island surface when looking up from underneath
      const camY = Math.max(charPos.y + sinP * dist + 1.45, 24.0)
      const camZ = charPos.z - Math.cos(totalYaw) * cosP * dist

      this.instance.position.set(camX, camY, camZ)

      // Target character center of mass (chest level, keeping island and target framed ahead)
      const targetY = charPos.y + 0.85 + this.chuteBlend * 0.45
      this.instance.lookAt(charPos.x, targetY, charPos.z)

      // Speed sensation: widen FOV as velocity climbs
      const speed = character.state === 'landed' ? 0 : character.velocity.length()
      const targetFov = this.baseFov + THREE.MathUtils.clamp((speed - 12) / 26, 0, 1) * 16
      this.instance.fov = THREE.MathUtils.damp(this.instance.fov, targetFov, 3.0, delta)
      this.instance.updateProjectionMatrix()
    }

    // Decaying camera shake
    if (this.shake > 0.001) {
      const s = this.shake * 0.12
      this.instance.position.x += (Math.random() - 0.5) * s
      this.instance.position.y += (Math.random() - 0.5) * s
      this.instance.position.z += (Math.random() - 0.5) * s
      this.shake = THREE.MathUtils.damp(this.shake, 0, 6.0, delta)
    }
  }
}

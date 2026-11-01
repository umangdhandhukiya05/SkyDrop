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

    // PUBG 360° Free-Look offsets (when holding Alt or Right-Click)
    this.freeLookYaw = 0
    this.freeLookPitch = 0

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
      }
    } else if (mode === 'follow_skydiver') {
      this.freeLookYaw = 0
      this.freeLookPitch = 0

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
      // Smooth high-angle cinematic top view tracking plane acceleration
      const planePos = plane.group.position
      const heading = plane.currentHeading !== undefined ? plane.currentHeading : plane.runwayHeading

      const takeoffProgress = Math.min(1.0, plane.flightTime / 3.0)
      const topElevation = THREE.MathUtils.lerp(18.0, 38.0, takeoffProgress)
      const trailOffset = THREE.MathUtils.lerp(6.0, 10.0, takeoffProgress)

      const desiredCamPos = new THREE.Vector3(
        planePos.x - Math.sin(heading) * trailOffset,
        planePos.y + topElevation,
        planePos.z - Math.cos(heading) * trailOffset
      )

      const smoothFactor = 1.0 - Math.exp(-6.0 * delta)
      this.instance.position.lerp(desiredCamPos, smoothFactor)

      const desiredLookTarget = new THREE.Vector3(
        planePos.x + Math.sin(heading) * 6.0,
        planePos.y,
        planePos.z + Math.cos(heading) * 6.0
      )
      this.currentLookTarget.lerp(desiredLookTarget, smoothFactor)
      this.instance.lookAt(this.currentLookTarget)
    } else if (this.mode === 'follow_skydiver') {
      const charPos = character.group.position

      // ── PUBG 360° Free-Look (Alt / RMB) Handling ───────────────────────────
      if (controls && controls.keys.freeLook) {
        const mouseDelta = controls.getMouseDelta()
        this.freeLookYaw -= mouseDelta.x * 0.003
        this.freeLookPitch = THREE.MathUtils.clamp(
          this.freeLookPitch + mouseDelta.y * 0.0025,
          -0.95,
          0.95
        )
      } else {
        // Smoothly spring camera back behind character heading when Free-Look is released
        this.freeLookYaw = THREE.MathUtils.damp(this.freeLookYaw, 0, 8.0, delta)
        this.freeLookPitch = THREE.MathUtils.damp(this.freeLookPitch, 0, 8.0, delta)
      }

      // Camera coordinates synchronized directly with character heading and dive pitch
      const totalYaw = character.headingAngle + this.freeLookYaw
      const flightPitch = (character.state === 'landed') ? 0.0 : character.pitchAngle
      const totalPitch = THREE.MathUtils.clamp(
        flightPitch * 0.45 + this.freeLookPitch + 0.16,
        -0.85,
        1.1
      )

      // Distance from character: 5.2m in flight, 4.0m on landing
      const dist = (character.state === 'landed') ? 4.0 : 5.2

      const cosP = Math.cos(totalPitch)
      const sinP = Math.sin(totalPitch)

      const camX = charPos.x - Math.sin(totalYaw) * cosP * dist
      const camY = charPos.y + sinP * dist + 1.45
      const camZ = charPos.z - Math.cos(totalYaw) * cosP * dist

      this.instance.position.set(camX, camY, camZ)

      // Target character center of mass (chest level)
      const targetY = charPos.y + 0.85
      this.instance.lookAt(charPos.x, targetY, charPos.z)
    }
  }
}

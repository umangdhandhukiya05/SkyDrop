import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export default class Camera {
  constructor(experience) {
    this.experience = experience
    this.sizes = experience.sizes
    this.scene = experience.scene
    this.canvas = experience.canvas
    this.time = experience.time

    // Mode: 'cinematic_menu', 'cinematic_takeoff', 'cinematic_dive', 'follow_skydiver'
    this.mode = 'cinematic_menu'

    this._createCamera()
    this._createControls()
    this._listenResize()
  }

  _createCamera() {
    this.instance = new THREE.PerspectiveCamera(
      45,
      this.sizes.aspect,
      0.1,
      5000
    )

    // Camera framing character and plane directly in front:
    // Character is centered on the runway at (426.0, 11.35, 558.5)
    // Plane is aligned on runway behind character at (426.0, 11.35, 550.0)
    // Camera is positioned at (426.0, 12.7, 564.5) looking at character's chest level (426.0, 12.3, 558.0):
    this.basePosition = new THREE.Vector3(426.0, 12.7, 564.5)
    this.target = new THREE.Vector3(426.0, 12.3, 558.0)

    this.instance.position.copy(this.basePosition)
    this.instance.lookAt(this.target)

    this.scene.add(this.instance)
  }

  _createControls() {
    this.controls = new OrbitControls(this.instance, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.enabled = false
    this.controls.target.copy(this.target)
  }

  _listenResize() {
    this.sizes.addEventListener('resize', () => {
      this.instance.aspect = this.sizes.aspect
      this.instance.updateProjectionMatrix()
    })
  }

  setMode(mode) {
    this.mode = mode
  }

  update() {
    const delta = this.experience.time.delta
    const world = this.experience.world
    if (!world || !world.plane || !world.character) return

    const plane = world.plane
    const character = world.character

    if (this.mode === 'cinematic_menu') {
      // Subtle cinematic camera sway
      const t = this.time.elapsed * 0.4
      this.instance.position.x = this.basePosition.x + Math.sin(t) * 0.15
      this.instance.position.y = this.basePosition.y + Math.cos(t * 0.7) * 0.08
      this.instance.position.z = this.basePosition.z + Math.cos(t) * 0.12
      this.instance.lookAt(this.target)
    } else if (this.mode === 'cinematic_takeoff') {
      // Dynamic drone chase camera trailing the accelerating & climbing aircraft
      const planePos = plane.group.position
      const heading = plane.group.rotation.y - Math.PI / 2

      const backDist = 30
      const sideDist = 12
      const height = 9.5

      const desiredCamPos = new THREE.Vector3(
        planePos.x - Math.sin(heading) * backDist + Math.cos(heading) * sideDist,
        planePos.y + height,
        planePos.z - Math.cos(heading) * backDist - Math.sin(heading) * sideDist
      )

      this.instance.position.lerp(desiredCamPos, delta * 3.5)

      const lookTarget = planePos.clone()
      lookTarget.y += 1.8
      this.instance.lookAt(lookTarget)
    } else if (this.mode === 'cinematic_dive') {
      // Dramatic exit camera capturing the leap from the aircraft high above the island
      const charPos = character.group.position
      const heading = character.headingAngle

      const desiredCamPos = new THREE.Vector3(
        charPos.x - Math.sin(heading) * 16 + Math.cos(heading) * 8,
        charPos.y + 8.5,
        charPos.z - Math.cos(heading) * 16 - Math.sin(heading) * 8
      )

      this.instance.position.lerp(desiredCamPos, delta * 4.5)
      this.instance.lookAt(charPos)
    } else if (this.mode === 'follow_skydiver') {
      // Third-person gameplay chase camera following the skydiver
      const charPos = character.group.position
      const heading = character.headingAngle

      const dist = 11.5
      const height = 4.2

      const desiredCamPos = new THREE.Vector3(
        charPos.x - Math.sin(heading) * dist,
        charPos.y + height,
        charPos.z - Math.cos(heading) * dist
      )

      this.instance.position.lerp(desiredCamPos, delta * 7.5)

      const targetLook = new THREE.Vector3(
        charPos.x + Math.sin(heading) * 12,
        charPos.y - 1.8,
        charPos.z + Math.cos(heading) * 12
      )
      this.instance.lookAt(targetLook)
    }
  }
}

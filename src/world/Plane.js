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

    // Heading of takeoff down the long runway (from SW threshold to NE): 137.7° (2.403 rad)
    this.runwayHeading = 2.403

    // Sits perfectly centered on the runway tarmac directly behind the character:
    // Aligned at x=426.0, y=11.35, z=550.0
    this.startPos = new THREE.Vector3(426.0, 11.35, 550.0)
    this.group.position.copy(this.startPos)

    // Plane aligned down the runway heading:
    // In skyDrop_plane.glb, nose is at local -X.
    // Rotating around Y by (runwayHeading + PI/2) points the nose down the runway!
    this.group.rotation.set(0, this.runwayHeading + Math.PI / 2, 0)

    // Flight state: 'parked', 'takeoff', 'climbing', 'cruising'
    this.state = 'parked'
    this.flightTime = 0
    this.speed = 0

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
    } catch (err) {
      console.warn('⚠️ Plane failed to load:', err)
    }
  }

  startTakeoff() {
    this.state = 'takeoff'
    this.flightTime = 0
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

    // 0s - 4.5s: Runway acceleration roll along runway heading (144.05°)
    // 4.5s - 9.0s: Liftoff rotation & steep aerodynamic climb to 380m
    // 9.0s+: Cruise across island interior
    if (t < 4.5) {
      const prog = t / 4.5
      this.speed = Math.pow(prog, 1.2) * 62

      const fX = Math.sin(this.runwayHeading)
      const fZ = Math.cos(this.runwayHeading)

      this.group.position.x += fX * this.speed * delta
      this.group.position.z += fZ * this.speed * delta

      const runwayJitter = Math.sin(t * 40) * 0.015 * prog
      this.group.position.y = 11.35 + runwayJitter

      if (t > 3.2) {
        const pitchT = (t - 3.2) / 1.3
        this.group.rotation.z = pitchT * 0.12
      } else {
        this.group.rotation.z = 0
      }
    } else if (t < 9.0) {
      // Aerodynamic liftoff & climb
      const climbT = (t - 4.5) / 4.5
      this.speed = 62 + climbT * 22

      const currentHeading = THREE.MathUtils.lerp(this.runwayHeading, this.runwayHeading - 0.72, climbT)
      const fX = Math.sin(currentHeading)
      const fZ = Math.cos(currentHeading)

      this.group.position.x += fX * this.speed * delta
      this.group.position.z += fZ * this.speed * delta

      this.group.position.y = THREE.MathUtils.lerp(11.35, 760, Math.pow(climbT, 1.35))

      this.group.rotation.y = currentHeading + Math.PI / 2
      this.group.rotation.z = 0.28
      this.group.rotation.x = -0.18 * Math.sin(climbT * Math.PI)
    } else {
      // Cruise across island airspace directly over target at doubled altitude
      this.speed = 76
      const targetDir = new THREE.Vector3(0 - this.group.position.x, 0, 0 - this.group.position.z).normalize()
      const cruiseHeading = Math.atan2(targetDir.x, targetDir.z)

      this.group.position.x += targetDir.x * this.speed * delta
      this.group.position.z += targetDir.z * this.speed * delta
      this.group.position.y = 760

      this.group.rotation.y = cruiseHeading + Math.PI / 2
      this.group.rotation.z = 0
      this.group.rotation.x = 0
    }
  }
}

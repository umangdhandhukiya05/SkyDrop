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

    this.runwayHeading = 2.403
    this.currentHeading = this.runwayHeading

    this.startPos = new THREE.Vector3(426.0, 11.35, 550.0)
    this.group.position.copy(this.startPos)

    this.group.rotation.set(0, this.runwayHeading + Math.PI / 2, 0)

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

    if (t < 4.5) {
      const prog = t / 4.5
      this.speed = Math.pow(prog, 1.2) * 62

      const fX = Math.sin(this.runwayHeading)
      const fZ = Math.cos(this.runwayHeading)

      this.group.position.x += fX * this.speed * delta
      this.group.position.z += fZ * this.speed * delta

      // Smooth runway contact without jitter
      this.group.position.y = 11.35

      if (t > 3.2) {
        const pitchT = (t - 3.2) / 1.3
        const smoothPitch = pitchT * pitchT * (3 - 2 * pitchT)
        this.group.rotation.z = smoothPitch * 0.12
      } else {
        this.group.rotation.z = 0
      }
    } else if (t < 9.0) {
      // Aerodynamic liftoff & climb curving smoothly over the island center
      const climbT = (t - 4.5) / 4.5
      const smoothClimb = climbT * climbT * (3 - 2 * climbT)
      this.speed = 62 + climbT * 22

      // Curve leftward towards the island interior (0, 0)
      this.currentHeading = THREE.MathUtils.lerp(this.runwayHeading, this.runwayHeading + 0.82, smoothClimb)
      const fX = Math.sin(this.currentHeading)
      const fZ = Math.cos(this.currentHeading)

      this.group.position.x += fX * this.speed * delta
      this.group.position.z += fZ * this.speed * delta

      this.group.position.y = THREE.MathUtils.lerp(11.35, 960, Math.pow(climbT, 1.35))

      this.group.rotation.set(0, this.currentHeading + Math.PI / 2, 0)
    } else {
      // Cruise across island airspace directly over target at high altitude (960m)
      this.speed = 76
      const targetDir = new THREE.Vector3(0 - this.group.position.x, 0, 0 - this.group.position.z).normalize()
      this.currentHeading = Math.atan2(targetDir.x, targetDir.z)

      this.group.position.x += targetDir.x * this.speed * delta
      this.group.position.z += targetDir.z * this.speed * delta
      this.group.position.y = 960

      this.group.rotation.set(0, this.currentHeading + Math.PI / 2, 0)
    }
  }
}

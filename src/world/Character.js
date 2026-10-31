import * as THREE from 'three'
import charUrl from '../assets/models/skyDrop_char.glb?url'

export default class Character {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.loader = experience.loader

    this.group = new THREE.Group()
    this.group.name = 'Runway_Character'
    this.scene.add(this.group)

    // State: 'runway', 'in_plane', 'diving_auto', 'playable', 'landed'
    this.state = 'runway'

    // Physics & movement properties
    this.velocity = new THREE.Vector3(0, 0, 0)
    this.headingAngle = 0
    this.pitchAngle = 0
    this.rollAngle = 0

    // Rapier physics handle
    this.physicsHandle = null

    // Target landing ring center (LandingTarget at 0, 22.3, 0)
    this.targetPos = new THREE.Vector3(0, 22.3, 0)
    this.scoreResult = null

    // Animations mixer
    this.mixer = null
    this.animations = {}
    this.currentAction = null

    this._load()
  }

  async _load() {
    try {
      const gltf = await this.loader.loadGLTF(charUrl)
      this.model = gltf.scene

      this.model.traverse((child) => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
            mat.needsUpdate = true
          })
        }
      })

      // Character placement:
      // Standing solidly on the runway tarmac directly in front of the aircraft
      this.group.position.set(426.0, 11.35, 558.5)

      // Facing forward toward the camera:
      this.group.rotation.y = 0

      this.model.scale.setScalar(1.15) // Clean hero character scale
      this.group.add(this.model)

      // Animation Mixer
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model)
        gltf.animations.forEach((clip) => {
          this.animations[clip.name] = this.mixer.clipAction(clip)
        })
      }
    } catch (err) {
      console.warn('⚠️ Character failed to load:', err)
    }
  }

  playAnimation(name, transitionDuration = 0.3) {
    const action = this.animations[name]
    if (!action) return
    if (this.currentAction === action) return

    action.reset().fadeIn(transitionDuration).play()
    if (this.currentAction) {
      this.currentAction.fadeOut(transitionDuration)
    }
    this.currentAction = action
  }

  enterPlane() {
    this.state = 'in_plane'
    this.group.visible = false
  }

  jumpFromPlane(planePosition, planeHeading) {
    this.state = 'playable'
    this.group.visible = true

    // Eject over island territory
    this.group.position.copy(planePosition)
    this.group.position.y -= 4.0

    // Heading points directly towards the archery bullseye target (0, 0)
    const toTarget = new THREE.Vector2(this.targetPos.x - this.group.position.x, this.targetPos.z - this.group.position.z).normalize()
    this.headingAngle = Math.atan2(toTarget.x, toTarget.y)

    // Initial forward glide velocity toward target
    this.velocity.set(toTarget.x * 35, -24, toTarget.y * 35)

    // Horizontal belly skydiving pose
    this.model.rotation.x = Math.PI / 2
    this.playAnimation('SKY_Fly_Idle')

    // Create Rapier physics body for character
    if (this.experience.physics && this.experience.physics.ready) {
      this.physicsHandle = this.experience.physics.createCharacterBody(
        this.group.position.x,
        this.group.position.y,
        this.group.position.z
      )
    }
  }

  setPlayable() {
    this.state = 'playable'
  }

  calculateLandingScore() {
    const distToCenter = Math.hypot(
      this.group.position.x - this.targetPos.x,
      this.group.position.z - this.targetPos.z
    )

    let points = 0
    let rating = 'MISS'
    let ringName = 'Outside Target'

    if (distToCenter <= 5.0) {
      points = 1000
      rating = 'PERFECT BULLSEYE!'
      ringName = 'Yellow Bullseye'
    } else if (distToCenter <= 14.0) {
      points = 750
      rating = 'GREAT LANDING!'
      ringName = 'Red Inner Ring'
    } else if (distToCenter <= 24.0) {
      points = 500
      rating = 'GOOD SHOT!'
      ringName = 'White Middle Ring'
    } else if (distToCenter <= 35.0) {
      points = 300
      rating = 'NICE GLIDE'
      ringName = 'Blue Outer Ring'
    } else if (distToCenter <= 46.0) {
      points = 150
      rating = 'BORDER HIT'
      ringName = 'White Outer Ring'
    } else if (distToCenter <= 54.0) {
      points = 50
      rating = 'TOUCHDOWN'
      ringName = 'Landing Pad Edge'
    } else {
      points = 0
      rating = 'MISSED TARGET'
      ringName = 'Island Ground'
    }

    this.scoreResult = {
      points,
      rating,
      ringName,
      distance: distToCenter.toFixed(1)
    }

    const scoreOverlay = document.getElementById('score-overlay')
    const scorePointsEl = document.getElementById('score-points')
    const scoreRatingEl = document.getElementById('score-rating')
    const scoreDistEl = document.getElementById('score-distance')

    if (scoreOverlay) {
      if (scorePointsEl) scorePointsEl.innerText = `${points} PTS`
      if (scoreRatingEl) scoreRatingEl.innerText = rating
      if (scoreDistEl) scoreDistEl.innerText = `${distToCenter.toFixed(1)}m from center (${ringName})`
      scoreOverlay.classList.add('visible')
    }

    this.model.rotation.x = 0
    this.playAnimation('SKY_Fly_Idle')
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta)
    }

    if (this.state === 'runway' || this.state === 'in_plane' || this.state === 'landed') return

    const controls = this.experience.controls

    if (this.state === 'diving_auto') {
      this.velocity.y -= 14 * delta
      this.group.position.addScaledVector(this.velocity, delta)
      this.group.rotation.set(0.2, this.headingAngle, 0, 'YXZ')

      if (this.physicsHandle && this.physicsHandle.rigidBody) {
        this.physicsHandle.rigidBody.setTranslation(
          { x: this.group.position.x, y: this.group.position.y, z: this.group.position.z },
          true
        )
      }
      return
    }

    if (this.state === 'playable') {
      const keys = controls.keys

      let targetFallSpeed = -24
      let horizontalSpeed = 42

      if (keys.space) {
        targetFallSpeed = -58
        horizontalSpeed = 62
      }

      if (keys.shift) {
        targetFallSpeed = -13
        horizontalSpeed = 26
      }

      this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetFallSpeed, delta * 4.0)

      const turnRate = 1.9
      if (keys.left) {
        this.headingAngle += turnRate * delta
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, 0.45, delta * 6)
        this.playAnimation('SKY_Bank_Left', 0.2)
      } else if (keys.right) {
        this.headingAngle -= turnRate * delta
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, -0.45, delta * 6)
        this.playAnimation('SKY_Bank_Right', 0.2)
      } else {
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, 0, delta * 5)
        this.playAnimation('SKY_Fly_Idle', 0.2)
      }

      if (keys.forward) {
        this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, 0.4, delta * 5)
        horizontalSpeed *= 1.35
      } else if (keys.backward) {
        this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, -0.3, delta * 5)
        horizontalSpeed *= 0.7
      } else {
        this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, 0, delta * 4)
      }

      const fX = Math.sin(this.headingAngle)
      const fZ = Math.cos(this.headingAngle)

      this.velocity.x = fX * horizontalSpeed
      this.velocity.z = fZ * horizontalSpeed

      if (this.physicsHandle && this.physicsHandle.rigidBody) {
        const body = this.physicsHandle.rigidBody
        body.setLinvel({ x: this.velocity.x, y: this.velocity.y, z: this.velocity.z }, true)
        const pos = body.translation()
        this.group.position.set(pos.x, pos.y, pos.z)
      } else {
        this.group.position.addScaledVector(this.velocity, delta)
      }

      const distToTarget = Math.hypot(
        this.group.position.x - this.targetPos.x,
        this.group.position.z - this.targetPos.z
      )
      const alt = Math.max(0, this.group.position.y - 22.0)
      const altEl = document.getElementById('hud-alt')
      const distEl = document.getElementById('hud-target-dist')
      if (altEl) altEl.innerText = `${Math.round(alt)} m`
      if (distEl) distEl.innerText = `${Math.round(distToTarget)} m`

      if (this.group.position.y <= 22.3) {
        this.group.position.y = 22.3
        this.state = 'landed'
        this.velocity.set(0, 0, 0)
        if (this.physicsHandle && this.physicsHandle.rigidBody) {
          this.physicsHandle.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }
        this.calculateLandingScore()
        return
      }

      this.group.rotation.set(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ')
    }
  }
}

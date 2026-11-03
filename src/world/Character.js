import * as THREE from 'three'
import charUrl from '../assets/models/skyDrop_char.glb?url'
import parachuteUrl from '../assets/models/Parachute.glb?url'

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
    this.pitchAngle = 0.08 // Slight natural forward dive
    this.rollAngle = 0
    this.currentHorizontalSpeed = 38

    // Parachute state & model
    this.parachute = null
    this.isParachuteOpen = false
    this.parachuteDeployTimer = 0

    // Manual chute: prompt below chutePromptAlt, forced open at chuteAutoAlt.
    // Pulling it yourself low (but before auto) earns a bonus.
    this.chutePromptAlt = 400
    this.chuteBonusAlt = 250
    this.chuteAutoAlt = 90
    this.chuteBonusPoints = 10
    this.chuteBonus = 0

    // Canopy flight (m/s): forward speed and sink rate for cruise, W push, S brake, SHIFT flare
    this.chuteGlide = {
      cruise: 9.0, cruiseFall: -5.0,
      push: 15.0, pushFall: -7.5,
      brake: 3.5, brakeFall: -3.0,
      flareFall: -2.0
    }
    this.chuteTurnRate = 1.25 // rad/s with A / D
    this.chuteBankMax = 0.3   // ~17° pendulum swing into turns

    // Rapier physics handle
    this.physicsHandle = null

    // Target landing ring center (LandingTarget at 0, 22.0, 0)
    this.targetPos = new THREE.Vector3(0, 22.0, 0)
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

      this.bones = {}
      this.wingsuit = null

      this.model.traverse((child) => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
            mat.depthWrite = true
            mat.needsUpdate = true
          })
        }
        if (child.name === 'SKY_Character_Wingsuit') {
          this.wingsuit = child
        }
        if (child.isBone) {
          this.bones[child.name] = child
        }
      })

      // Character placement on runway tarmac
      this.group.position.set(426.0, 11.35, 558.5)
      this.group.rotation.y = 0

      this.model.scale.setScalar(1.15)
      this.group.add(this.model)

      // Animation Mixer
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model)
        gltf.animations.forEach((clip) => {
          const action = this.mixer.clipAction(clip)
          action.setLoop(THREE.LoopRepeat)
          this.animations[clip.name] = action
        })
      }

      // Load Parachute model
      try {
        const paraGltf = await this.loader.loadGLTF(parachuteUrl)
        this.parachute = paraGltf.scene
        this.parachute.traverse((child) => {
          if (child.isMesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((mat) => {
              if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
              mat.side = THREE.DoubleSide
              mat.depthWrite = true
              mat.needsUpdate = true
            })
          }
        })
        this.parachute.position.set(0, 2.12, 0.07)
        this.parachute.scale.setScalar(0.95)
        this.parachute.visible = false
        this.group.add(this.parachute)
        console.log('✅ Parachute model loaded and ready')
      } catch (paraErr) {
        console.warn('⚠️ Parachute failed to load:', paraErr)
      }
    } catch (err) {
      console.warn('⚠️ Character failed to load:', err)
    }
  }

  playAnimation(name, transitionDuration = 0.25) {
    const action = this.animations[name]
    if (!action) return
    if (this.currentAction === action) return

    if (!action.isRunning()) {
      action.reset().fadeIn(transitionDuration).play()
    } else {
      action.enabled = true
      action.setEffectiveTimeScale(1)
      action.setEffectiveWeight(1)
      action.fadeIn(transitionDuration)
    }

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(transitionDuration)
    }
    this.currentAction = action
  }

  _updateParachutePose(delta, keys) {
    if (!this.bones) return

    if (this.isParachuteOpen) {
      // Hide wingsuit webbing mesh under parachute so skydiver holds risers cleanly
      if (this.wingsuit && this.wingsuit.visible) {
        this.wingsuit.visible = false
      }

      const grabProg = Math.min(1.0, this.parachuteDeployTimer / 0.45)
      const smoothProg = grabProg * grabProg * (3 - 2 * grabProg)

      const uArmL = this.bones['UpperArm_L']
      const fArmL = this.bones['Forearm_L']
      const uArmR = this.bones['UpperArm_R']
      const fArmR = this.bones['Forearm_R']

      if (uArmL && fArmL && uArmR && fArmR) {
        // Toggle steering: pull left or right toggle downward
        let leftPull = 0
        let rightPull = 0
        if (keys && keys.left && !keys.right) leftPull = 0.35
        if (keys && keys.right && !keys.left) rightPull = 0.35
        if (keys && (keys.backward || keys.shift)) {
          leftPull = 0.45
          rightPull = 0.45
        }

        // Left arm overhead grab Euler target (hands grip overhead parachute bar at x=±0.48, y=2.22, z=0.07)
        const targetEulerUAL = new THREE.Euler(-2.39 + leftPull * 0.45, -0.59, -2.39 + leftPull * 0.25)
        const targetEulerFAL = new THREE.Euler(0.40 + leftPull * 0.30, 0.10, 0.0)

        // Right arm overhead grab Euler target
        const targetEulerUAR = new THREE.Euler(-2.39 + rightPull * 0.45, 0.59, 2.39 - rightPull * 0.25)
        const targetEulerFAR = new THREE.Euler(0.40 + rightPull * 0.30, -0.10, 0.0)

        const targetQuatUAL = new THREE.Quaternion().setFromEuler(targetEulerUAL)
        const targetQuatFAL = new THREE.Quaternion().setFromEuler(targetEulerFAL)
        const targetQuatUAR = new THREE.Quaternion().setFromEuler(targetEulerUAR)
        const targetQuatFAR = new THREE.Quaternion().setFromEuler(targetEulerFAR)

        uArmL.quaternion.slerp(targetQuatUAL, smoothProg)
        fArmL.quaternion.slerp(targetQuatFAL, smoothProg)
        uArmR.quaternion.slerp(targetQuatUAR, smoothProg)
        fArmR.quaternion.slerp(targetQuatFAR, smoothProg)
      }
    } else {
      // Restore wingsuit during freefall
      if (this.wingsuit && !this.wingsuit.visible) {
        this.wingsuit.visible = true
      }
    }
  }

  enterPlane() {
    this.state = 'in_plane'
    this.group.visible = false
  }

  jumpFromPlane(planePosition, planeHeading) {
    this.state = 'playable'
    this.group.visible = true

    // Activate mouse flight steering
    if (this.experience.controls) {
      this.experience.controls.setFlightActive(true)
    }

    // Parachute initially packed
    this.isParachuteOpen = false
    this.parachuteDeployTimer = 0
    this.chuteBonus = 0
    if (this.parachute) this.parachute.visible = false

    // Eject over island territory
    this.group.position.copy(planePosition)
    this.group.position.y -= 4.0

    // Initial heading points directly towards the archery target (0, 0)
    const toTarget = new THREE.Vector2(this.targetPos.x - this.group.position.x, this.targetPos.z - this.group.position.z).normalize()
    this.headingAngle = Math.atan2(toTarget.x, toTarget.y)
    this.pitchAngle = 0.08
    this.aimPitch = 0.08
    this.rollAngle = 0

    // Initial forward glide velocity toward target (calibrated to reach landing target directly)
    this.velocity.set(toTarget.x * 12.0, -12.5, toTarget.y * 12.0)
    this.forwardSpeed = 12.0
    this.strafeSpeed = 0

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

  _deployParachute() {
    this.isParachuteOpen = true
    this.parachuteDeployTimer = 0
    if (this.parachute) {
      this.parachute.visible = true
      this.parachute.scale.set(0.1, 0.1, 0.1)
    }
    if (this.experience.hud) this.experience.hud.showChutePrompt(false)
    if (this.experience.camera) this.experience.camera.kick(0.7)
    // Audio: Play realistic canopy snap, inflation thump, and switch to gentle breeze
    if (this.experience.audio) {
      this.experience.audio.playParachuteDeploy()
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

    let landingPoints = 0
    let rating = 'MISS'
    let ringName = 'Outside Target'

    // Scoring based on archery target color rings: 50 (Yellow), 40 (Red), 30 (White), 20 (Blue), 10 (White Edge)
    if (distToCenter <= 5.0) {
      landingPoints = 50
      rating = 'PERFECT BULLSEYE!'
      ringName = 'Yellow Bullseye'
    } else if (distToCenter <= 14.0) {
      landingPoints = 40
      rating = 'EXCELLENT LANDING!'
      ringName = 'Red Inner Ring'
    } else if (distToCenter <= 24.0) {
      landingPoints = 30
      rating = 'GREAT SHOT!'
      ringName = 'White Middle Ring'
    } else if (distToCenter <= 35.0) {
      landingPoints = 20
      rating = 'GOOD TOUCHDOWN'
      ringName = 'Blue Outer Ring'
    } else if (distToCenter <= 54.0) {
      landingPoints = 10
      rating = 'PAD EDGE'
      ringName = 'White Outer Ring'
    } else {
      landingPoints = 0
      rating = 'MISSED TARGET'
      ringName = 'Island Ground'
    }

    // Rings collection points (+10 PTS per ring)
    const rings = this.experience.world.rings
    const ringPoints = rings ? rings.getRingPoints() : 0
    const ringsCollected = rings ? rings.collectedCount : 0
    const totalRings = rings ? rings.totalRings : 3

    const totalScore = landingPoints + ringPoints + this.chuteBonus

    const isTargetMissed = landingPoints === 0 || distToCenter > 54.0
    const isGameOver = isTargetMissed || !this.isParachuteOpen

    if (isGameOver) {
      rating = isTargetMissed ? 'TARGET MISSED' : 'GAME OVER'
    } else if (ringsCollected === totalRings && landingPoints === 50) {
      rating = 'LEGENDARY MASTER!'
    } else if (landingPoints === 50) {
      rating = 'PERFECT BULLSEYE!'
    } else if (ringsCollected >= 2) {
      rating = 'ACROBATIC ACE!'
    }

    this.scoreResult = {
      totalScore,
      landingPoints,
      ringPoints,
      ringsCollected,
      rating,
      ringName,
      distance: distToCenter.toFixed(1),
      isGameOver,
      isTargetMissed
    }

    const scoreOverlay = document.getElementById('score-overlay')
    const scoreCard = document.getElementById('score-card')
    const scorePointsEl = document.getElementById('score-points')
    const scoreRatingEl = document.getElementById('score-rating')
    const scoreRingsDetailEl = document.getElementById('score-rings-detail')
    const scoreDistEl = document.getElementById('score-distance')

    if (scoreOverlay) {
      if (scorePointsEl) scorePointsEl.innerText = `${totalScore} PTS`
      if (scoreRatingEl) scoreRatingEl.innerText = rating
      if (scoreRingsDetailEl) {
        scoreRingsDetailEl.innerText =
          `Rings Collected: ${ringsCollected} / ${totalRings} (+${ringPoints} PTS)` +
          (this.chuteBonus ? `  ·  Low Pull Bonus (+${this.chuteBonus} PTS)` : '')
      }
      if (scoreDistEl) {
        scoreDistEl.innerText = isTargetMissed
          ? `Landing: ${distToCenter.toFixed(1)}m from center (${ringName}) — Target Missed!`
          : `Landing: ${distToCenter.toFixed(1)}m from center (${ringName}) (+${landingPoints} PTS)`
      }

      if (scoreCard) {
        if (isGameOver) {
          scoreCard.classList.add('missed-target')
        } else {
          scoreCard.classList.remove('missed-target')
        }
      }

      // Show celebration ribbon on successful game completion; hide on target missed or game over
      if (this.experience.celebration) {
        if (!isGameOver) {
          const ribbonText = landingPoints === 50 ? 'PERFECT BULLSEYE' : 'CELEBRATION'
          this.experience.celebration.show(ribbonText)
        } else {
          this.experience.celebration.hide()
        }
      }

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
    const keys = controls ? controls.keys : {}

    // Procedural Parachute Steering & Gripping Posture (overrides fly animation on arms)
    this._updateParachutePose(delta, keys)

    if (this.state === 'playable') {
      const mouseDelta = controls.getMouseDelta()

      // ── Flight Steering & Orientation Controls ─────────────────────────────
      if (!keys.freeLook) {
        // Horizontal yaw steering (Mouse X)
        if (Math.abs(mouseDelta.x) > 0.05) {
          const mouseSens = 0.0026
          this.headingAngle -= mouseDelta.x * mouseSens
        }

        // Vertical pitch limits for ring targeting in freefall (Mouse Y)
        // Under canopy, vertical mouse movement is handled by Camera to pitch view downwards at target
        if (!this.isParachuteOpen && Math.abs(mouseDelta.y) > 0.05) {
          const pitchSens = 0.0022
          const minPitch = -0.48 // Up to ~27.5° flare / climb
          const maxPitch = 0.65   // Up to ~37.2° steep dive

          if (this.aimPitch === undefined) this.aimPitch = this.pitchAngle || 0.08
          this.aimPitch = THREE.MathUtils.clamp(
            this.aimPitch + mouseDelta.y * pitchSens,
            minPitch,
            maxPitch
          )
        }
      }

      // Keyboard A / D steering: agile in freefall; under canopy a steady toggle turn like PUBG / BGMI
      const keyTurnRate = this.isParachuteOpen ? this.chuteTurnRate : 2.8
      let keyTurnInput = 0
      if (keys.left) {
        this.headingAngle += keyTurnRate * delta
        keyTurnInput += 1
      }
      if (keys.right) {
        this.headingAngle -= keyTurnRate * delta
        keyTurnInput -= 1
      }

      // ── Aerodynamic Banking Roll & Animations ──────────────────────────────
      const mouseTurnInput = keys.freeLook ? 0 : (-mouseDelta.x * 0.035)
      const combinedTurn = THREE.MathUtils.clamp(keyTurnInput * 0.6 + mouseTurnInput, -1.0, 1.0)
      let targetRoll
      if (!this.isParachuteOpen) {
        targetRoll = combinedTurn * 0.34 // Maximum bank angle ~20°
        this.rollAngle = THREE.MathUtils.damp(this.rollAngle, targetRoll, 7.0, delta)
      } else {
        // Canopy and diver swing into the turn together as one pendulum (slower response)
        targetRoll = combinedTurn * this.chuteBankMax
        this.rollAngle = THREE.MathUtils.damp(this.rollAngle, targetRoll, 3.0, delta)
      }

      // Animation selection matching banking roll (only during freefall)
      if (!this.isParachuteOpen) {
        if (this.rollAngle > 0.10) {
          this.playAnimation('SKY_Bank_Left', 0.2)
        } else if (this.rollAngle < -0.10) {
          this.playAnimation('SKY_Bank_Right', 0.2)
        } else {
          this.playAnimation('SKY_Fly_Idle', 0.25)
        }
      }

      // ── W (Forward) / S (Backward) Direct Motion & Pitch Controls ──────────
      if (this.aimPitch === undefined) this.aimPitch = 0.08

      // Key commands dynamically guide pitch posture
      if (keys.forward && !keys.backward) {
        // W: Active forward dive posture
        const diveTarget = this.isParachuteOpen ? 0.14 : 0.48
        this.aimPitch = THREE.MathUtils.damp(this.aimPitch, diveTarget, 6.0, delta)
      } else if (keys.backward && !keys.forward) {
        // S: Active pull-up flare posture (leaning back while backing up)
        const flareTarget = this.isParachuteOpen ? -0.12 : -0.34
        this.aimPitch = THREE.MathUtils.damp(this.aimPitch, flareTarget, 6.0, delta)
      } else if (keys.space) {
        const spaceTarget = this.isParachuteOpen ? 0.05 : 0.58
        this.aimPitch = THREE.MathUtils.damp(this.aimPitch, spaceTarget, 6.0, delta)
      } else if (keys.shift) {
        const shiftTarget = this.isParachuteOpen ? -0.06 : -0.36
        this.aimPitch = THREE.MathUtils.damp(this.aimPitch, shiftTarget, 6.0, delta)
      } else if (!keys.freeLook && Math.abs(mouseDelta.y) <= 0.05) {
        // Gentle aerodynamic leveling only when completely hands-off
        const neutralPitch = this.isParachuteOpen ? 0.0 : 0.08
        this.aimPitch = THREE.MathUtils.damp(this.aimPitch, neutralPitch, 2.5, delta)
      }

      // Smooth pitch damping towards aimPitch
      this.pitchAngle = THREE.MathUtils.damp(this.pitchAngle, this.aimPitch, 6.5, delta)

      // ── High Authority Movement Values: Forward (W), Backward (S), Strafe (A/D) ──
      // Neutral cruising speeds
      let targetForwardSpeed = this.isParachuteOpen ? 4.5 : 12.0
      let targetStrafeSpeed = 0
      let targetFallSpeed = -12.5

      if (this.isParachuteOpen) {
        this.parachuteDeployTimer += delta
        const openProg = Math.min(1.0, this.parachuteDeployTimer / 0.6)

        // Smooth canopy opening pop
        const currentScale = THREE.MathUtils.lerp(0.1, 0.95, openProg)
        if (this.parachute) {
          this.parachute.scale.set(currentScale, currentScale, currentScale)
          this.parachute.rotation.z = 0 // Strictly zero Z-axis roll under parachute
        }

        // Smoothly rotate character from belly-fall to upright standing stance
        this.model.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 0, openProg)
        this.model.rotation.z = 0 // Strictly zero Z-axis roll

        // Canopy glide (PUBG / BGMI style): W pushes forward and drops faster, S brakes and floats,
        // A / D turn (handled above), SHIFT flares for a soft touchdown
        targetForwardSpeed = this.chuteGlide.cruise
        targetFallSpeed = this.chuteGlide.cruiseFall
        if (keys.forward && !keys.backward) {
          targetForwardSpeed = this.chuteGlide.push
          targetFallSpeed = this.chuteGlide.pushFall
        } else if (keys.backward && !keys.forward) {
          targetForwardSpeed = this.chuteGlide.brake
          targetFallSpeed = this.chuteGlide.brakeFall
        }

        if (keys.shift) {
          targetForwardSpeed = Math.min(targetForwardSpeed, this.chuteGlide.brake)
          targetFallSpeed = this.chuteGlide.flareFall
        }

        // Slight outward slide while turning so turns feel carved rather than pivoting in place
        targetStrafeSpeed = -keyTurnInput * 1.5
      } else {
        // High-altitude Wingsuit Freefall:
        if (keys.forward && !keys.backward) {
          // W: Surge Forward with High Power (+26 m/s)!
          targetForwardSpeed = 26.0
          targetFallSpeed = -24.0
        } else if (keys.backward && !keys.forward) {
          // S: Move Backward in Reverse (-10 m/s) with high float (-6.5 m/s)!
          targetForwardSpeed = -10.0
          targetFallSpeed = -6.5 // Feather float: lots of time to align and collect rings!
        } else if (keys.space) {
          targetForwardSpeed = 28.0
          targetFallSpeed = -28.0
        } else if (keys.shift) {
          targetForwardSpeed = 6.0
          targetFallSpeed = -6.0
        } else {
          // Modulate cruising fall speed with mouse aim pitch
          const diveFactor = THREE.MathUtils.clamp((this.pitchAngle + 0.32) / 0.90, 0.0, 1.0)
          targetFallSpeed = THREE.MathUtils.lerp(-7.0, -24.0, diveFactor)
        }

        // A / D: Direct Lateral Strafe Movement
        if (keys.left && !keys.right) {
          targetStrafeSpeed = -14.0 // A: Direct glide left
        } else if (keys.right && !keys.left) {
          targetStrafeSpeed = 14.0  // D: Direct glide right
        }
      }

      // Responsive, snappy speed damping (rate 7.0 for instant agile feedback)
      const moveLerpRate = 7.0
      this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed || targetForwardSpeed, targetForwardSpeed, moveLerpRate, delta)
      this.strafeSpeed = THREE.MathUtils.damp(this.strafeSpeed || 0, targetStrafeSpeed, moveLerpRate, delta)
      this.velocity.y = THREE.MathUtils.damp(this.velocity.y, targetFallSpeed, this.isParachuteOpen ? 5.0 : 6.0, delta)

      // Forward vector and perpendicular right strafe vector along heading
      const fX = Math.sin(this.headingAngle)
      const fZ = Math.cos(this.headingAngle)
      const rX = Math.cos(this.headingAngle)
      const rZ = -Math.sin(this.headingAngle)

      // Combined 6-DOF horizontal velocity (Forward/Backward + Left/Right Strafe)
      this.velocity.x = fX * this.forwardSpeed + rX * this.strafeSpeed
      this.velocity.z = fZ * this.forwardSpeed + rZ * this.strafeSpeed

      // Move character smoothly by velocity (rock-solid, zero-jitter)
      this.group.position.x += this.velocity.x * delta
      this.group.position.y += this.velocity.y * delta
      this.group.position.z += this.velocity.z * delta

      // Synchronize Rapier cylinder rigid body
      if (this.physicsHandle && this.physicsHandle.rigidBody) {
        const body = this.physicsHandle.rigidBody
        body.setTranslation({ x: this.group.position.x, y: this.group.position.y, z: this.group.position.z }, true)
        body.setLinvel({ x: this.velocity.x, y: this.velocity.y, z: this.velocity.z }, true)
      }

      // Character orientation: pitch, heading, roll
      this.group.rotation.set(this.pitchAngle, this.headingAngle, this.rollAngle, 'YXZ')

      // ── Dynamic Web Audio Diving Wind Update ──────────────────────────────
      if (this.experience.audio) {
        const fallSpeed = Math.abs(this.velocity.y)
        const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z)
        this.experience.audio.updateDivingWind(fallSpeed, horizSpeed, this.isParachuteOpen)
      }

      // ── Altitude & Landing Target Check ────────────────────────────────────
      const distToTarget = Math.hypot(
        this.group.position.x - this.targetPos.x,
        this.group.position.z - this.targetPos.z
      )

      let groundY = 22.0
      if (distToTarget <= 5.0) {
        groundY = 22.8
      } else if (distToTarget <= 50.0) {
        groundY = 22.7
      } else if (distToTarget <= 54.0) {
        groundY = 22.3
      }

      const currentAlt = Math.max(0, this.group.position.y - groundY)
      const altEl = document.getElementById('hud-alt')
      const distEl = document.getElementById('hud-target-dist')

      // Parachute: player pulls with F / E once low enough; forced open at the safety altitude
      if (!this.isParachuteOpen) {
        const canPull = currentAlt <= this.chutePromptAlt
        if (this.experience.hud) this.experience.hud.showChutePrompt(canPull)

        if (canPull && controls.wasPressed('chute')) {
          if (currentAlt <= this.chuteBonusAlt) {
            this.chuteBonus = this.chuteBonusPoints
            const popup = this.experience.world.rings
            if (popup) popup._showCollectPopup(`+${this.chuteBonusPoints} PTS LOW PULL BONUS!`)
          }
          this._deployParachute()
        } else if (currentAlt <= this.chuteAutoAlt) {
          this._deployParachute()
        }
      }

      // Ground touchdown check
      const isTouchdown = this.group.position.y <= (groundY + 0.15) || currentAlt <= 0.15

      if (isTouchdown) {
        this.group.position.y = groundY // Flush on target surface - zero gap!
        this.state = 'landed'
        this.velocity.set(0, 0, 0)

        // Audio: Stop diving wind and play ground touchdown impact & victory fanfare (only if target hit)
        if (this.experience.audio) {
          this.experience.audio.stopDivingWind(0.25)
          const isBullseye = (distToTarget <= 5.0)
          const isTargetHit = (distToTarget <= 54.0 && this.isParachuteOpen)
          this.experience.audio.playTouchdown(isBullseye, isTargetHit)
        }

        if (this.experience.controls) {
          this.experience.controls.setFlightActive(false)
          this.experience.controls.exitPointerLock()
        }
        if (document.exitPointerLock) {
          try {
            document.exitPointerLock()
          } catch (e) {}
        }

        if (this.physicsHandle && this.physicsHandle.rigidBody) {
          this.physicsHandle.rigidBody.setTranslation(
            { x: this.group.position.x, y: groundY, z: this.group.position.z },
            true
          )
          this.physicsHandle.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }

        // Parachute disappears immediately on landing
        if (this.parachute) {
          this.parachute.visible = false
        }

        // Stand upright cleanly
        this.model.rotation.x = 0
        this.pitchAngle = 0
        this.rollAngle = 0
        this.group.rotation.set(0, this.headingAngle, 0)

        // Show 0 m
        if (altEl) altEl.innerText = '0 m'
        if (distEl) distEl.innerText = `${Math.round(distToTarget)} m`

        // Display score modal popup
        this.calculateLandingScore()
        return
      }

      if (altEl) altEl.innerText = `${Math.round(currentAlt)} m`
      if (distEl) distEl.innerText = `${Math.round(distToTarget)} m`
    }
  }
}

import * as THREE from 'three'
import Island from './Island.js'
import Environment from './Environment.js'
import Plane from './Plane.js'
import Character from './Character.js'
import Rings from './Rings.js'
import Clouds from './Clouds.js'
import WindStreaks from './WindStreaks.js'
import ZignutsSign from './ZignutsSign.js'

export default class World {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    // Game Sequence state: 'menu', 'takeoff', 'playing'
    this.sequenceState = 'menu'
    this.sequenceTimer = 0
    // Automatic exit: short countdown once the plane levels off on the drop run (plane.state === 'cruise')
    this.jumpCountdown = 3.0
    this.cruiseTimer = 0

    // HDRI environment — IBL lighting
    this.environment = new Environment(experience)

    // Island terrain with runway, airport buildings, and central archery landing rings
    this.island = new Island(experience)

    // Atmospheric procedural shader cloud banks across high and mid sky
    this.clouds = new Clouds(experience)

    // Aircraft at start of long runway
    this.plane = new Plane(experience)

    // Character
    this.character = new Character(experience)

    // Aerodynamic GPU wind speed streaks shader around falling skydiver
    this.windStreaks = new WindStreaks(experience)

    // Hollywood-style ZIGNUTS sign on the west peak (planted once the island terrain has loaded)
    this.zignutsSign = new ZignutsSign(experience)

    // Stunt rings (+10 PTS each) along the flight descent route
    this.rings = new Rings(experience)
  }

  startGameplay() {
    this.sequenceState = 'takeoff'
    this.sequenceTimer = 0
    this.cruiseTimer = 0

    // Rings are laid out once the drop run is known (see cruise below)
    if (this.rings) {
      this.rings.clear()
    }

    // Initialize Web Audio API and start plane engine sound
    if (this.experience.audio) {
      this.experience.audio.ensureContext()
      this.experience.audio.startPlaneEngine()
    }

    // Character boards the aircraft
    this.character.enterPlane()

    // Plane starts engine and accelerates along the long 350m runway
    this.plane.startTakeoff()

    // Switch camera to dynamic chase of takeoff
    this.experience.camera.setMode('cinematic_takeoff')
  }

  // Where the diver will leave the plane when the countdown ends: the plane holds its heading
  // toward the target while its speed eases (exponential damp) toward cruise speed
  _predictExitPoint() {
    const plane = this.plane
    const f = plane.flight
    const T = this.jumpCountdown
    const distance = f.cruiseSpeed * T + (plane.speed - f.cruiseSpeed) * (1 - Math.exp(-1.5 * T)) / 1.5
    const exit = plane.group.position.clone()
    exit.x += Math.sin(plane.currentHeading) * distance
    exit.z += Math.cos(plane.currentHeading) * distance
    exit.y -= 4.0 // jumpFromPlane drops the diver 4 m below the plane
    return exit
  }

  _jump() {
    this.sequenceState = 'playing'
    this.sequenceTimer = 0

    if (this.experience.hud) this.experience.hud.showJumpCountdown(false)

    // Eject character high over the island pointed directly at archery target
    this.character.jumpFromPlane(this.plane.group.position, this.plane.runwayHeading)
    this.character.setPlayable()

    // Slide the ring layout onto the actual exit point (corrects small prediction drift)
    if (this.rings && this.predictedExit) {
      const drift = new THREE.Vector3().subVectors(this.character.group.position, this.predictedExit)
      this.rings.shiftBy(drift)
    }

    this.experience.controls.requestPointerLock()

    // Audio: play cabin ejection whoosh, fade plane into distance, and start freefall wind rush
    if (this.experience.audio) {
      this.experience.audio.playJumpWhoosh()
      this.experience.audio.fadePlaneEngine(2.8)
      this.experience.audio.startDivingWind()
    }

    // Hide plane immediately after dropping character so it never shows or drops again
    this.plane.group.visible = false

    // Directly enable player chase camera for instant WASD & mouse control
    this.experience.camera.setMode('follow_skydiver')
    this.experience.camera.kick(0.8)

    // Show in-game HUD with Target telemetry & Rings counter
    const hud = document.getElementById('gameplay-hud')
    if (hud) hud.classList.add('visible')
  }

  update() {
    const delta = this.experience.time.delta

    if (this.zignutsSign) this.zignutsSign.update()
    if (this.clouds) this.clouds.update(delta)
    if (this.plane) this.plane.update(delta)
    if (this.character) this.character.update(delta)
    if (this.windStreaks && this.character) this.windStreaks.update(delta, this.character)
    // Only track ring hits/misses while actually skydiving (runway position would mark them all missed)
    if (this.rings && this.character && this.character.state === 'playable') {
      this.rings.update(delta, this.character.group.position)
    }

    if (this.sequenceState === 'takeoff') {
      this.sequenceTimer += delta

      // Engine pitch & throttle follow airspeed
      if (this.experience.audio) {
        this.experience.audio.updatePlaneEngine(Math.min(1, this.plane.speed / this.plane.flight.turnSpeed) * 9.0)
      }

      // Automatic jump: countdown starts when the plane levels off over the drop run
      if (this.plane.state === 'cruise') {
        if (this.cruiseTimer === 0 && this.rings) {
          this.predictedExit = this._predictExitPoint()
          this.rings.spawnAlong(this.predictedExit)
        }
        this.cruiseTimer += delta
        const hudUi = this.experience.hud
        const remaining = Math.max(0, this.jumpCountdown - this.cruiseTimer)
        if (hudUi) hudUi.showJumpCountdown(true, remaining, remaining / this.jumpCountdown)

        if (remaining <= 0) {
          this._jump()
        }
      }
    }
  }
}

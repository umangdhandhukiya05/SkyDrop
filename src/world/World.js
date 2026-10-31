import Island from './Island.js'
import Environment from './Environment.js'
import Plane from './Plane.js'
import Character from './Character.js'

export default class World {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    // Game Sequence state: 'menu', 'takeoff', 'dive_transition', 'playing'
    this.sequenceState = 'menu'
    this.sequenceTimer = 0

    // HDRI environment — IBL lighting
    this.environment = new Environment(experience)

    // Island terrain with runway, airport buildings, and central archery landing rings
    this.island = new Island(experience)

    // Aircraft at start of long runway
    this.plane = new Plane(experience)

    // Character
    this.character = new Character(experience)
  }

  startGameplay() {
    this.sequenceState = 'takeoff'
    this.sequenceTimer = 0

    // Character boards the aircraft
    this.character.enterPlane()

    // Plane starts engine and accelerates along the long 350m runway
    this.plane.startTakeoff()

    // Switch camera to dynamic chase of takeoff
    this.experience.camera.setMode('cinematic_takeoff')
  }

  update() {
    const delta = this.experience.time.delta

    if (this.plane) this.plane.update(delta)
    if (this.character) this.character.update(delta)

    if (this.sequenceState === 'takeoff') {
      this.sequenceTimer += delta

      // After 10s (runway acceleration, liftoff, climb to doubled altitude 760m over the island):
      // Drop character ONCE directly into player control, and immediately hide plane so it does not show again!
      if (this.sequenceTimer >= 10.0) {
        this.sequenceState = 'playing'
        this.sequenceTimer = 0

        // Eject character high over the island pointed directly at archery target
        this.character.jumpFromPlane(this.plane.group.position, this.plane.runwayHeading)
        this.character.setPlayable()

        // Hide plane immediately after dropping character so it never shows or drops again
        this.plane.group.visible = false

        // Directly enable player chase camera for instant WASD control
        this.experience.camera.setMode('follow_skydiver')

        // Show in-game HUD with Target telemetry
        const hud = document.getElementById('gameplay-hud')
        if (hud) hud.classList.add('visible')
      }
    }
  }
}

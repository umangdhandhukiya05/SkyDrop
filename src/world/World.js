import Island from './Island.js'
import Environment from './Environment.js'
import Plane from './Plane.js'
import Character from './Character.js'
import Rings from './Rings.js'
import Clouds from './Clouds.js'
import WindStreaks from './WindStreaks.js'

export default class World {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    // Game Sequence state: 'menu', 'takeoff', 'playing'
    this.sequenceState = 'menu'
    this.sequenceTimer = 0

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

    // Stunt rings (+10 PTS each) along the flight descent route
    this.rings = new Rings(experience)
  }

  startGameplay() {
    this.sequenceState = 'takeoff'
    this.sequenceTimer = 0

    if (this.rings) {
      this.rings.reset()
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

  update() {
    const delta = this.experience.time.delta

    if (this.clouds) this.clouds.update(delta)
    if (this.plane) this.plane.update(delta)
    if (this.character) this.character.update(delta)
    if (this.windStreaks && this.character) this.windStreaks.update(delta, this.character)
    if (this.rings && this.character) this.rings.update(delta, this.character.group.position)

    if (this.sequenceState === 'takeoff') {
      this.sequenceTimer += delta

      // Update engine audio pitch & throttle with runway progress
      if (this.experience.audio) {
        this.experience.audio.updatePlaneEngine(this.sequenceTimer)
      }

      // After 10s (runway acceleration, liftoff, climb to 960m over the island):
      // Drop character ONCE directly into player control, and immediately hide plane so it does not show again!
      if (this.sequenceTimer >= 10.0) {
        this.sequenceState = 'playing'
        this.sequenceTimer = 0

        // Eject character high over the island pointed directly at archery target
        this.character.jumpFromPlane(this.plane.group.position, this.plane.runwayHeading)
        this.character.setPlayable()

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

        // Show in-game HUD with Target telemetry & Rings counter
        const hud = document.getElementById('gameplay-hud')
        if (hud) hud.classList.add('visible')
      }
    }
  }
}

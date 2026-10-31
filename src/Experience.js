import * as THREE from 'three'
import Sizes from './system/Sizes.js'
import Time from './system/Time.js'
import Camera from './system/Camera.js'
import Renderer from './system/Renderer.js'
import Loader from './system/Loader.js'
import Controls from './system/Controls.js'
import Physics from './system/Physics.js'
import World from './world/World.js'

export default class Experience {
  // Singleton
  static _instance = null

  constructor(canvas) {
    if (Experience._instance) {
      return Experience._instance
    }
    Experience._instance = this

    // Store canvas
    this.canvas = canvas

    // Core systems
    this.sizes = new Sizes()
    this.time = new Time()
    this.scene = new THREE.Scene()

    // Fog — gives depth to the sky scene
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0006)

    // Keyboard controls system (WASD, Space, Shift)
    this.controls = new Controls()

    // Physics system powered by Rapier3D
    this.physics = new Physics()

    // Loader
    this.loader = new Loader()

    // Camera
    this.camera = new Camera(this)

    // Renderer
    this.renderer = new Renderer(this)

    // World
    this.world = new World(this)

    // Kick off the loop
    this.time.addEventListener('tick', () => this._update())
  }

  _update() {
    const delta = this.time.delta
    if (this.physics) this.physics.update(delta)
    this.camera.update()
    this.world.update()
    this.renderer.update()
  }
}

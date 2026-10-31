import * as THREE from 'three'

export default class Time extends THREE.EventDispatcher {
  constructor() {
    super()

    this.clock = new THREE.Clock()
    this.elapsed = 0
    this.delta = 0

    this._tick = this._tick.bind(this)
    this._tick()
  }

  _tick() {
    this.delta = this.clock.getDelta()      // seconds since last frame
    this.elapsed = this.clock.getElapsedTime()

    this.dispatchEvent({ type: 'tick' })

    window.requestAnimationFrame(this._tick)
  }
}

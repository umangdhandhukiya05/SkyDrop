import * as THREE from 'three'

export default class Sizes extends THREE.EventDispatcher {
  constructor() {
    super()

    // Initial sizes
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)
    this.aspect = this.width / this.height

    // Resize event
    window.addEventListener('resize', () => {
      this.width = window.innerWidth
      this.height = window.innerHeight
      this.pixelRatio = Math.min(window.devicePixelRatio, 2)
      this.aspect = this.width / this.height

      this.dispatchEvent({ type: 'resize' })
    })
  }
}

import * as THREE from 'three'

export default class Lighting {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this._addAmbientLight()
    this._addSunLight()
    this._addFillLight()
  }

  _addAmbientLight() {
    // Soft sky-blue ambient — mimics open sky
    const ambient = new THREE.AmbientLight(0xc8e8ff, 0.8)
    this.scene.add(ambient)
  }

  _addSunLight() {
    // Main directional sun light with shadows
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.0)
    this.sun.position.set(80, 100, 60)
    this.sun.castShadow = true

    // Shadow map config
    this.sun.shadow.mapSize.width = 2048
    this.sun.shadow.mapSize.height = 2048
    this.sun.shadow.camera.near = 0.5
    this.sun.shadow.camera.far = 500
    this.sun.shadow.camera.left = -150
    this.sun.shadow.camera.right = 150
    this.sun.shadow.camera.top = 150
    this.sun.shadow.camera.bottom = -150
    this.sun.shadow.bias = -0.001

    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
  }

  _addFillLight() {
    // Soft warm fill from below — bounce light from ground
    const fill = new THREE.DirectionalLight(0xffd580, 0.8)
    fill.position.set(-60, -20, -60)
    this.scene.add(fill)
  }
}

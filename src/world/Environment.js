import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

// Vite resolves this at build time → hashed URL, works in dev & prod
import hdriUrl from '../assets/hdri/kloofendal_48d_partly_cloudy_2k.hdr?url'

export default class Environment {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.renderer = experience.renderer

    this._loadHDRI()
  }

  async _loadHDRI() {
    const rgbeLoader = new RGBELoader()
    const pmrem = new THREE.PMREMGenerator(this.renderer.instance)
    pmrem.compileEquirectangularShader()

    try {
      const texture = await new Promise((resolve, reject) =>
        rgbeLoader.load(hdriUrl, resolve, undefined, reject)
      )

      const envMap = pmrem.fromEquirectangular(texture).texture

      // ✅ IBL environment lighting on all materials
      this.scene.environment = envMap
      this.scene.environmentIntensity = 1.2   // full IBL — no other lights in scene

      // ❌ Do NOT set scene.background — keep the renderer clear color (sky blue)
      // this.scene.background = envMap  <-- intentionally omitted

      // Free GPU memory we no longer need
      texture.dispose()
      pmrem.dispose()

      console.log('✅ HDRI environment applied (lighting only, no background)')
    } catch (err) {
      console.warn('⚠️ HDRI failed to load:', err)
    }
  }
}

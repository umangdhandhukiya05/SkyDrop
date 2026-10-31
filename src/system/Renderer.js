import * as THREE from 'three'

export default class Renderer {
  constructor(experience) {
    this.experience = experience
    this.canvas = experience.canvas
    this.sizes = experience.sizes
    this.scene = experience.scene
    this.camera = experience.camera

    this._createRenderer()
    this._listenResize()
  }

  _createRenderer() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    })

    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(this.sizes.pixelRatio)

    // ── Color correctness ───────────────────────────────────────────────────
    // SRGBColorSpace is CRITICAL — without it all colors appear faded/washed out
    this.instance.outputColorSpace = THREE.SRGBColorSpace

    // NeutralToneMapping keeps material colors vivid; ACES tends to desaturate
    this.instance.toneMapping = THREE.NeutralToneMapping
    this.instance.toneMappingExposure = 1.0   // 1.0 = physically neutral

    // Shadows disabled (no directional lights — HDRI handles all lighting)
    this.instance.shadowMap.enabled = false

    // Sky blue background
    this.instance.setClearColor(new THREE.Color('#87CEEB'), 1)
  }

  _listenResize() {
    this.sizes.addEventListener('resize', () => {
      this.instance.setSize(this.sizes.width, this.sizes.height)
      this.instance.setPixelRatio(this.sizes.pixelRatio)
    })
  }

  update() {
    this.instance.render(this.scene, this.camera.instance)
  }
}

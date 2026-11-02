import * as THREE from 'three'

// Hollywood-style hillside sign: giant Zignuts-blue letter panels on posts, planted along the slope of the
// west peak so they face the landing target and the incoming drop run
export default class ZignutsSign {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this.text = 'ZIGNUTS'
    this.letterHeight = 36
    this.letterGap = 5

    // West peak (from the island terrain) — straight ahead past the bullseye on the drop run
    this.peak = new THREE.Vector3(-643, 261, 157)
    this.target = new THREE.Vector3(0, 0, 0)
    // All letters stand on this contour (fraction of peak height), like the real sign on its hillside
    this.slopeHeightRatio = 0.45

    this.group = new THREE.Group()
    this.group.name = 'Zignuts_Hillside_Sign'
    this.placed = false
    this._placing = false
    this._raycaster = new THREE.Raycaster()
  }

  // Ground height under (x, z) on the island, or null if nothing is hit
  _groundY(terrain, x, z) {
    this._raycaster.set(new THREE.Vector3(x, 2000, z), new THREE.Vector3(0, -1, 0))
    const hit = this._raycaster.intersectObject(terrain, true)[0]
    return hit ? hit.point.y : null
  }

  _createLetterTexture(char) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const fontSize = 400
    ctx.font = `700 ${fontSize}px Poppins, sans-serif`
    const width = Math.ceil(ctx.measureText(char).width) + 24
    canvas.width = width
    // Poppins cap height ≈ 0.7 em: crop the canvas to the caps so panel height ≈ letter height
    canvas.height = Math.ceil(fontSize * 0.72) + 16

    ctx.font = `700 ${fontSize}px Poppins, sans-serif`
    ctx.fillStyle = '#1490FE' // Zignuts Vivid Blue
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(char, width / 2, canvas.height - 8)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.experience.renderer?.instance?.capabilities.getMaxAnisotropy() || 4
    return { texture, aspect: width / canvas.height }
  }

  async place(terrain) {
    if (this.placed || this._placing) return
    this._placing = true

    try {
      await document.fonts.load('700 400px Poppins')
    } catch (e) {}

    terrain.updateMatrixWorld(true)

    // Facing: toward the landing target; letters run left→right as seen from there
    const facing = new THREE.Vector3().subVectors(this.target, this.peak).setY(0).normalize()
    const right = new THREE.Vector3(facing.z, 0, -facing.x)

    const peakY = this._groundY(terrain, this.peak.x, this.peak.z) ?? this.peak.y
    const contourY = peakY * this.slopeHeightRatio

    // From a point beside the summit, how far down the target-facing slope until reaching the contour
    const contourDepth = (offset) => {
      const p = this.peak.clone().addScaledVector(right, offset)
      for (let depth = 2; depth <= 600; depth += 2) {
        p.addScaledVector(facing, 2)
        const y = this._groundY(terrain, p.x, p.z)
        if (y !== null && y <= contourY) return depth
      }
      return 600
    }
    const centerDepth = contourDepth(0)
    const center = this.peak.clone().addScaledVector(facing, centerDepth)
    center.y = contourY

    const panelMaterialBase = {
      color: 0xffffff, // tinted by the Zignuts-blue letter texture
      emissive: 0x1490fe,
      emissiveIntensity: 0.35, // stays readable on the shaded side of the mountain
      roughness: 0.6,
      side: THREE.DoubleSide,
      alphaTest: 0.5
    }
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.8 })
    const postGeometry = new THREE.BoxGeometry(0.8, 1, 0.8)

    const letters = [...this.text].map((char) => {
      const { texture, aspect } = this._createLetterTexture(char)
      const height = this.letterHeight
      return { char, texture, width: height * aspect, height }
    })
    const totalWidth = letters.reduce((sum, l) => sum + l.width, 0) + this.letterGap * (letters.length - 1)

    let cursor = -totalWidth / 2

    letters.forEach((letter) => {
      const offset = cursor + letter.width / 2
      cursor += letter.width + this.letterGap

      // Follow the contour, but keep the line fairly straight: on a cone-shaped peak the ends would
      // otherwise curl back and overlap their neighbours when seen from the landing area
      const depth = THREE.MathUtils.clamp(contourDepth(offset), centerDepth - 15, centerDepth + 20)
      const spot = this.peak.clone().addScaledVector(right, offset).addScaledVector(facing, depth)
      const x = spot.x
      const z = spot.z
      const yaw = Math.atan2(this.target.x - x, this.target.z - z)

      // Every letter shares one level baseline on the contour; where the slope falls away the
      // posts carry it, and it is only raised if the ground would bury the panel
      const samples = [-0.45, 0, 0.45].map((t) =>
        this._groundY(terrain, x + right.x * letter.width * t, z + right.z * letter.width * t)
      ).filter((y) => y !== null)
      const ground = samples.length ? Math.max(...samples) : contourY
      const baseY = Math.max(contourY, ground) - 2.0

      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(letter.width, letter.height),
        new THREE.MeshStandardMaterial({ ...panelMaterialBase, map: letter.texture })
      )
      panel.position.set(x, baseY + letter.height / 2, z)
      panel.rotation.y = yaw
      panel.name = `Zignuts_Sign_${letter.char}`
      this.group.add(panel)

      // Two support posts behind each panel, down to the slope
      ;[-0.28, 0.28].forEach((t) => {
        const px = x + right.x * letter.width * t - facing.x * 1.2
        const pz = z + right.z * letter.width * t - facing.z * 1.2
        const postGround = this._groundY(terrain, px, pz) ?? ground
        const top = baseY + letter.height * 0.8
        const postHeight = Math.max(2, top - postGround + 2)
        const post = new THREE.Mesh(postGeometry, postMaterial)
        post.scale.y = postHeight
        post.position.set(px, postGround - 2 + postHeight / 2, pz)
        post.rotation.y = yaw
        this.group.add(post)
      })
    })

    this.scene.add(this.group)
    this.placed = true
    console.log(`✅ ZIGNUTS hillside sign planted at (${center.x.toFixed(0)}, ${center.y.toFixed(0)}, ${center.z.toFixed(0)})`)
  }

  update() {
    const island = this.experience.world?.island
    if (!this.placed && island && island.model) {
      this.place(island.model)
    }
  }
}

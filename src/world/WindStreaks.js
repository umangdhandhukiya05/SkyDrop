import * as THREE from 'three'

export default class WindStreaks {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this.group = new THREE.Group()
    this.group.name = 'Wind_Speed_Streaks'
    this.scene.add(this.group)

    this.numStreaks = 24
    this.timeUniform = { value: 0 }
    this.speedUniform = { value: 0 }
    this.opacityUniform = { value: 0 }

    this._createWindShader()
  }

  _createWindShader() {
    // Generate streak line segments (2 vertices per streak: head and tail)
    const positions = new Float32Array(this.numStreaks * 2 * 3)
    const progress = new Float32Array(this.numStreaks * 2)
    const offsets = new Float32Array(this.numStreaks * 2 * 3)
    const randomSeeds = new Float32Array(this.numStreaks * 2)

    for (let i = 0; i < this.numStreaks; i++) {
      // Cylindrical distribution around character
      const angle = Math.random() * Math.PI * 2
      const radius = 0.6 + Math.random() * 3.8
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = (Math.random() - 0.5) * 12.0

      const seed = Math.random()

      // Head vertex
      positions[i * 6 + 0] = x
      positions[i * 6 + 1] = y
      positions[i * 6 + 2] = z
      progress[i * 2 + 0] = 0.0
      offsets[i * 6 + 0] = x
      offsets[i * 6 + 1] = y
      offsets[i * 6 + 2] = z
      randomSeeds[i * 2 + 0] = seed

      // Tail vertex
      positions[i * 6 + 3] = x
      positions[i * 6 + 4] = y + 2.5
      positions[i * 6 + 5] = z
      progress[i * 2 + 1] = 1.0
      offsets[i * 6 + 3] = x
      offsets[i * 6 + 4] = y
      offsets[i * 6 + 5] = z
      randomSeeds[i * 2 + 1] = seed
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(randomSeeds, 1))

    const vertexShader = `
      attribute float aProgress;
      attribute vec3 aOffset;
      attribute float aSeed;

      uniform float uTime;
      uniform float uSpeed;
      uniform vec3 uVelocityDir;

      varying float vProg;
      varying float vAlpha;

      void main() {
        vProg = aProgress;

        // Animate particles rushing backwards along the flight velocity direction
        float streamSpeed = max(8.0, uSpeed * 1.4);
        float cycle = fract(uTime * (streamSpeed * 0.08) + aSeed);

        // Streak length stretches proportionally to dive speed
        float streakLength = 1.2 + uSpeed * 0.12;

        // Local displacement from stream cycle
        float travelDist = (cycle - 0.5) * 18.0;

        // Position head vs tail along the flight velocity vector
        vec3 pos = aOffset - uVelocityDir * (travelDist + aProgress * streakLength);

        vAlpha = smoothstep(0.0, 0.2, cycle) * smoothstep(1.0, 0.8, cycle);

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `

    const fragmentShader = `
      uniform float uOpacity;
      uniform vec3 uColor;

      varying float vProg;
      varying float vAlpha;

      void main() {
        // Taper opacity at head and tail of streak
        float taper = sin(vProg * 3.14159);
        float alpha = taper * vAlpha * uOpacity;

        if (alpha < 0.01) discard;

        gl_FragColor = vec4(uColor, alpha);
      }
    `

    this.windMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: this.timeUniform,
        uSpeed: this.speedUniform,
        uOpacity: this.opacityUniform,
        uVelocityDir: { value: new THREE.Vector3(0, -1, 0) },
        uColor: { value: new THREE.Color('#d4f1f9') } // Crisp aerodynamic white-cyan
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    this.linesMesh = new THREE.LineSegments(geometry, this.windMaterial)
    this.linesMesh.frustumCulled = false
    this.group.add(this.linesMesh)

    console.log('✅ GPU Wind speed streaks shader initialized')
  }

  update(delta, character) {
    if (!character || character.state === 'runway' || character.state === 'in_plane' || character.state === 'landed') {
      this.opacityUniform.value = THREE.MathUtils.damp(this.opacityUniform.value, 0, 8.0, delta)
      return
    }

    this.timeUniform.value += delta

    // Anchor the wind streaks around the falling character
    const charPos = character.group.position
    this.group.position.copy(charPos)

    // Compute speed and normalized flight direction
    const vel = character.velocity
    const speed = vel.length()
    this.speedUniform.value = THREE.MathUtils.damp(this.speedUniform.value, speed, 6.0, delta)

    if (speed > 1.0) {
      this.windMaterial.uniforms.uVelocityDir.value.copy(vel).normalize()
    }

    // Opacity is subtle and gentle so it never obscures vision
    let targetOpacity = 0.0
    if (character.state === 'playable') {
      if (character.isParachuteOpen) {
        targetOpacity = 0.06 // Extremely soft air stream under parachute
      } else {
        // Subtle whisper of wind lines during wingsuit flight
        targetOpacity = THREE.MathUtils.clamp((speed - 10.0) / 36.0, 0.0, 0.20)
      }
    }

    this.opacityUniform.value = THREE.MathUtils.damp(this.opacityUniform.value, targetOpacity, 5.0, delta)
  }
}


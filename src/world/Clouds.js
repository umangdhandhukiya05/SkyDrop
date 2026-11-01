import * as THREE from 'three'

export default class Clouds {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this.group = new THREE.Group()
    this.group.name = 'Atmospheric_Clouds'
    this.scene.add(this.group)

    this.timeUniform = { value: 0 }
    this.materials = []

    this._createShaderMaterial()
    this._spawnCloudBanks()
  }

  _createShaderMaterial() {
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `

    const fragmentShader = `
      uniform float uTime;
      uniform vec3 uSunColor;
      uniform vec3 uCloudColor;
      uniform float uDensity;

      varying vec2 vUv;
      varying vec3 vWorldPosition;

      // 2D Noise & Fractal Brownian Motion (fBM)
      float hash(vec2 p) {
        p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
        return -1.0 + 2.0 * fract(17.0 * fract(p.x * p.y * (p.x + p.y)));
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 4; ++i) {
          v += a * noise(p);
          p = rot * p * 2.05 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        float dist = length(uv);
        if (dist > 1.0) discard;

        // Soft radial falloff for fluffy cloud bounds
        float mask = smoothstep(1.0, 0.08, dist);

        // Procedural animated cloud turbulence
        vec2 noiseCoord = vUv * 3.2 + vec2(uTime * 0.012, uTime * 0.008);
        float n = fbm(noiseCoord) * 0.5 + 0.5;

        // Density threshold shaping the clouds
        float cloudShape = smoothstep(0.28, 0.72, n * mask);
        float alpha = cloudShape * uDensity;

        if (alpha < 0.01) discard;

        // Warm directional sunlight on top, soft atmospheric tint on underside
        float sunLit = smoothstep(-0.4, 0.7, uv.y + n * 0.25);
        vec3 finalColor = mix(uCloudColor, uSunColor, sunLit);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `

    this.cloudShaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: this.timeUniform,
        uSunColor: { value: new THREE.Color('#fffbf0') },     // Warm sunlight
        uCloudColor: { value: new THREE.Color('#cce5f5') },   // Sky ambient tint
        uDensity: { value: 0.85 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  }

  _spawnCloudBanks() {
    const geom = new THREE.PlaneGeometry(1, 1)

    // Placement of glorious clouds across the flight corridor and island skies
    const cloudConfigs = [
      // High clouds near jump altitude (700m - 900m)
      { pos: new THREE.Vector3(460, 850, 80),   scale: new THREE.Vector3(260, 180, 1), rotX: -Math.PI / 2, density: 0.85 },
      { pos: new THREE.Vector3(370, 780, -40),  scale: new THREE.Vector3(220, 160, 1), rotX: -Math.PI / 2, density: 0.80 },
      { pos: new THREE.Vector3(420, 710, 120),  scale: new THREE.Vector3(240, 170, 1), rotX: -Math.PI / 2, density: 0.75 },

      // Mid clouds around 450m - 600m (near Ring 2)
      { pos: new THREE.Vector3(280, 560, 60),   scale: new THREE.Vector3(280, 200, 1), rotX: -Math.PI / 2, density: 0.82 },
      { pos: new THREE.Vector3(210, 500, -70),  scale: new THREE.Vector3(250, 180, 1), rotX: -Math.PI / 2, density: 0.78 },
      { pos: new THREE.Vector3(310, 440, 110),  scale: new THREE.Vector3(230, 160, 1), rotX: -Math.PI / 2, density: 0.80 },

      // Lower atmospheric cloud deck around 300m - 380m
      { pos: new THREE.Vector3(140, 360, 40),   scale: new THREE.Vector3(240, 170, 1), rotX: -Math.PI / 2, density: 0.75 },
      { pos: new THREE.Vector3(50, 320, -60),   scale: new THREE.Vector3(210, 150, 1), rotX: -Math.PI / 2, density: 0.70 },
      { pos: new THREE.Vector3(180, 280, 90),   scale: new THREE.Vector3(220, 160, 1), rotX: -Math.PI / 2, density: 0.72 },

      // Outer scenic sea clouds framing the horizon
      { pos: new THREE.Vector3(-350, 600, -250), scale: new THREE.Vector3(450, 300, 1), rotX: -Math.PI / 2, density: 0.85 },
      { pos: new THREE.Vector3(-250, 750, 380),  scale: new THREE.Vector3(420, 280, 1), rotX: -Math.PI / 2, density: 0.80 },
      { pos: new THREE.Vector3(650, 680, -320),  scale: new THREE.Vector3(480, 320, 1), rotX: -Math.PI / 2, density: 0.82 }
    ]

    cloudConfigs.forEach((cfg) => {
      const mat = this.cloudShaderMaterial.clone()
      mat.uniforms.uTime = this.timeUniform
      mat.uniforms.uDensity = { value: cfg.density }
      this.materials.push(mat)

      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(cfg.pos)
      mesh.scale.copy(cfg.scale)
      mesh.rotation.x = cfg.rotX
      mesh.rotation.z = Math.random() * Math.PI * 2

      this.group.add(mesh)
    })

    console.log(`✅ ${cloudConfigs.length} Shader procedural cloud banks created across the sky`)
  }

  update(delta) {
    this.timeUniform.value += delta
  }
}


import * as THREE from 'three'
import planeUrl from '../assets/models/skyDrop_plane.glb?url'

export default class AirportPlanes {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.loader = experience.loader

    this.group = new THREE.Group()
    this.group.name = 'Airport_Planes'
    this.scene.add(this.group)

    this.planes = []

    // Runway reference vector from start position (427.0, 11.35, 550.84) along 140°
    const runwayHeading = THREE.MathUtils.degToRad(140)
    const fX = Math.sin(runwayHeading)
    const fZ = Math.cos(runwayHeading)
    const rX = fZ
    const rZ = -fX
    const startX = 427.0
    const startY = 11.35
    const startZ = 550.84

    // Helper to calculate world coordinates given longitudinal distance along runway & lateral offset
    const getPos = (along, lat) => ({
      x: startX + along * fX + lat * rX,
      y: startY,
      z: startZ + along * fZ + lat * rZ
    })

    // ── 10 Parked Planes on Both Sides of Runway ──
    // Positive lateral offset = Right side (Control Tower, Main Apron, Hangar)
    // Negative lateral offset = Left side (Runway tie-downs / open airfield)
    this.planeConfigs = [
      // ── RIGHT SIDE: Terminal & Hangar Apron ──
      {
        id: 'R1_Sport_Crimson',
        pos: getPos(25, 46),
        headingDeg: 65,
        scale: 1.1,
        bodyColor: 0xf8fafc,      // Alpine White
        accentColor: 0xdc2626,    // Racing Crimson
        spinnerColor: 0xdc2626,
        metalness: 0.08,
        roughness: 0.28,
        idleSpin: 0
      },
      {
        id: 'R2_VIP_NavyGold',
        pos: getPos(75, 38),
        headingDeg: 78,
        scale: 1.72,              // Large Executive Transport
        bodyColor: 0x0a192f,      // Deep Sapphire Navy
        accentColor: 0xf59e0b,    // Warm Metallic Gold
        spinnerColor: 0xd97706,   // Polished Gold
        metalness: 0.35,
        roughness: 0.22,
        idleSpin: 0.45            // Gentle slow idle warmup
      },
      {
        id: 'R3_Emerald_Charter',
        pos: getPos(125, 45),
        headingDeg: 80,
        scale: 1.35,              // Medium Charter Plane
        bodyColor: 0xf1f5f9,      // Pearl White
        accentColor: 0x059669,    // Emerald Green
        spinnerColor: 0x047857,
        metalness: 0.12,
        roughness: 0.26,
        idleSpin: 0
      },
      {
        id: 'R4_Hangar_SkyCargo',
        pos: getPos(175, 56),
        headingDeg: 115,
        scale: 1.62,              // Big Transport at Hangar
        bodyColor: 0x0284c7,      // Cobalt Sky Blue
        accentColor: 0xffffff,    // Crisp White Stripe
        spinnerColor: 0x0369a1,
        metalness: 0.15,
        roughness: 0.25,
        idleSpin: 0.35            // Gentle slow idle warmup
      },
      {
        id: 'R5_Canary_Acro',
        pos: getPos(220, 40),
        headingDeg: 85,
        scale: 1.0,               // Small Utility Plane
        bodyColor: 0xeab308,      // Vivid Aviation Yellow
        accentColor: 0x18181b,    // Jet Charcoal
        spinnerColor: 0x18181b,
        metalness: 0.1,
        roughness: 0.3,
        idleSpin: 0
      },

      // ── LEFT SIDE: Flight Line & Tie-Down Bays ──
      {
        id: 'L1_Rescue_Orange',
        pos: getPos(20, -26),
        headingDeg: 230,
        scale: 1.05,              // Small Trainer
        bodyColor: 0xea580c,      // Safety International Orange
        accentColor: 0xffffff,    // White Trim
        spinnerColor: 0x1e293b,
        metalness: 0.08,
        roughness: 0.3,
        idleSpin: 0.5             // Gentle idle
      },
      {
        id: 'L2_Platinum_Hawk',
        pos: getPos(70, -28),
        headingDeg: 215,
        scale: 1.68,              // Big Platinum Plane
        bodyColor: 0xcbd5e1,      // Polished Silver Metallic
        accentColor: 0x991b1b,    // Deep Ruby
        spinnerColor: 0xe2e8f0,
        metalness: 0.48,
        roughness: 0.2,
        idleSpin: 0
      },
      {
        id: 'L3_Glacier_Cyan',
        pos: getPos(130, -27),
        headingDeg: 225,
        scale: 1.28,              // Medium Island Hopper
        bodyColor: 0xffffff,      // Pure Snow White
        accentColor: 0x06b6d4,    // Bright Cyan
        spinnerColor: 0x0891b2,
        metalness: 0.1,
        roughness: 0.26,
        idleSpin: 0
      },
      {
        id: 'L4_Stealth_Lime',
        pos: getPos(195, -28),
        headingDeg: 235,
        scale: 1.45,              // Medium-Large Special
        bodyColor: 0x1f2937,      // Matte Dark Charcoal
        accentColor: 0x84cc16,    // Neon Lime
        spinnerColor: 0x111827,
        metalness: 0.2,
        roughness: 0.35,
        idleSpin: 0
      },
      {
        id: 'L5_Sunburst_Stunt',
        pos: getPos(250, -26),
        headingDeg: 220,
        scale: 0.95,              // Compact Aerobatics
        bodyColor: 0xe11d48,      // Crimson Berry
        accentColor: 0xfbbf24,    // Sunburst Yellow
        spinnerColor: 0xfbbf24,
        metalness: 0.12,
        roughness: 0.25,
        idleSpin: 0
      }
    ]

    this._load()
  }

  async _load() {
    try {
      const gltf = await this.loader.loadGLTF(planeUrl)
      const baseScene = gltf.scene

      // Common propeller tip material (Aviation Yellow)
      const propTipMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xfacc15),
        roughness: 0.35,
        metalness: 0.1
      })

      // Dark blade material
      const bladeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x1a1e23),
        roughness: 0.45,
        metalness: 0.25
      })

      // Tinted cockpit glass
      const glassMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x0f1c29),
        roughness: 0.05,
        metalness: 0.5,
        transparent: true,
        opacity: 0.88
      })

      for (const cfg of this.planeConfigs) {
        const planeGroup = new THREE.Group()
        planeGroup.name = `ParkedPlane_${cfg.id}`

        // Clone geometry and node hierarchy
        const model = baseScene.clone(true)

        // Custom materials for this livery
        const bodyMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(cfg.bodyColor),
          roughness: cfg.roughness,
          metalness: cfg.metalness
        })

        const accentMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(cfg.accentColor),
          roughness: Math.max(0.2, cfg.roughness - 0.05),
          metalness: cfg.metalness
        })

        const spinnerMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(cfg.spinnerColor || cfg.accentColor),
          roughness: 0.22,
          metalness: Math.min(0.5, cfg.metalness + 0.15)
        })

        let propeller = null

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true

            if (Array.isArray(child.material)) {
              child.material = child.material.map((m) => {
                if (m.name === 'MAT_Plane_White') return bodyMat
                if (m.name === 'MAT_Plane_Blue') return accentMat
                if (m.name === 'MAT_Cockpit_Glass') return glassMat
                if (m.name === 'MAT_Propeller') {
                  return child.name === 'SKY_Aircraft_Propeller' ? propTipMat : bladeMat
                }
                return m.clone()
              })
            } else {
              if (child.name === 'SKY_Aircraft_Spinner') {
                child.material = spinnerMat
              } else if (child.material.name === 'MAT_Plane_White') {
                child.material = bodyMat
              } else if (child.material.name === 'MAT_Plane_Blue') {
                child.material = accentMat
              } else if (child.material.name === 'MAT_Cockpit_Glass') {
                child.material = glassMat
              } else if (child.material.name === 'MAT_Propeller') {
                child.material = bladeMat
              }
            }
          }

          if (child.name === 'SKY_Aircraft_Propeller') {
            propeller = child
          }
        })

        // Scale and align belly with tarmac
        model.scale.setScalar(cfg.scale)
        model.position.y = -0.55 * cfg.scale

        planeGroup.add(model)

        // Orientation: nose is model -X, so rotate heading + PI/2
        const theta = THREE.MathUtils.degToRad(cfg.headingDeg)
        planeGroup.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z)
        planeGroup.rotation.set(0, theta + Math.PI / 2, 0)

        this.group.add(planeGroup)

        this.planes.push({
          group: planeGroup,
          propeller,
          idleSpin: cfg.idleSpin || 0
        })
      }

      console.log(`✅ Loaded ${this.planes.length} airport parked planes along runway`)
    } catch (err) {
      console.warn('⚠️ AirportPlanes failed to load:', err)
    }
  }

  update(delta) {
    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i]
      if (p.propeller && p.idleSpin > 0) {
        p.propeller.rotation.x += p.idleSpin * delta * 5.0
      }
    }
  }
}


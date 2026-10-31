import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export default class Island {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.loader = experience.loader

    this._load()
  }

  async _load() {
    try {
      const gltf = await this.loader.loadGLTF('/models/skydrop_island.glb')

      // Ensure every mesh material has correct color space and supports vertex colors
      gltf.scene.traverse((child) => {
        if (!child.isMesh) return

        if (child.geometry && child.geometry.attributes.color) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => { m.vertexColors = true; m.needsUpdate = true })
          } else if (child.material) {
            child.material.vertexColors = true
            child.material.needsUpdate = true
          }
        }

        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((mat) => {
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
          if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace
          mat.needsUpdate = true
        })
      })

      // Collect single-material meshes by material UUID to merge for performance
      // EXCLUDE the static island plane (Aircraft_TwinOtter) because user wants their own skyDrop_plane.glb
      const buckets = new Map()
      gltf.scene.updateMatrixWorld(true)

      gltf.scene.traverse((child) => {
        if (!child.isMesh) return
        if (child.name === 'Aircraft_TwinOtter') return // Skip static twin otter
        if (Array.isArray(child.material)) return

        const mat = child.material
        const geom = child.geometry.clone()
        geom.applyMatrix4(child.matrixWorld)

        if (!buckets.has(mat.uuid)) {
          buckets.set(mat.uuid, { mat, geoms: [] })
        }
        buckets.get(mat.uuid).geoms.push(geom)
      })

      const group = new THREE.Group()
      group.name = 'Island'

      // Merged single-material meshes
      for (const { mat, geoms } of buckets.values()) {
        let finalGeom = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false)
        if (!finalGeom) continue
        group.add(new THREE.Mesh(finalGeom, mat))
      }

      // Multi-material meshes
      gltf.scene.traverse((child) => {
        if (child.isMesh && Array.isArray(child.material)) {
          if (child.name === 'Aircraft_TwinOtter') return // Skip static plane
          group.add(child.clone())
        }
      })

      this.scene.add(group)
      this.model = group
      console.log(`✅ Island loaded — ${buckets.size} merged draw calls (excluding static TwinOtter)`)

      // Create Rapier trimesh colliders for all island objects (excluding static TwinOtter)
      this._createPhysicsColliders(gltf.scene)
    } catch (err) {
      console.error('❌ Island failed to load:', err)
    }
  }

  _createPhysicsColliders(root) {
    const physics = this.experience.physics
    if (!physics) return

    const build = () => {
      let count = 0
      root.traverse((child) => {
        if (child.isMesh && child.name !== 'Aircraft_TwinOtter') {
          const res = physics.createTrimeshCollider(child)
          if (res) count++
        }
      })
      console.log(`✅ Rapier trimesh mesh colliders created for ${count} island objects (no square colliders)`)
    }

    if (physics.ready) {
      build()
    } else {
      const timer = setInterval(() => {
        if (physics.ready) {
          clearInterval(timer)
          build()
        }
      }, 50)
    }
  }
}

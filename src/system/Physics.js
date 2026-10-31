import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'

export default class Physics {
  constructor() {
    this.ready = false
    this.world = null
    this.RAPIER = RAPIER

    this._init()
  }

  async _init() {
    try {
      await RAPIER.init()
      const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0)
      this.world = new RAPIER.World(gravity)
      this.ready = true
      console.log('✅ Rapier physics initialized successfully')
    } catch (err) {
      console.error('❌ Failed to initialize Rapier physics:', err)
    }
  }

  createCharacterBody(x, y, z) {
    if (!this.ready || !this.world) return null

    // Dynamic rigid body for the skydiving character
    const rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(0.8) // Air resistance damping
      .setAngularDamping(2.0)
      .lockRotations() // Lock rotations so animation & controls handle orientation

    const rigidBody = this.world.createRigidBody(rigidBodyDesc)

    // CYLINDER collider for character: half-height 0.9m, radius 0.45m (cylinder along Y axis)
    const colliderDesc = this.RAPIER.ColliderDesc.cylinder(0.9, 0.45)
      .setRestitution(0.0) // No bouncing on impact
      .setFriction(0.8)

    const collider = this.world.createCollider(colliderDesc, rigidBody)

    return { rigidBody, collider }
  }

  createTrimeshCollider(mesh) {
    if (!this.ready || !this.world || !mesh || !mesh.geometry) return null

    const geom = mesh.geometry
    const posAttr = geom.attributes.position
    if (!posAttr) return null

    mesh.updateWorldMatrix(true, false)
    const worldMatrix = mesh.matrixWorld

    // Transform positions into world space
    const count = posAttr.count
    const vertices = new Float32Array(count * 3)
    const v = new THREE.Vector3()

    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(posAttr, i)
      v.applyMatrix4(worldMatrix)
      vertices[i * 3] = v.x
      vertices[i * 3 + 1] = v.y
      vertices[i * 3 + 2] = v.z
    }

    let indices
    if (geom.index) {
      const idxArr = geom.index.array
      indices = (idxArr instanceof Uint32Array) ? idxArr : new Uint32Array(idxArr)
    } else {
      indices = new Uint32Array(count)
      for (let i = 0; i < count; i++) {
        indices[i] = i
      }
    }

    try {
      const rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed()
      const rigidBody = this.world.createRigidBody(rigidBodyDesc)
      const colliderDesc = this.RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setFriction(0.8)
        .setRestitution(0.0)
      const collider = this.world.createCollider(colliderDesc, rigidBody)
      return { rigidBody, collider }
    } catch (err) {
      console.warn('⚠️ Could not create trimesh collider for', mesh.name, err)
      return null
    }
  }

  update(delta) {
    if (!this.ready || !this.world) return

    // Cap delta to prevent tunneling during lag spikes
    this.world.timestep = Math.min(delta, 0.05)
    this.world.step()
  }
}


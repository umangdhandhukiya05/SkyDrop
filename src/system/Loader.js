import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export default class Loader {
  constructor() {
    this.gltfLoader = new GLTFLoader()
    this.textureLoader = new THREE.TextureLoader()
  }

  /**
   * Load a GLTF/GLB model
   * @param {string} path - URL path to the .glb file
   * @returns {Promise<GLTF>}
   */
  loadGLTF(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error)
      )
    })
  }

  /**
   * Load a texture
   * @param {string} path - URL path to the texture file
   * @returns {Promise<THREE.Texture>}
   */
  loadTexture(path) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => resolve(texture),
        undefined,
        (error) => reject(error)
      )
    })
  }
}

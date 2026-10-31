export default class Controls {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    }

    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp = this._onKeyUp.bind(this)

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true
        break
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true
        break
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true
        break
      case 'Space':
        this.keys.space = true
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.shift = true
        break
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false
        break
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false
        break
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false
        break
      case 'Space':
        this.keys.space = false
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.shift = false
        break
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
  }
}


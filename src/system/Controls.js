export default class Controls {
  constructor(canvas) {
    this.canvas = canvas || document.body
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
      freeLook: false // PUBG style: Alt key or Right-Click
    }

    this.mouse = {
      isDown: false,
      deltaX: 0,
      deltaY: 0,
      isPointerLocked: false
    }

    this.isFlightActive = false

    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp = this._onKeyUp.bind(this)
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onContextMenu = this._onContextMenu.bind(this)
    this._onPointerLockChange = this._onPointerLockChange.bind(this)
    this._onBlur = this._onBlur.bind(this)

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('mousedown', this._onMouseDown)
    window.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('mousemove', this._onMouseMove)
    window.addEventListener('contextmenu', this._onContextMenu)
    window.addEventListener('blur', this._onBlur)
    document.addEventListener('pointerlockchange', this._onPointerLockChange)
  }

  setFlightActive(active) {
    this.isFlightActive = active
    if (!active) {
      this.exitPointerLock()
    }
  }

  exitPointerLock() {
    this.mouse.isPointerLocked = false
    this.mouse.isDown = false
    if (document.exitPointerLock) {
      try {
        document.exitPointerLock()
      } catch (err) {}
    }
  }

  _onKeyDown(e) {
    const code = e.code || ''
    const key = (e.key || '').toLowerCase()

    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
      this.keys.forward = true
    } else if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
      this.keys.backward = true
    } else if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
      this.keys.left = true
    } else if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
      this.keys.right = true
    } else if (code === 'Space' || key === ' ' || key === 'spacebar') {
      this.keys.space = true
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
      this.keys.shift = true
    } else if (code === 'AltLeft' || code === 'AltRight' || key === 'alt') {
      e.preventDefault()
      this.keys.freeLook = true
    }
  }

  _onKeyUp(e) {
    const code = e.code || ''
    const key = (e.key || '').toLowerCase()

    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
      this.keys.forward = false
    } else if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
      this.keys.backward = false
    } else if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
      this.keys.left = false
    } else if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
      this.keys.right = false
    } else if (code === 'Space' || key === ' ' || key === 'spacebar') {
      this.keys.space = false
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
      this.keys.shift = false
    } else if (code === 'AltLeft' || code === 'AltRight' || key === 'alt') {
      this.keys.freeLook = false
    }
  }

  _onBlur() {
    this.keys.forward = false
    this.keys.backward = false
    this.keys.left = false
    this.keys.right = false
    this.keys.space = false
    this.keys.shift = false
    this.keys.freeLook = false
    this.mouse.isDown = false
  }

  _onMouseDown(e) {
    if (e.button === 0) {
      // Left click
      this.mouse.isDown = true

      // During active flight, clicking canvas can request pointer lock for full immersive PUBG aim
      if (this.isFlightActive && !this.mouse.isPointerLocked && e.target === this.canvas) {
        try {
          this.canvas.requestPointerLock()
        } catch (err) {}
      }
    } else if (e.button === 2) {
      // Right click -> PUBG Free-Look
      this.keys.freeLook = true
    }
  }

  _onMouseUp(e) {
    if (e.button === 0) {
      this.mouse.isDown = false
    } else if (e.button === 2) {
      this.keys.freeLook = false
    }
  }

  _onMouseMove(e) {
    // Steer if pointer is locked or if mouse button is held down
    if (this.mouse.isPointerLocked || this.mouse.isDown) {
      this.mouse.deltaX += e.movementX || 0
      this.mouse.deltaY += e.movementY || 0
    }
  }

  _onContextMenu(e) {
    // Prevent right-click context menu so RMB Free-Look works smoothly without interrupting gameplay
    e.preventDefault()
  }

  _onPointerLockChange() {
    this.mouse.isPointerLocked = (document.pointerLockElement === this.canvas)
  }

  getMouseDelta() {
    return { x: this.mouse.deltaX, y: this.mouse.deltaY }
  }

  resetMouseDelta() {
    this.mouse.deltaX = 0
    this.mouse.deltaY = 0
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('mousedown', this._onMouseDown)
    window.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('mousemove', this._onMouseMove)
    window.removeEventListener('contextmenu', this._onContextMenu)
    window.removeEventListener('blur', this._onBlur)
    document.removeEventListener('pointerlockchange', this._onPointerLockChange)
  }
}

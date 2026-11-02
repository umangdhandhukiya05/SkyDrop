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

    // Trackpad two-finger swipe / mouse wheel → free look (same as holding Alt)
    this.wheel = { deltaX: 0, deltaY: 0 }

    this.isFlightActive = false

    // One-shot actions pressed this frame (cleared every frame): 'chute', 'recenter', 'toggleControls'
    this.pressed = new Set()

    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp = this._onKeyUp.bind(this)
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onContextMenu = this._onContextMenu.bind(this)
    this._onPointerLockChange = this._onPointerLockChange.bind(this)
    this._onBlur = this._onBlur.bind(this)
    this._onWheel = this._onWheel.bind(this)

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('mousedown', this._onMouseDown)
    window.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('mousemove', this._onMouseMove)
    window.addEventListener('contextmenu', this._onContextMenu)
    window.addEventListener('blur', this._onBlur)
    window.addEventListener('wheel', this._onWheel, { passive: false })
    document.addEventListener('pointerlockchange', this._onPointerLockChange)
  }

  setFlightActive(active) {
    this.isFlightActive = active
    if (!active) {
      this.exitPointerLock()
    }
  }

  // Must run within a user gesture's activation window (jump keypress / click)
  requestPointerLock() {
    if (this.mouse.isPointerLocked || !this.canvas.requestPointerLock) return
    try {
      const result = this.canvas.requestPointerLock()
      if (result && result.catch) result.catch(() => {})
    } catch (err) {}
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

    if (!e.repeat) {
      if (code === 'KeyC' || key === 'c') this.pressed.add('recenter')
      if (code === 'KeyH' || key === 'h') this.pressed.add('toggleControls')
      if (code === 'KeyF' || code === 'KeyE' || key === 'f' || key === 'e') this.pressed.add('chute')
    }
    if (code === 'Space') e.preventDefault()

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
      if (this.isFlightActive && e.target === this.canvas) {
        this.requestPointerLock()
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
    // During flight, plain mouse / trackpad movement steers (no button needed);
    // pointer lock just keeps the cursor from hitting the screen edge
    if (this.isFlightActive || this.mouse.isPointerLocked || this.mouse.isDown) {
      this.mouse.deltaX += e.movementX || 0
      this.mouse.deltaY += e.movementY || 0
    }
  }

  _onWheel(e) {
    if (!this.isFlightActive) return
    e.preventDefault()

    // Normalise line / page scrolling (mouse wheels) to pixels
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
    // Pinch / ctrl+scroll is swallowed (no zoom, and no browser page zoom mid-flight)
    if (e.ctrlKey) return
    this.wheel.deltaX += e.deltaX * unit
    this.wheel.deltaY += e.deltaY * unit
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

  getWheelDelta() {
    return this.wheel
  }

  wasPressed(action) {
    return this.pressed.has(action)
  }

  resetMouseDelta() {
    this.mouse.deltaX = 0
    this.mouse.deltaY = 0
    this.wheel.deltaX = 0
    this.wheel.deltaY = 0
    this.pressed.clear()
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('mousedown', this._onMouseDown)
    window.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('mousemove', this._onMouseMove)
    window.removeEventListener('contextmenu', this._onContextMenu)
    window.removeEventListener('blur', this._onBlur)
    window.removeEventListener('wheel', this._onWheel)
    document.removeEventListener('pointerlockchange', this._onPointerLockChange)
  }
}

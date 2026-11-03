// Celebration Manager: Handles celebratory ribbon banner and falling 3D ribbon streamers/confetti
export default class Celebration {
  constructor(experience) {
    this.experience = experience

    this.overlay = document.getElementById('score-overlay')
    this.ribbonEl = document.getElementById('celebration-ribbon')
    this.ribbonTextEl = document.getElementById('ribbon-text')
    this.canvas = document.getElementById('celebration-canvas')
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null

    this.isActive = false
    this.particles = []
    this.streamers = []
    this.animId = null

    this.colors = [
      '#ffde17', // Gold
      '#ff2a5f', // Crimson
      '#00e5ff', // Cyan
      '#10b981', // Emerald
      '#a855f7', // Purple
      '#ff8c00', // Orange
      '#ffffff', // Sparkle White
      '#ff69b4'  // Pink
    ]

    this._onResize = this._onResize.bind(this)
    window.addEventListener('resize', this._onResize)
  }

  _onResize() {
    if (!this.canvas) return
    this.width = this.canvas.width = window.innerWidth
    this.height = this.canvas.height = window.innerHeight
  }

  show(text = 'CELEBRATION') {
    this.isActive = true

    // Show top celebration ribbon banner
    if (this.ribbonTextEl) {
      this.ribbonTextEl.innerText = text
    }
    if (this.ribbonEl) {
      this.ribbonEl.classList.remove('hidden')
      this.ribbonEl.classList.add('visible')
    }

    // Initialize & start canvas falling ribbon streamers & confetti
    if (!this.canvas) {
      this.canvas = document.getElementById('celebration-canvas')
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null
    }

    if (!this.canvas || !this.ctx) return

    this._onResize()
    this._initRibbons()

    if (this.animId) cancelAnimationFrame(this.animId)
    this._animate()
  }

  hide() {
    this.isActive = false

    // Hide top celebration ribbon banner
    if (this.ribbonEl) {
      this.ribbonEl.classList.remove('visible')
      this.ribbonEl.classList.add('hidden')
    }

    // Stop and clear falling celebration ribbons
    if (this.animId) {
      cancelAnimationFrame(this.animId)
      this.animId = null
    }

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    this.particles = []
    this.streamers = []
  }

  _initRibbons() {
    this.particles = []
    this.streamers = []

    const W = this.width || window.innerWidth
    const H = this.height || window.innerHeight

    // 1. Long swirling celebration ribbon streamers (30 curling strands)
    const streamerCount = 32
    for (let i = 0; i < streamerCount; i++) {
      this.streamers.push({
        x: Math.random() * W,
        y: Math.random() * -H * 0.5 - 20,
        speedY: 2.2 + Math.random() * 2.8,
        speedX: (Math.random() - 0.5) * 1.5,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        length: 12 + Math.floor(Math.random() * 10), // segments
        segmentDist: 9 + Math.random() * 5,
        width: 5 + Math.random() * 4,
        curlFreq: 0.04 + Math.random() * 0.04,
        curlAmp: 16 + Math.random() * 22,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.04 + Math.random() * 0.04
      })
    }

    // 2. Fluttering celebratory confetti strips & star ribbons (70 pieces)
    const particleCount = 75
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * W,
        y: Math.random() * -H - 10,
        w: 9 + Math.random() * 10,
        h: 16 + Math.random() * 16,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        speedY: 2.5 + Math.random() * 3.5,
        speedX: (Math.random() - 0.5) * 2.2,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedX: 0.04 + Math.random() * 0.06,
        rotSpeedY: 0.05 + Math.random() * 0.07,
        rotSpeedZ: 0.02 + Math.random() * 0.04,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.03 + Math.random() * 0.03
      })
    }
  }

  _animate() {
    if (!this.isActive || !this.ctx) return

    const W = this.width
    const H = this.height

    this.ctx.clearRect(0, 0, W, H)

    // Render & update falling swirling ribbon streamers
    for (let i = 0; i < this.streamers.length; i++) {
      const s = this.streamers[i]
      s.phase += s.phaseSpeed
      s.y += s.speedY
      s.x += s.speedX + Math.sin(s.phase) * 0.8

      // Draw curling ribbon streamer
      this.ctx.save()
      this.ctx.beginPath()
      this.ctx.lineWidth = s.width
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'
      this.ctx.strokeStyle = s.color

      let prevX = s.x
      let prevY = s.y
      this.ctx.moveTo(prevX, prevY)

      for (let j = 1; j <= s.length; j++) {
        const segY = s.y - j * s.segmentDist
        const curlOffset = Math.sin(s.phase + j * s.curlFreq * 6) * s.curlAmp
        const segX = s.x + curlOffset
        this.ctx.lineTo(segX, segY)
      }

      this.ctx.stroke()
      this.ctx.restore()

      // Reset when fallen below screen
      if (s.y - s.length * s.segmentDist > H + 50) {
        s.y = -50
        s.x = Math.random() * W
      }
    }

    // Render & update tumbling celebratory confetti ribbons
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      p.y += p.speedY
      p.x += p.speedX + Math.sin(p.swayPhase) * 1.2
      p.swayPhase += p.swaySpeed

      p.rotX += p.rotSpeedX
      p.rotY += p.rotSpeedY
      p.rotZ += p.rotSpeedZ

      const scaleX = Math.cos(p.rotX)
      const scaleY = Math.sin(p.rotY)

      this.ctx.save()
      this.ctx.translate(p.x, p.y)
      this.ctx.rotate(p.rotZ)
      this.ctx.scale(scaleX, scaleY)

      this.ctx.fillStyle = p.color
      this.ctx.shadowColor = p.color
      this.ctx.shadowBlur = 4
      this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      this.ctx.restore()

      // Reset when off screen bottom
      if (p.y > H + 30) {
        p.y = -20
        p.x = Math.random() * W
      }
    }

    this.animId = requestAnimationFrame(() => this._animate())
  }
}


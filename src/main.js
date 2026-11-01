import './style.css'
import Experience from './Experience.js'

// Canvas element from HTML
const canvas = document.querySelector('#app canvas')
const experience = new Experience(canvas)

// Start button handler
const startBtn = document.getElementById('start-button')
const uiOverlay = document.getElementById('ui-overlay')
const restartBtn = document.getElementById('restart-button')
const audioToggleBtn = document.getElementById('audio-toggle-btn')

if (audioToggleBtn) {
  audioToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (experience.audio) {
      experience.audio.toggleMute()
    }
  })
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
    if (experience.audio) {
      experience.audio.toggleMute()
    }
  }
})

if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (uiOverlay) {
      uiOverlay.classList.remove('visible')
      uiOverlay.style.opacity = '0'
      uiOverlay.style.pointerEvents = 'none'
    }

    // Launch automated takeoff along long runway and island skydive
    if (experience.audio) {
      experience.audio.ensureContext()
    }
    experience.world.startGameplay()
  })
}

if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    window.location.reload()
  })
}

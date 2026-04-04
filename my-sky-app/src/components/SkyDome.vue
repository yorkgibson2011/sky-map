<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSkyStore, type RenderableBody } from '../stores/skyStore'
import { NumberUtils } from '../utils/NumberUtils'

const skyStore = useSkyStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const imagesLoaded = ref(false)
const imageCache: Record<string, HTMLImageElement> = {}

// --- NEW TOOLTIP STATE ---
const hoveredBody = ref<RenderableBody | null>(null)
const mouseX = ref(0)
const mouseY = ref(0)

const BG_SIZE = 720
const NORTH = -1
const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 920

async function preloadImages() {
  const assetNames = [
    'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 
    'uranus', 'neptune', 'sun', 'moon_phases_38', 'star10'
  ]

  const loadPromises = assetNames.map((name) => {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.src = new URL(`../assets/${name}.png`, import.meta.url).href
      img.onload = () => {
        imageCache[name] = img
        resolve()
      }
      img.onerror = () => {
        console.warn(`Failed to load asset: ${name}.png`)
        resolve() 
      }
    })
  })

  await Promise.all(loadPromises)
  imagesLoaded.value = true
  drawSky()
}

function getCoordinates(azimuth: number, altitude: number) {
  const radius = ((90 - altitude) / 180) * BG_SIZE
  const top = NumberUtils.cosD(azimuth) * radius * NORTH
  const left = NumberUtils.sinD(azimuth) * radius * NORTH

  return {
    x: (CANVAS_WIDTH / 2) + left,
    y: (CANVAS_HEIGHT / 2) + top
  }
}

// --- NEW: CANVAS HIT TESTING ---
function handleMouseMove(event: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  // Get the mouse position relative to the canvas
  const rect = canvas.getBoundingClientRect()
  
  // Scale the mouse coordinates to match the internal canvas resolution
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  
  const x = (event.clientX - rect.left) * scaleX
  const y = (event.clientY - rect.top) * scaleY

  // Save screen coordinates for the floating tooltip DIV
  mouseX.value = event.clientX
  mouseY.value = event.clientY

  let foundBody: RenderableBody | null = null

  // Loop backward so we check things drawn "on top" first
  for (let i = skyStore.activeBodies.length - 1; i >= 0; i--) {
    const body = skyStore.activeBodies[i]
    if (body.azimuth === undefined || body.altitude === undefined) continue

    const bodyCoords = getCoordinates(body.azimuth, body.altitude)
    
    // Pythagorean theorem to find distance between mouse and celestial body
    const dx = x - bodyCoords.x
    const dy = y - bodyCoords.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Set a hit radius (larger for planets/sun, smaller for faint stars)
    const hitRadius = body.isStar && body.id !== 'sun' ? 6 : 15

    if (distance <= hitRadius) {
      foundBody = body
      break // Stop searching once we hit something
    }
  }

  // Only update reactivity if the hovered body actually changed to prevent jitter
  if (hoveredBody.value?.id !== foundBody?.id) {
    hoveredBody.value = foundBody
    
    // Change cursor to a pointer if we are hovering over something
    canvas.style.cursor = foundBody ? 'pointer' : 'default'
  }
}

function handleMouseLeave() {
  hoveredBody.value = null
}

function drawSky() {
  const canvas = canvasRef.value
  if (!canvas || !imagesLoaded.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.beginPath()
  ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, BG_SIZE / 2, 0, Math.PI * 2)
  ctx.strokeStyle = '#333333'
  ctx.stroke()

  skyStore.activeBodies.forEach(body => {
    if (body.azimuth === undefined || body.altitude === undefined) return
    const { x, y } = getCoordinates(body.azimuth, body.altitude)

    if (body.imageId === 'moon_phases_38') {
      const moonImg = imageCache['moon_phases_38']
      if (moonImg) {
        const frameCount = 30 
        const frameWidth = moonImg.width / frameCount
        const frameHeight = moonImg.height
        const phase = Math.max(0, Math.min(frameCount - 1, body.moonPhase || 0))
        const sourceX = phase * frameWidth
        ctx.drawImage(
          moonImg, 
          sourceX, 0, frameWidth, frameHeight, 
          x - (frameWidth / 2), y - (frameHeight / 2), frameWidth, frameHeight 
        )
      }
    } else if (body.imageId === 'star10') {
      const starImg = imageCache['star10']
      if (starImg) {
        const baseWidth = starImg.width > 0 ? starImg.width : 10
        let w = baseWidth
        if (body.visualMagnitude !== undefined && body.visualMagnitude > 0) {
           w = baseWidth * Math.pow(0.7, body.visualMagnitude)
        }
        ctx.drawImage(starImg, x - (w / 2), y - (w / 2), w, w)
      }
    } else {
      const img = imageCache[body.imageId]
      if (img) {
        ctx.drawImage(img, x - (img.width / 2), y - (img.height / 2))
      }
    }
    
    // The text rendering block has been completely removed!
  })
}

onMounted(() => {
  preloadImages()
})

watch(() => skyStore.activeBodies, () => {
  drawSky()
}, { deep: true })
</script>

<template>
  <div class="sky-container">
    <canvas 
      ref="canvasRef" 
      :width="CANVAS_WIDTH" 
      :height="CANVAS_HEIGHT"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    ></canvas>

    <div 
      v-if="hoveredBody" 
      class="hover-tooltip"
      :style="{ left: mouseX + 15 + 'px', top: mouseY + 15 + 'px' }"
    >
      <h3>{{ hoveredBody.label }}</h3>
      <div class="tooltip-data">
        <p><strong>RA:</strong> {{ hoveredBody.RightAscension }}</p>
        <p><strong>Dec:</strong> {{ hoveredBody.Declination }}</p>
        <p v-if="hoveredBody.visualMagnitude !== undefined">
          <strong>Vis. Mag:</strong> {{ hoveredBody.visualMagnitude }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sky-container {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative; /* Important for the tooltip to overlay correctly */
}
canvas {
  background-color: #111;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

/* Tooltip Styles */
.hover-tooltip {
  position: fixed; /* Fix to the viewport so it tracks the mouse precisely */
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 12px 16px;
  color: #fff;
  pointer-events: none; /* Prevents the tooltip from blocking mouse events */
  z-index: 100;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  font-family: sans-serif;
  min-width: 180px;
}

.hover-tooltip h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #3a86ff;
  text-transform: capitalize;
}

.tooltip-data p {
  margin: 4px 0;
  font-size: 0.85rem;
  color: #ccc;
}

.tooltip-data strong {
  color: #fff;
}
</style>
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSkyStore, type RenderableBody } from '../stores/skyStore'
import { NumberUtils } from '../utils/NumberUtils'

const skyStore = useSkyStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const imagesLoaded = ref(false)
const imageCache: Record<string, HTMLImageElement> = {}

// Hover Interaction State
const hoveredBody = ref<RenderableBody | null>(null)
const mouseX = ref(0)
const mouseY = ref(0)

const BG_SIZE = 720
const NORTH = -1
const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 920

// 1. Preload ALL of your original stylistic PNGs
async function preloadImages() {
  const assetNames = [
    'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 
    'uranus', 'neptune', 'sun', 'moon_phases_38'
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

// Canvas Hit-Testing for Tooltips
function handleMouseMove(event: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  
  const x = (event.clientX - rect.left) * scaleX
  const y = (event.clientY - rect.top) * scaleY

  mouseX.value = event.clientX
  mouseY.value = event.clientY

  let foundBody: RenderableBody | null = null

  // Loop backward to hit front-most items first
  for (let i = skyStore.activeBodies.length - 1; i >= 0; i--) {
    const body = skyStore.activeBodies[i]
    
    if (body.altitude === undefined || !body.isInteractive) continue

    const bodyCoords = getCoordinates(body.azimuth!, body.altitude)
    const dx = x - bodyCoords.x
    const dy = y - bodyCoords.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    const hitRadius = body.isStar && body.id !== 'sun' ? 6 : 20

    if (distance <= hitRadius) {
      foundBody = body
      break 
    }
  }

  if (hoveredBody.value?.id !== foundBody?.id) {
    hoveredBody.value = foundBody
    canvas.style.cursor = foundBody ? 'pointer' : 'default'
  }
}

function handleMouseLeave() {
  hoveredBody.value = null
}

// Main Render Loop
function drawSky() {
  const canvas = canvasRef.value
  if (!canvas || !imagesLoaded.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw background ring
  ctx.beginPath()
  ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, BG_SIZE / 2, 0, Math.PI * 2)
  ctx.strokeStyle = '#333333'
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, BG_SIZE / 4, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(58, 134, 255, 0.3)' // Subtle blue glow
  ctx.setLineDash([5, 5]) // Make it a dashed line
  ctx.stroke()
  ctx.setLineDash([]) // Reset dashes for other lines

  skyStore.activeBodies.forEach(body => {
    if (body.azimuth === undefined || body.altitude === undefined) return
    
    const { x, y } = getCoordinates(body.azimuth, body.altitude)

    if (body.imageId === 'moon_phases_38') {
      
      // --- THE MOON ---
      const moonImg = imageCache['moon_phases_38']
      if (moonImg) {
        const frameCount = 30 
        const frameWidth = moonImg.width / frameCount
        const frameHeight = moonImg.height
        
        // Ensure phase is a clean integer to prevent slicing artifacts
        const phase = Math.floor(Math.max(0, Math.min(frameCount - 1, body.moonPhase || 0)))
        const sourceX = phase * frameWidth
        
        const targetSize = 40 // Larger, scaled moon
        ctx.drawImage(
          moonImg, 
          sourceX, 0, frameWidth, frameHeight, 
          x - (targetSize / 2), y - (targetSize / 2), targetSize, targetSize 
        )
      }

    } else if (body.isStar && body.id !== 'sun') {
      
      // --- THE STARS ---
      if (body.visualMagnitude !== undefined && body.visualMagnitude <= 2.5 && body.isInteractive) {
        
        // 1. Calculate the scale of the cross (max 24px)
        const w = Math.min(24, 10 * Math.pow(0.7, body.visualMagnitude))
        const half = w / 2

        // 2. Draw the native vector cross
        ctx.beginPath()
        
        // Horizontal line
        ctx.moveTo(x - half, y)
        ctx.lineTo(x + half, y)
        
        // Vertical line
        ctx.moveTo(x, y - half)
        ctx.lineTo(x, y + half)

        // 3. Style it exactly like your original PNG
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()

      } else {
        // Faint background stars (keep these as native dots)
        const mag = body.visualMagnitude || 0
        const opacity = Math.max(0.1, 1 - (mag / 6))
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        const size = mag > 4 ? 1 : 2
        ctx.fillRect(x, y, size, size)
      }

    } else {
      
      // --- THE PLANETS & SUN (Original PNGs) ---
      const img = imageCache[body.imageId]
      if (img) {
        // Math.round ensures we draw on whole pixels to prevent sub-pixel blur!
        const drawX = Math.round(x - (img.width / 2))
        const drawY = Math.round(y - (img.height / 2))

        // Draw at the exact 1:1 native width and height of your original files
        ctx.drawImage(img, drawX, drawY, img.width, img.height)
      }
    }
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
        <p v-if="hoveredBody.RightAscension"><strong>RA:</strong> {{ hoveredBody.RightAscension }}</p>
        <p v-if="hoveredBody.Declination"><strong>Dec:</strong> {{ hoveredBody.Declination }}</p>
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
  position: relative;
}
canvas {
  background-color: #111;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.hover-tooltip {
  position: fixed; 
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 12px 16px;
  color: #fff;
  pointer-events: none; 
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
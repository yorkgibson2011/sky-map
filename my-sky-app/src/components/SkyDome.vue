<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSkyStore, type RenderableBody } from '../stores/skyStore'
import { NumberUtils } from '../utils/NumberUtils'

const skyStore = useSkyStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const imagesLoaded = ref(false)
const imageCache: Record<string, HTMLImageElement> = {}

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
    'uranus', 'neptune', 'sun', 'moon_phases_38'
  ]

  const loadPromises = assetNames.map((name) => {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.src = new URL(`../assets/${name}.png`, import.meta.url).href
      img.onload = () => { imageCache[name] = img; resolve() }
      img.onerror = () => { console.warn(`Failed to load asset: ${name}.png`); resolve() }
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

function handleMouseMove(event: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left) * (canvas.width / rect.width)
  const y = (event.clientY - rect.top) * (canvas.height / rect.height)

  mouseX.value = event.clientX
  mouseY.value = event.clientY

  let foundBody: RenderableBody | null = null

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

function drawSky() {
  const canvas = canvasRef.value
  if (!canvas || !imagesLoaded.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const centerX = CANVAS_WIDTH / 2
  const centerY = CANVAS_HEIGHT / 2

  // 1. Draw Cardinal Crosshairs (N, E, S, W)
  ctx.beginPath()
  ctx.moveTo(centerX, centerY - (BG_SIZE / 2))
  ctx.lineTo(centerX, centerY + (BG_SIZE / 2))
  ctx.moveTo(centerX - (BG_SIZE / 2), centerY)
  ctx.lineTo(centerX + (BG_SIZE / 2), centerY)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  ctx.stroke()

  // 2. The Actual Horizon (Outer Ring: 0° Altitude)
  ctx.beginPath()
  ctx.arc(centerX, centerY, BG_SIZE / 2, 0, Math.PI * 2)
  ctx.strokeStyle = '#444444'
  ctx.lineWidth = 2
  ctx.stroke()

  // Add Horizon Labels
  ctx.fillStyle = '#666666'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('N', centerX, centerY - (BG_SIZE / 2) - 10)
  ctx.fillText('S', centerX, centerY + (BG_SIZE / 2) + 20)
  ctx.textAlign = 'left'
  ctx.fillText('HORIZON (0°)', centerX + (BG_SIZE / 2) + 10, centerY + 4)
  ctx.textAlign = 'right'
  ctx.fillText('E', centerX - (BG_SIZE / 2) - 10, centerY + 4)

  // 3. The 45° Altitude Ring (Inner Dashed Ring)
  ctx.beginPath()
  ctx.arc(centerX, centerY, BG_SIZE / 4, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(58, 134, 255, 0.3)' 
  ctx.setLineDash([4, 4]) 
  ctx.stroke()
  ctx.setLineDash([]) 

  // Add 45° Label
  ctx.fillStyle = 'rgba(58, 134, 255, 0.5)'
  ctx.textAlign = 'left'
  ctx.fillText('45° ALT', centerX + (BG_SIZE / 4) + 5, centerY - 5)

  // 4. Draw the celestial bodies
  skyStore.activeBodies.forEach(body => {
    if (body.azimuth === undefined || body.altitude === undefined) return
    const { x, y } = getCoordinates(body.azimuth, body.altitude)

    if (body.imageId === 'moon_phases_38') {
      const moonImg = imageCache['moon_phases_38']
      if (moonImg) {
        const frameWidth = moonImg.width / 30
        const phase = Math.floor(Math.max(0, Math.min(29, body.moonPhase || 0)))
        ctx.drawImage(moonImg, phase * frameWidth, 0, frameWidth, moonImg.height, x - 20, y - 20, 40, 40)
      }
    } else if (body.isStar && body.id !== 'sun') {
      if (body.visualMagnitude !== undefined && body.visualMagnitude <= 2.5 && body.isInteractive) {
        const w = Math.min(24, 10 * Math.pow(0.7, body.visualMagnitude))
        const half = w / 2
        ctx.beginPath()
        ctx.moveTo(x - half, y); ctx.lineTo(x + half, y)
        ctx.moveTo(x, y - half); ctx.lineTo(x, y + half)
        ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke()
      } else {
        const mag = body.visualMagnitude || 0
        const opacity = Math.max(0.1, 1 - (mag / 6))
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        const size = mag > 4 ? 1 : 2
        ctx.fillRect(x, y, size, size)
      }
    } else {
      const img = imageCache[body.imageId]
      if (img) ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2), img.width, img.height)
    }
  })
}

onMounted(() => preloadImages())

watch(() => skyStore.activeBodies, () => drawSky(), { deep: true })
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

    <div v-if="hoveredBody" class="hover-tooltip" :style="{ left: mouseX + 15 + 'px', top: mouseY + 15 + 'px' }">
      <h3>{{ hoveredBody.label }}</h3>
      <div class="tooltip-data">
        <p v-if="hoveredBody.RightAscension"><strong>RA:</strong> {{ hoveredBody.RightAscension }}</p>
        <p v-if="hoveredBody.Declination"><strong>Dec:</strong> {{ hoveredBody.Declination }}</p>
        <p v-if="hoveredBody.visualMagnitude !== undefined"><strong>Vis. Mag:</strong> {{ hoveredBody.visualMagnitude }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sky-container { display: flex; justify-content: center; align-items: center; position: relative; }
canvas { background-color: #111; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); cursor: default; }
.hover-tooltip { position: fixed; background: rgba(15, 15, 25, 0.95); border: 1px solid #444; border-radius: 6px; padding: 12px 16px; color: #fff; pointer-events: none; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-family: sans-serif; min-width: 180px; }
.hover-tooltip h3 { margin: 0 0 8px 0; font-size: 1rem; color: #3a86ff; text-transform: capitalize; }
.tooltip-data p { margin: 4px 0; font-size: 0.85rem; color: #ccc; }
.tooltip-data strong { color: #fff; }
</style>
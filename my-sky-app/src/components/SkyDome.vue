<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useSkyStore, type RenderableBody } from '../stores/skyStore'
import { NumberUtils } from '../utils/NumberUtils'

const skyStore = useSkyStore()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const imagesLoaded = ref(false)
const imageCache: Record<string, HTMLImageElement> = {}

const hoveredBody = ref<RenderableBody | null>(null)
const mouseX = ref(0)
const mouseY = ref(0)

const CANVAS_WIDTH = ref(1000)
const CANVAS_HEIGHT = ref(920)
const BG_SIZE = ref(720)
const NORTH = -1

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
      img.onerror = () => { resolve() }
    })
  })
  await Promise.all(loadPromises)
  imagesLoaded.value = true
  drawSky()
}

function getCoordinates(azimuth: number, altitude: number) {
  const radius = ((90 - altitude) / 180) * BG_SIZE.value
  const top = NumberUtils.cosD(azimuth) * radius * NORTH
  const left = NumberUtils.sinD(azimuth) * radius * NORTH
  return { x: (CANVAS_WIDTH.value / 2) + left, y: (CANVAS_HEIGHT.value / 2) + top }
}

function handleMouseMove(event: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
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
      foundBody = body; break 
    }
  }

  if (hoveredBody.value?.id !== foundBody?.id) {
    hoveredBody.value = foundBody
    canvas.style.cursor = foundBody ? 'pointer' : 'default'
  }
}

function handleMouseLeave() { hoveredBody.value = null }

// THE FIX: Toggle targeting logic
function handleMouseClick() {
  if (hoveredBody.value) {
    if (skyStore.selectedTargetId === hoveredBody.value.id) {
      // If clicking the currently selected body, toggle it off!
      skyStore.selectedTargetId = null
    } else {
      // Otherwise lock onto the new body
      skyStore.selectedTargetId = hoveredBody.value.id
    }
  } else {
    // Clicking empty space clears the target
    skyStore.selectedTargetId = null
  }
}

function drawSky() {
  const canvas = canvasRef.value
  if (!canvas || !imagesLoaded.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  ctx.resetTransform()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(dpr, dpr)

  const centerX = CANVAS_WIDTH.value / 2
  const centerY = CANVAS_HEIGHT.value / 2
  const bgRadius = BG_SIZE.value / 2

  // 1. DAY/NIGHT BACKGROUND BLENDING
  ctx.beginPath()
  ctx.arc(centerX, centerY, bgRadius, 0, Math.PI * 2)
  ctx.fillStyle = '#0a0a0c'
  ctx.fill()

  const sunPos = skyStore.activeBodies.find(b => b.id === 'sun')
  let starVisibility = 1.0;

  if (skyStore.showAtmosphere && sunPos && sunPos.altitude !== undefined) {
    const alt = sunPos.altitude;
    const dayIntensity = Math.max(0, Math.min(1, alt / 15));
    const sunsetIntensity = Math.max(0, Math.min(1, 1 - Math.abs(alt) / 10));
    const twilightIntensity = Math.max(0, Math.min(1, 1 - Math.abs(alt + 8) / 10));

    if (twilightIntensity > 0) { ctx.fillStyle = `rgba(30, 40, 80, ${twilightIntensity})`; ctx.fill(); }
    if (sunsetIntensity > 0) { ctx.fillStyle = `rgba(220, 90, 40, ${sunsetIntensity * 0.6})`; ctx.fill(); }
    if (dayIntensity > 0) { ctx.fillStyle = `rgba(50, 140, 220, ${dayIntensity})`; ctx.fill(); }

    starVisibility = Math.max(0, Math.min(1, (alt + 2) / -10));
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 2; ctx.stroke()

  // 2. THE CROSSHAIRS
  ctx.beginPath()
  ctx.moveTo(centerX, centerY - bgRadius); ctx.lineTo(centerX, centerY + bgRadius)
  ctx.moveTo(centerX - bgRadius, centerY); ctx.lineTo(centerX + bgRadius, centerY)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.stroke()

  ctx.fillStyle = '#666666'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('N', centerX, centerY - bgRadius - 10)
  ctx.fillText('S', centerX, centerY + bgRadius + 20)
  ctx.textAlign = 'left'; ctx.fillText('HORIZON (0°)', centerX + bgRadius + 10, centerY + 4)
  ctx.textAlign = 'right'; ctx.fillText('E', centerX - bgRadius - 10, centerY + 4)

  // 3. 45° Altitude Ring
  ctx.beginPath(); ctx.arc(centerX, centerY, bgRadius / 2, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(58, 134, 255, 0.3)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]) 
  ctx.fillStyle = 'rgba(58, 134, 255, 0.5)'; ctx.textAlign = 'left'
  ctx.fillText('45° ALT', centerX + (bgRadius / 2) + 5, centerY - 5)

  // 4. Sun's Path (Solid Ring)
  if (skyStore.sunPath.length > 0) {
    ctx.beginPath()
    let isDrawingPath = false
    skyStore.sunPath.forEach((pos) => {
      if (pos === null) {
        isDrawingPath = false
      } else {
        const coords = getCoordinates(pos.azimuth, pos.altitude)
        if (!isDrawingPath) { 
          ctx.moveTo(coords.x, coords.y)
          isDrawingPath = true 
        } else { 
          ctx.lineTo(coords.x, coords.y) 
        }
      }
    })
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.15)'; 
    ctx.lineWidth = 2; 
    ctx.stroke(); 
  }

  // 5. Draw Celestial Bodies
  skyStore.activeBodies.forEach(body => {
    if (body.azimuth === undefined || body.altitude === undefined) return
    
    const isSunOrMoon = body.id === 'sun' || body.id === 'moon'
    if (!isSunOrMoon) {
      if (starVisibility === 0) return 
      ctx.globalAlpha = starVisibility 
    }

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
        // THE FIX: Adjusted the math so magnitude 7.0 stars still have 20-30% opacity!
        const opacity = Math.max(0.2, 1.2 - (mag / 6.5))
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        
        // Slightly tweak the size threshold so it doesn't look too chunky
        const size = mag > 4.5 ? 1 : 2 
        ctx.fillRect(x, y, size, size)
      }
    } else {
      const img = imageCache[body.imageId]
      if (img) ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2), img.width, img.height)
    }

    ctx.globalAlpha = 1.0
  })

  // 6. Draw Targeting Reticle
  if (skyStore.selectedBody && skyStore.selectedBody.azimuth !== undefined && skyStore.selectedBody.altitude !== undefined) {
    const { x, y } = getCoordinates(skyStore.selectedBody.azimuth, skyStore.selectedBody.altitude)
    ctx.beginPath()
    
    const r = 26 
    const b = 8  
    
    ctx.strokeStyle = '#ff3a5e' 
    ctx.lineWidth = 2

    ctx.moveTo(x - r, y - r + b); ctx.lineTo(x - r, y - r); ctx.lineTo(x - r + b, y - r);
    ctx.moveTo(x + r - b, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y - r + b);
    ctx.moveTo(x + r, y + r - b); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - b, y + r);
    ctx.moveTo(x - r + b, y + r); ctx.lineTo(x - r, y + r); ctx.lineTo(x - r, y + r - b);

    ctx.stroke()
  }
}

onMounted(() => {
  preloadImages()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        CANVAS_WIDTH.value = width
        CANVAS_HEIGHT.value = height
        BG_SIZE.value = Math.min(width, height) - 80

        if (canvasRef.value) {
          const dpr = window.devicePixelRatio || 1
          canvasRef.value.width = width * dpr
          canvasRef.value.height = height * dpr
        }
        drawSky()
      }
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

watch(() => skyStore.activeBodies, () => drawSky(), { deep: true })
watch(() => skyStore.showAtmosphere, () => drawSky())
</script>

<template>
  <div class="sky-container" ref="containerRef">
    <canvas 
      ref="canvasRef" 
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @click="handleMouseClick"
    ></canvas>

    <div v-if="hoveredBody && !skyStore.isPlaying" class="hover-tooltip" :style="{ left: mouseX + 15 + 'px', top: mouseY + 15 + 'px' }">
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
.sky-container { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; overflow: hidden; background-color: #050505; }
canvas { display: block; width: 100%; height: 100%; background-color: transparent; cursor: default; }
.hover-tooltip { position: fixed; background: rgba(15, 15, 25, 0.95); border: 1px solid #444; border-radius: 6px; padding: 12px 16px; color: #fff; pointer-events: none; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-family: sans-serif; min-width: 180px; }
.hover-tooltip h3 { margin: 0 0 8px 0; font-size: 1rem; color: #3a86ff; text-transform: capitalize; }
.tooltip-data p { margin: 4px 0; font-size: 0.85rem; color: #ccc; }
.tooltip-data strong { color: #fff; }
</style>
<script setup lang="ts">
import { ref } from 'vue'
import { useSkyStore } from '../stores/skyStore'
import { CITIES, type City } from '../utils/CityData'
import mapImage from '../assets/world-map.png'

const skyStore = useSkyStore()
const widgetState = ref<'normal' | 'minimized' | 'maximized'>('normal')

const hoveredCity = ref<City | null>(null)
const mouseX = ref(0)
const mouseY = ref(0)
const svgRef = ref<SVGSVGElement | null>(null)

function getMercatorXY(lat: number, lon: number) {
  const clampedLat = Math.max(-85, Math.min(85, lat))
  const x = (lon + 180) * (100 / 360)
  const latRad = (clampedLat * Math.PI) / 180
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  const y = 46 - (100 * mercN) / (2 * Math.PI)
  return { x, y }
}

function handleMapMouseMove(e: MouseEvent) {
  if (!svgRef.value) return
  mouseX.value = e.clientX
  mouseY.value = e.clientY

  const rect = svgRef.value.getBoundingClientRect()
  const clientX = e.clientX - rect.left
  const clientY = e.clientY - rect.top
  const svgX = (clientX / rect.width) * 100
  const svgY = (clientY / rect.height) * 95.88

  let nearestCity: City | null = null
  let minDistance = 3 

  for (const city of CITIES) {
    const pos = getMercatorXY(city.lat, city.lon)
    const dist = Math.sqrt(Math.pow(svgX - pos.x, 2) + Math.pow(svgY - pos.y, 2))
    if (dist < minDistance) {
      minDistance = dist
      nearestCity = city
    }
  }
  hoveredCity.value = nearestCity
}

function handleMapMouseLeave() { hoveredCity.value = null }

function handleMapClick() {
  if (hoveredCity.value) {
    skyStore.setLocation(hoveredCity.value.lat, hoveredCity.value.lon, hoveredCity.value.tz)
    if (widgetState.value === 'maximized') widgetState.value = 'normal'
  }
}
</script>

<template>
  <div class="map-widget" :class="widgetState">
    <div class="widget-header">
      <span class="title">Location Map</span>
      <div class="window-controls">
        <button @click="widgetState = 'minimized'" title="Minimize">−</button>
        <button @click="widgetState = 'normal'" title="Restore">□</button>
        <button @click="widgetState = 'maximized'" title="Maximize">⤢</button>
      </div>
    </div>

    <div class="widget-body" v-show="widgetState !== 'minimized'">
      <svg 
        ref="svgRef"
        class="mercator-map" 
        viewBox="0 0 100 95.88" 
        preserveAspectRatio="xMidYMid meet"
        @mousemove="handleMapMouseMove"
        @mouseleave="handleMapMouseLeave"
        @click="handleMapClick"
      >
        <image :href="mapImage" x="0" y="0" width="100" height="95.88" />

        <g v-for="city in CITIES" :key="city.name + '-' + city.country">
          <circle 
            class="city-dot" 
            :class="{ 'is-hovered': hoveredCity?.name === city.name && hoveredCity?.country === city.country }"
            :cx="getMercatorXY(city.lat, city.lon).x" 
            :cy="getMercatorXY(city.lat, city.lon).y" 
            r="0.4" 
          />
        </g>

        <g class="active-indicator" :style="{ transform: `translate(${getMercatorXY(skyStore.latitude, skyStore.longitude).x}px, ${getMercatorXY(skyStore.latitude, skyStore.longitude).y}px)` }">
          <circle cx="0" cy="0" r="0.8" class="pulse-ring" />
          <circle cx="0" cy="0" r="0.4" class="active-dot" />
        </g>
      </svg>
    </div>

    <Teleport to="body">
      <div v-if="hoveredCity && widgetState !== 'minimized'" class="map-tooltip" :style="{ left: mouseX + 15 + 'px', top: mouseY + 15 + 'px' }">
        <strong>{{ hoveredCity.name }}</strong>
        <span>{{ hoveredCity.country }}</span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.map-widget { position: relative; width: 100%; box-sizing: border-box; background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(5px); border: 1px solid #444; border-radius: 8px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 10; overflow: hidden; font-family: sans-serif; flex-shrink: 0; }
.map-widget.minimized { height: 42px; }
.map-widget.maximized { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80vw; max-width: 1000px; z-index: 9999; box-shadow: 0 0 0 100vmax rgba(0,0,0,0.8), 0 4px 25px rgba(0, 0, 0, 0.7); }
.widget-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: rgba(20, 20, 20, 0.9); border-bottom: 1px solid #444; user-select: none; }
.widget-header .title { color: #ccc; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
.window-controls button { background: transparent; border: none; color: #888; cursor: pointer; padding: 0 5px; font-size: 1.1rem; transition: color 0.2s; }
.window-controls button:hover { color: #fff; }
.widget-body { padding: 10px; width: 100%; box-sizing: border-box; }
.mercator-map { width: 100%; height: auto; display: block; cursor: crosshair; }
.city-dot { fill: #aaa; pointer-events: none; transition: fill 0.2s, r 0.2s; }
.city-dot.is-hovered { fill: #fff; r: 0.6; }
.active-indicator { will-change: transform; transition: transform 0.1s linear; }
.active-dot { fill: #3a86ff; }
.pulse-ring { fill: transparent; stroke: #3a86ff; stroke-width: 0.2; animation: pulse 2s infinite; }
@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
.map-tooltip { position: fixed; background: rgba(15, 15, 25, 0.95); border: 1px solid #444; border-radius: 4px; padding: 8px 12px; color: #fff; pointer-events: none; z-index: 99999; font-family: sans-serif; display: flex; flex-direction: column; gap: 4px; margin-top: 15px;}
.map-tooltip strong { color: #3a86ff; font-size: 0.95rem; }
.map-tooltip span { color: #aaa; font-size: 0.8rem; }
</style>
// src/stores/skyStore.ts
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { PlanetaryPositions, type PositionData } from '../utils/PlanetaryPositions'
import { STAR_DATA } from '../utils/StarData'

export interface RenderableBody extends PositionData {
  id: string;
  label: string;
  imageId: string;
  isStar: boolean;
  visualMagnitude?: number;
}

// Cubic Easing Function for smooth starts and stops
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export const useSkyStore = defineStore('sky', () => {
  const currentDate = ref<Date>(new Date())
  const latitude = ref<number>(51.467)
  const longitude = ref<number>(-2.583)
  const visMagThreshold = ref<number>(3.5)
  
  // PERFORMANCE UPGRADE: shallowRef prevents Vue from deep-proxying every 
  // coordinate 60 times a second, saving massive CPU overhead during tweens.
  const activeBodies = shallowRef<RenderableBody[]>([])

  // Store our animation frame ID so we can cancel overlapping animations
  let animationFrameId: number | null = null;

  // --- ACTIONS ---

  function setLocation(targetLat: number, targetLon: number, durationMs = 1500) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)

    const startLat = latitude.value
    const startLon = longitude.value
    const startTime = performance.now()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      let progress = elapsed / durationMs

      if (progress >= 1) {
        progress = 1
        latitude.value = targetLat
        longitude.value = targetLon
        PlanetaryPositions.latitude = targetLat
        PlanetaryPositions.longitude = targetLon
        recalculateSky()
        animationFrameId = null
        return
      }

      const easedProgress = easeInOutCubic(progress)
      
      // Calculate intermediate location
      const curLat = startLat + (targetLat - startLat) * easedProgress
      const curLon = startLon + (targetLon - startLon) * easedProgress

      PlanetaryPositions.latitude = curLat
      PlanetaryPositions.longitude = curLon
      
      // We don't update the ref values until the end so the UI doesn't flicker wildly
      recalculateSky() 
      animationFrameId = requestAnimationFrame(step)
    }

    animationFrameId = requestAnimationFrame(step)
  }

  function setDate(targetDate: Date, durationMs = 1500) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)

    const startTime = performance.now()
    const startMs = currentDate.value.getTime()
    const targetMs = targetDate.getTime()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      let progress = elapsed / durationMs

      if (progress >= 1) {
        progress = 1
        currentDate.value = targetDate
        recalculateSky()
        animationFrameId = null
        return
      }

      const easedProgress = easeInOutCubic(progress)
      
      // Fast-forward or rewind time!
      const currentMs = startMs + (targetMs - startMs) * easedProgress

      currentDate.value = new Date(currentMs)
      recalculateSky()

      animationFrameId = requestAnimationFrame(step)
    }

    animationFrameId = requestAnimationFrame(step)
  }

  function recalculateSky() {
    const bodies: RenderableBody[] = []
    
    // 1. Planets
    PlanetaryPositions.PLANET_NAMES.forEach((planetName) => {
      const calcFunction = (PlanetaryPositions as any)[planetName]
      if (typeof calcFunction === 'function') {
        const data: PositionData = calcFunction.call(PlanetaryPositions, currentDate.value)
        bodies.push({
          ...data,
          id: planetName,
          label: planetName.charAt(0).toUpperCase() + planetName.slice(1),
          imageId: planetName === 'moon' ? 'moon_phases_38' : planetName,
          isStar: false,
        })
      }
    })

    // 2. The Sun
    const sunData = PlanetaryPositions.sun(currentDate.value)
    bodies.push({
      ...sunData,
      id: 'sun',
      label: 'Sun',
      imageId: 'sun',
      isStar: true,
      visualMagnitude: -26.74
    })

    // 3. The Stars
    STAR_DATA.forEach(star => {
      if (star.VM <= visMagThreshold.value) {
        const aa = PlanetaryPositions.azimuthAltitude(star.RA, star.Dec, currentDate.value)
        bodies.push({
          ...aa,
          id: star.name,
          label: star.name,
          imageId: 'star10',
          isStar: true,
          visualMagnitude: star.VM
        })
      }
    })

    // Replaces the entire array to trigger the shallowRef reactivity
    activeBodies.value = bodies
  }

  recalculateSky()

  return {
    currentDate,
    latitude,
    longitude,
    visMagThreshold,
    activeBodies,
    setLocation,
    setDate,
    recalculateSky
  }
})
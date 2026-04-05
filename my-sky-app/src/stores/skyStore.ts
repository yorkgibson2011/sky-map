import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { PlanetaryPositions, type PositionData } from '../utils/PlanetaryPositions'
import { STAR_DATA } from '../utils/StarData'

export interface RenderableBody extends PositionData {
  id: string;
  label: string;
  imageId: string;
  isStar: boolean;
  isInteractive: boolean;
  visualMagnitude?: number;
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export const useSkyStore = defineStore('sky', () => {
  const currentDate = ref<Date>(new Date())
  const latitude = ref<number>(51.467)
  const longitude = ref<number>(-2.583)
  
  // NEW: The Store now tracks the timezone!
  const timezone = ref<string>('Europe/London')
  
  const visMagThreshold = ref<number>(5.5)
  const activeBodies = shallowRef<RenderableBody[]>([])

  let animationFrameId: number | null = null;
  const isLiveTime = ref(true)
  let interactionTimeout: number | null = null

  setInterval(() => {
    if (isLiveTime.value && !animationFrameId) {
      currentDate.value = new Date()
      recalculateSky()
    }
  }, 1000)

  // NEW: Added targetTz to the arguments
  function setLocation(targetLat: number, targetLon: number, targetTz: string = 'Europe/London', durationMs = 1500) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)

    // Immediately update the timezone so the UI reflects the change right away
    timezone.value = targetTz;

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
      const curLat = startLat + (targetLat - startLat) * easedProgress
      const curLon = startLon + (targetLon - startLon) * easedProgress

      PlanetaryPositions.latitude = curLat
      PlanetaryPositions.longitude = curLon
      recalculateSky() 
      animationFrameId = requestAnimationFrame(step)
    }

    animationFrameId = requestAnimationFrame(step)
  }

  function setDate(targetDate: Date, durationMs = 1500, isUserAction = true) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)

    if (isUserAction) {
      isLiveTime.value = false
      if (interactionTimeout) clearTimeout(interactionTimeout)
      interactionTimeout = window.setTimeout(() => {
        setDate(new Date(), 1500, false)
        setTimeout(() => { isLiveTime.value = true }, 1500)
      }, 60000)
    }

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
      const currentMs = startMs + (targetMs - startMs) * easedProgress
      currentDate.value = new Date(currentMs)
      recalculateSky()
      animationFrameId = requestAnimationFrame(step)
    }
    animationFrameId = requestAnimationFrame(step)
  }

  function recalculateSky() {
    const bodies: RenderableBody[] = []
    
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
          isInteractive: true,
          moonPhase: planetName === 'moon' ? PlanetaryPositions.getAbsoluteMoonPhase(currentDate.value) : data.moonPhase
        })
      }
    })

    const sunData = PlanetaryPositions.sun(currentDate.value)
    bodies.push({
      ...sunData,
      id: 'sun',
      label: 'Sun',
      imageId: 'sun',
      isStar: true,
      isInteractive: true,
      visualMagnitude: -26.74
    })

    STAR_DATA.forEach(star => {
      if (star.VM <= visMagThreshold.value) {
        const aa = PlanetaryPositions.azimuthAltitude(star.RA, star.Dec, currentDate.value)
        bodies.push({
          ...aa,
          id: star.name || `Star-${star.RA}`, 
          label: star.name || 'Unknown Star',
          imageId: 'star10',
          isStar: true,
          isInteractive: star.name.trim().length > 0, 
          visualMagnitude: star.VM
        })
      }
    })

    activeBodies.value = bodies
  }

  recalculateSky()

  return {
    currentDate,
    latitude,
    longitude,
    timezone,
    visMagThreshold,
    activeBodies,
    setLocation,
    setDate,
    recalculateSky
  }
})
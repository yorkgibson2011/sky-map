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
  const targetDate = ref<Date>(new Date()) 
  
  const latitude = ref<number>(51.467)
  const longitude = ref<number>(-2.583)
  const targetLatitude = ref<number>(51.467)
  const targetLongitude = ref<number>(-2.583)
  const timezone = ref<string>('Europe/London')
  const showAtmosphere = ref<boolean>(true)
  const visMagThreshold = ref<number>(5.5)
  
  const activeBodies = shallowRef<RenderableBody[]>([])
  // NEW: Store the sunset line coordinates in state
  // NEW: Allow null values to act as a "pen lift" break in the line
  const sunPath = shallowRef<({azimuth: number, altitude: number} | null)[]>([])

  let animationFrameId: number | null = null;
  const isLiveTime = ref(true)
  let interactionTimeout: number | null = null

  setInterval(() => {
    if (isLiveTime.value && !animationFrameId) {
      const now = new Date()
      currentDate.value = now
      targetDate.value = now 
      recalculateSky()
    }
  }, 1000)

  function setLocation(targetLat: number, targetLon: number, targetTz: string = 'Europe/London', durationMs = 1500) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)

    timezone.value = targetTz;
    targetLatitude.value = targetLat;
    targetLongitude.value = targetLon;

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

  function setDate(newTargetDate: Date, durationMs = 1500, isUserAction = true) {
    if (isNaN(newTargetDate.getTime())) return;

    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    targetDate.value = newTargetDate

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
    const targetMs = newTargetDate.getTime()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      let progress = elapsed / durationMs
      if (progress >= 1) {
        progress = 1
        currentDate.value = newTargetDate
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
    // 1. CALCULATE THE SUNSET LINE FIRST
    const path: ({azimuth: number, altitude: number} | null)[] = []
    let sunWasUp = false
    
    // Check 12 hours before and 12 hours after the current time
    // This ensures we capture the correct daylight arc for the timezone we are looking at!
    for (let hour = -12; hour <= 12; hour += 0.25) { 
      const testDate = new Date(currentDate.value.getTime() + hour * 60 * 60 * 1000)
      const tempSunPos = PlanetaryPositions.sun(testDate)
      
      if (tempSunPos.altitude !== undefined && tempSunPos.azimuth !== undefined) {
        if (tempSunPos.altitude >= 0) {
          path.push({ azimuth: tempSunPos.azimuth, altitude: tempSunPos.altitude })
          sunWasUp = true
        } else if (sunWasUp) {
          // The sun just went below the horizon! Push a null to break the line.
          path.push(null) 
          sunWasUp = false
        }
      }
    }
    sunPath.value = path

    // 2. THE SHIELD: Instantly wipe the math cache clean!
    // This stops the sunset line from corrupting the planets' geocentric coordinates.
    PlanetaryPositions.lastDate = new Date(0)
    PlanetaryPositions.lastSunDate = new Date(0)
    PlanetaryPositions.lastSun = null

    // 3. NOW CALCULATE THE PLANETS
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
    targetDate,
    latitude,
    longitude,
    targetLatitude,
    targetLongitude,
    timezone,
    showAtmosphere,
    visMagThreshold,
    activeBodies,
    sunPath, // Export the path to the component!
    setLocation,
    setDate,
    recalculateSky
  }
})
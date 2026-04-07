import { defineStore } from 'pinia'
import { ref, shallowRef, computed, watch } from 'vue'
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
  // ==========================================
  // CORE STATE
  // ==========================================
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
  const sunPath = shallowRef<({azimuth: number, altitude: number} | null)[]>([])

  // ==========================================
  // TARGET LOCKING SYSTEM
  // ==========================================
  const selectedTargetId = ref<string | null>(null)
  
  const selectedBody = computed(() => {
    if (!selectedTargetId.value) return null
    return activeBodies.value.find(b => b.id === selectedTargetId.value) || null
  })

  // ==========================================
  // INTERNAL TIMING & PLAYBACK STATE
  // ==========================================
  let animationFrameId: number | null = null;
  const isLiveTime = ref(true)
  let interactionTimeout: number | null = null

  const isPlaying = ref(false)
  const playbackRate = ref(3600)
  let lastPlaybackTime = 0
  let playbackFrameId: number | null = null

  // ==========================================
  // PLAYBACK ENGINE
  // ==========================================
  function togglePlay() {
    isPlaying.value = !isPlaying.value
    if (isPlaying.value) {
      isLiveTime.value = false
      if (interactionTimeout) clearTimeout(interactionTimeout)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      
      lastPlaybackTime = Date.now()
      playbackFrameId = requestAnimationFrame(playbackLoop)
    } else {
      if (playbackFrameId) {
        cancelAnimationFrame(playbackFrameId)
        playbackFrameId = null
      }
    }
  }

  function playbackLoop() {
    if (!isPlaying.value) return
    const now = Date.now()
    const deltaMs = now - lastPlaybackTime
    lastPlaybackTime = now

    // Cap the delta to 100ms so the universe doesn't explode if the user switches browser tabs
    const cappedDelta = Math.min(deltaMs, 100)
    const simDeltaMs = cappedDelta * playbackRate.value
    const nextMs = targetDate.value.getTime() + simDeltaMs

    const newDate = new Date(nextMs)
    targetDate.value = newDate
    currentDate.value = newDate 
    
    try {
      recalculateSky()
    } catch(e) {
      console.error("Playback math error:", e)
    }

    playbackFrameId = requestAnimationFrame(playbackLoop)
  }

  // ==========================================
  // LIVE CLOCK SYNC
  // ==========================================
  setInterval(() => {
    if (isLiveTime.value && !animationFrameId && !isPlaying.value) {
      const now = new Date()
      currentDate.value = now
      targetDate.value = now 
      recalculateSky()
    }
  }, 1000)

  // ==========================================
  // LOCATION & TIME SETTERS (With Tweening)
  // ==========================================
  function setLocation(targetLat: number, targetLon: number, targetTz: string = 'Europe/London', durationMs = 1500) {
    if (isPlaying.value) togglePlay()
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
    if (isPlaying.value) togglePlay();

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

  // ==========================================
  // ASTRONOMY MATH ENGINE
  // ==========================================
  function recalculateSky() {
    // 1. CALCULATE SUN'S 24-HOUR PATH (Full ring)
    const startOfDay = new Date(currentDate.value)
    startOfDay.setHours(0, 0, 0, 0)
    
    const path: ({azimuth: number, altitude: number} | null)[] = []
    
    for (let hour = -12; hour <= 12; hour += 0.25) { 
      const testDate = new Date(currentDate.value.getTime() + hour * 60 * 60 * 1000)
      const tempSunPos = PlanetaryPositions.sun(testDate)
      
      if (tempSunPos.altitude !== undefined && tempSunPos.azimuth !== undefined) {
        path.push({ azimuth: tempSunPos.azimuth, altitude: tempSunPos.altitude })
      }
    }
    sunPath.value = path

    // Shield: Wipe the math cache so the path loop doesn't corrupt the planets
    PlanetaryPositions.lastDate = new Date(0)
    PlanetaryPositions.lastSunDate = new Date(0)
    PlanetaryPositions.lastSun = null

    const bodies: RenderableBody[] = []
    
    // ==========================================
    // 2. RENDERING ORDER (BACK TO FRONT)
    // ==========================================

    // --- A. STARS (Deepest Background) ---
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

    // --- B. OUTER PLANETS (Drawn furthest to closest) ---
    const outerPlanets = ['neptune', 'uranus', 'saturn', 'jupiter', 'mars']
    outerPlanets.forEach((planetName) => {
      const calcFunction = (PlanetaryPositions as any)[planetName]
      if (typeof calcFunction === 'function') {
        const data: PositionData = calcFunction.call(PlanetaryPositions, currentDate.value)
        bodies.push({
          ...data, id: planetName, label: planetName.charAt(0).toUpperCase() + planetName.slice(1),
          imageId: planetName, isStar: false, isInteractive: true, moonPhase: data.moonPhase
        })
      }
    })

    // --- C. THE SUN (Occludes the outer planets) ---
    const sunData = PlanetaryPositions.sun(currentDate.value)
    bodies.push({
      ...sunData,
      id: 'sun', label: 'Sun', imageId: 'sun',
      isStar: true, isInteractive: true, visualMagnitude: -26.74
    })

    // --- D. INNER PLANETS (Drawn after the Sun so they can transit across it) ---
    const innerPlanets = ['venus', 'mercury']
    innerPlanets.forEach((planetName) => {
      const calcFunction = (PlanetaryPositions as any)[planetName]
      if (typeof calcFunction === 'function') {
        const data: PositionData = calcFunction.call(PlanetaryPositions, currentDate.value)
        bodies.push({
          ...data, id: planetName, label: planetName.charAt(0).toUpperCase() + planetName.slice(1),
          imageId: planetName, isStar: false, isInteractive: true, moonPhase: data.moonPhase
        })
      }
    })

    // --- E. THE MOON (Absolute Foreground - blocks the Sun for Eclipses) ---
    const moonData = PlanetaryPositions.moon(currentDate.value)
    bodies.push({
      ...moonData,
      id: 'moon', label: 'Moon', imageId: 'moon_phases_38',
      isStar: false, isInteractive: true, 
      moonPhase: PlanetaryPositions.getAbsoluteMoonPhase(currentDate.value)
    })

    activeBodies.value = bodies
  }

  watch(visMagThreshold, () => {
    recalculateSky()
  })

  // Initial calculation on load
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
    sunPath,
    isPlaying,
    playbackRate,
    selectedTargetId,
    selectedBody,
    togglePlay,
    setLocation,
    setDate,
    recalculateSky
  }
})
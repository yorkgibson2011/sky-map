<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSkyStore } from '../stores/skyStore'
import { CITIES, type City } from '../utils/CityData'

const skyStore = useSkyStore()

const initialCity = CITIES.find(c => c.name === 'Bristol') || CITIES[0]
const selectedCity = ref<City>(initialCity)

function getTzOffsetMs(date: Date, timeZone: string) {
  try {
    const tzStr = date.toLocaleString('en-US', { timeZone });
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    return new Date(tzStr).getTime() - new Date(utcStr).getTime();
  } catch (e) { return 0; }
}

function formatWithOffset(absoluteDate: Date, offsetMs: number): string {
  const localDate = new Date(absoluteDate.getTime() + offsetMs);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}`;
}

const visualOffsetMs = ref(getTzOffsetMs(skyStore.targetDate, skyStore.timezone))
let tzTweenId: number | null = null

function easeInOutCubic(x: number): number { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

watch(() => skyStore.timezone, (newTz) => {
  const startOffset = visualOffsetMs.value
  const targetOffset = getTzOffsetMs(skyStore.targetDate, newTz)
  if (startOffset === targetOffset) return
  if (tzTweenId) cancelAnimationFrame(tzTweenId)
  
  const startTime = performance.now()
  const durationMs = 1500 

  function step(currentTime: number) {
    const elapsed = currentTime - startTime
    let progress = elapsed / durationMs
    if (progress >= 1) {
      visualOffsetMs.value = targetOffset
      tzTweenId = null
      return
    }
    const eased = easeInOutCubic(progress)
    visualOffsetMs.value = startOffset + (targetOffset - startOffset) * eased
    tzTweenId = requestAnimationFrame(step)
  }
  tzTweenId = requestAnimationFrame(step)
})

const dateTimeInput = ref<string>(formatWithOffset(skyStore.targetDate, visualOffsetMs.value))
const isInputFocused = ref(false)

watch([() => skyStore.targetDate, visualOffsetMs], ([newDate, newOffset]) => {
  if (isInputFocused.value) return;
  const newStr = formatWithOffset(newDate, newOffset)
  if (dateTimeInput.value !== newStr) dateTimeInput.value = newStr
})

watch(selectedCity, (newCity) => {
  skyStore.setLocation(newCity.lat, newCity.lon, newCity.tz)
})

watch([() => skyStore.targetLatitude, () => skyStore.targetLongitude], ([targetLat, targetLon]) => {
  const matchedCity = CITIES.find(c => c.lat === targetLat && c.lon === targetLon)
  if (matchedCity && matchedCity.name !== selectedCity.value.name) selectedCity.value = matchedCity
})

function stepForwardOneDay() {
  const nextDay = new Date(skyStore.targetDate)
  nextDay.setDate(nextDay.getDate() + 1)
  skyStore.setDate(nextDay)
}

function onDateChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.value) {
    const localDateAsUtc = new Date(target.value + 'Z')
    if (isNaN(localDateAsUtc.getTime())) return; 
    const trueOffsetMs = getTzOffsetMs(localDateAsUtc, skyStore.timezone)
    const absoluteDate = new Date(localDateAsUtc.getTime() - trueOffsetMs)
    skyStore.setDate(absoluteDate, 1500)
  }
}

const RATES = [
  { label: '-1 Wk/s', val: -604800 },
  { label: '-1 Day/s', val: -86400 },
  { label: '-4 Hr/s', val: -14400 },
  { label: '-1 Hr/s', val: -3600 },
  { label: '-30 Min/s', val: -1800 },
  { label: '-15 Min/s', val: -900 },
  { label: '-1 Min/s', val: -60 },
  { label: 'Realtime', val: 1 },
  { label: '1 Min/s', val: 60 },
  { label: '15 Min/s', val: 900 },
  { label: '30 Min/s', val: 1800 },
  { label: '1 Hr/s', val: 3600 },
  { label: '4 Hr/s', val: 14400 },
  { label: '1 Day/s', val: 86400 },
  { label: '1 Wk/s', val: 604800 }
]
const rateIndex = ref(11)

function slower() {
  if (rateIndex.value > 0) {
    rateIndex.value--
    skyStore.playbackRate = RATES[rateIndex.value].val
  }
}

function faster() {
  if (rateIndex.value < RATES.length - 1) {
    rateIndex.value++
    skyStore.playbackRate = RATES[rateIndex.value].val
  }
}
</script>

<template>
  <div class="controls-panel">
    <div class="control-group">
      <label for="city-select">Location</label>
      <select id="city-select" v-model="selectedCity">
        <option v-for="city in CITIES" :key="city.name + '-' + city.country" :value="city">
          {{ city.name }}, {{ city.country }}
        </option>
      </select>
    </div>
    
    <div class="control-group">
      <label for="date-time-select">Local Time ({{ skyStore.timezone.split('/')[1]?.replace('_', ' ') || 'UTC' }})</label>
      <input 
        id="date-time-select" 
        type="datetime-local" 
        :value="dateTimeInput" 
        @input="onDateChange"
        @change="onDateChange" 
        @focus="isInputFocused = true"
        @blur="isInputFocused = false"
      />
    </div>

    <div class="control-group row-group">
      <input type="checkbox" id="atmosphere-toggle" v-model="skyStore.showAtmosphere" />
      <label for="atmosphere-toggle" class="checkbox-label">Atmosphere & Daylight</label>
    </div>
    
    <div class="control-group">
      <label>Time Travel & Playback</label>
      <button @click="stepForwardOneDay" class="full-btn">+1 Day Jump</button>
      
      <div class="playback-controls">
        <button @click="slower" :disabled="rateIndex === 0" title="Slower" class="scrub-btn icon-btn">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
        </button>
        
        <button @click="skyStore.togglePlay" class="play-btn" :class="{ 'is-active': skyStore.isPlaying }">
          <svg v-if="skyStore.isPlaying" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <span>{{ RATES[rateIndex].label }}</span>
        </button>
        
        <button @click="faster" :disabled="rateIndex === RATES.length - 1" title="Faster" class="scrub-btn icon-btn">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls-panel { background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(5px); padding: 15px 20px; border-radius: 8px; border: 1px solid #444; display: flex; flex-direction: column; gap: 15px; color: #fff; font-family: sans-serif; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); z-index: 10; flex-shrink: 0; }
.control-group { display: flex; flex-direction: column; gap: 5px; }
.row-group { flex-direction: row; align-items: center; gap: 10px; margin: 5px 0;}
label { font-size: 0.85rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
.checkbox-label { cursor: pointer; color: #fff; text-transform: none; letter-spacing: 0; font-size: 0.95rem;}
select, input:not([type="checkbox"]) { padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: white; outline: none; font-size: 1rem; }
input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: #3a86ff;}

button { padding: 8px 12px; background: #3a86ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s, transform 0.1s; }
button:hover:not(:disabled) { background: #2a66cc; }
button:active:not(:disabled) { transform: scale(0.97); }
button:disabled { opacity: 0.5; cursor: not-allowed; background: #444; }

.full-btn { width: 100%; margin-bottom: 5px; }
.playback-controls { display: flex; gap: 5px; margin-top: 5px; }
.scrub-btn { flex: 1; padding: 8px 0; background: #444; display: flex; justify-content: center; align-items: center; }
.scrub-btn:hover:not(:disabled) { background: #555; }
.play-btn { flex: 3; display: flex; justify-content: center; align-items: center; gap: 8px; }
.play-btn.is-active { background: #ff3a5e; }
.play-btn.is-active:hover { background: #cc2a4a; }

.icon-btn svg, .play-btn svg { width: 18px; height: 18px; }
</style>
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
  } catch (e) {
    return 0;
  }
}

function formatWithOffset(absoluteDate: Date, offsetMs: number): string {
  const localDate = new Date(absoluteDate.getTime() + offsetMs);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}`;
}

const visualOffsetMs = ref(getTzOffsetMs(skyStore.currentDate, skyStore.timezone))
let tzTweenId: number | null = null

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

watch(() => skyStore.timezone, (newTz) => {
  const startOffset = visualOffsetMs.value
  const targetOffset = getTzOffsetMs(skyStore.currentDate, newTz)
  
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

const dateTimeInput = ref<string>(formatWithOffset(skyStore.currentDate, visualOffsetMs.value))

watch([() => skyStore.currentDate, visualOffsetMs], ([newDate, newOffset]) => {
  const newStr = formatWithOffset(newDate, newOffset)
  if (dateTimeInput.value !== newStr) {
    dateTimeInput.value = newStr
  }
})

watch(selectedCity, (newCity) => {
  skyStore.setLocation(newCity.lat, newCity.lon, newCity.tz)
})

// Listen to target coordinates so the dropdown snaps instantly!
watch([() => skyStore.targetLatitude, () => skyStore.targetLongitude], ([targetLat, targetLon]) => {
  const matchedCity = CITIES.find(c => c.lat === targetLat && c.lon === targetLon)
  if (matchedCity && matchedCity.name !== selectedCity.value.name) {
    selectedCity.value = matchedCity
  }
})

function stepForwardOneDay() {
  const nextDay = new Date(skyStore.currentDate)
  nextDay.setDate(nextDay.getDate() + 1)
  skyStore.setDate(nextDay)
}

function onDateChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.value) {
    const localDateAsUtc = new Date(target.value + 'Z')
    const trueOffsetMs = getTzOffsetMs(localDateAsUtc, skyStore.timezone)
    const absoluteDate = new Date(localDateAsUtc.getTime() - trueOffsetMs)
    skyStore.setDate(absoluteDate)
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
      <input id="date-time-select" type="datetime-local" :value="dateTimeInput" @change="onDateChange" />
    </div>
    
    <div class="control-group">
      <label>Time Travel</label>
      <button @click="stepForwardOneDay">+1 Day</button>
    </div>
  </div>
</template>

<style scoped>
.controls-panel { position: absolute; top: 20px; left: 20px; background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(5px); padding: 15px 20px; border-radius: 8px; border: 1px solid #444; display: flex; flex-direction: column; gap: 15px; color: #fff; font-family: sans-serif; min-width: 250px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); z-index: 10; }
.control-group { display: flex; flex-direction: column; gap: 5px; }
label { font-size: 0.85rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
select, input { padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: white; outline: none; font-size: 1rem; }
button { padding: 8px 12px; background: #3a86ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
button:hover { background: #2a66cc; }
</style>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSkyStore } from '../stores/skyStore'
import { CITIES, type City } from '../utils/CityData'

const skyStore = useSkyStore()

const initialCity = CITIES.find(c => c.name === 'Bristol') || CITIES[0]
const selectedCity = ref<City>(initialCity)

// --- NEW: Timezone Transformation Helpers ---

// Calculates the millisecond difference between UTC and the target timezone at a specific date
function getTzOffsetMs(date: Date, timeZone: string) {
  try {
    const tzStr = date.toLocaleString('en-US', { timeZone });
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    return new Date(tzStr).getTime() - new Date(utcStr).getTime();
  } catch (e) {
    return 0; // Fallback to UTC if something fails
  }
}

// Converts the absolute Date object into a local string formatted for the HTML input
function formatForTimezone(absoluteDate: Date, timeZone: string): string {
  const offsetMs = getTzOffsetMs(absoluteDate, timeZone);
  const localDate = new Date(absoluteDate.getTime() + offsetMs);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}`;
}

// Converts a local string from the HTML input back into an absolute Date object
function parseFromTimezone(localStr: string, timeZone: string): Date {
  const localDateAsUtc = new Date(localStr + 'Z');
  const offsetMs = getTzOffsetMs(localDateAsUtc, timeZone);
  return new Date(localDateAsUtc.getTime() - offsetMs);
}

// --------------------------------------------

const dateTimeInput = ref<string>(formatForTimezone(skyStore.currentDate, skyStore.timezone))

// Update the input when either the ticking clock changes OR the user selects a new city timezone
watch([() => skyStore.currentDate, () => skyStore.timezone], ([newDate, newTz]) => {
  const newStr = formatForTimezone(newDate, newTz)
  if (dateTimeInput.value !== newStr) {
    dateTimeInput.value = newStr
  }
})

watch(selectedCity, (newCity) => {
  // Pass the timezone string to the store!
  skyStore.setLocation(newCity.lat, newCity.lon, newCity.tz)
})

watch([() => skyStore.latitude, () => skyStore.longitude], ([currentLat, currentLon]) => {
  const matchedCity = CITIES.find(c => c.lat === currentLat && c.lon === currentLon)
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
    // Parse the local input back into absolute time
    const absoluteDate = parseFromTimezone(target.value, skyStore.timezone)
    skyStore.setDate(absoluteDate)
  }
}
</script>

<template>
  <div class="controls-panel">
    <div class="control-group">
      <label for="city-select">Location</label>
      <select id="city-select" v-model="selectedCity">
        <option v-for="city in CITIES" :key="city.name" :value="city">
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
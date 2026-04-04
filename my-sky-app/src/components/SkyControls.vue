<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSkyStore } from '../stores/skyStore'
import { CITIES, type City } from '../utils/CityData'

const skyStore = useSkyStore()

// 1. Setup the initial state for the City Select
const initialCity = CITIES.find(c => c.name === 'Bristol') || CITIES[0]
const selectedCity = ref<City>(initialCity)

// 2. Format the Date object so the HTML <input type="datetime-local"> can read it
// The format required is: YYYY-MM-DDThh:mm
function formatDateForInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const dateTimeInput = ref<string>(formatDateForInput(skyStore.currentDate))

// 3. Reactively update the Pinia Store when the user changes a value
watch(selectedCity, (newCity) => {
  skyStore.setLocation(newCity.lat, newCity.lon)
})

watch(dateTimeInput, (newDateTimeString) => {
  if (newDateTimeString) {
    skyStore.setDate(new Date(newDateTimeString))
  }
})

// Bonus: A quick button to jump forward in time by 1 day!
function stepForwardOneDay() {
  const nextDay = new Date(skyStore.currentDate)
  nextDay.setDate(nextDay.getDate() + 1)
  dateTimeInput.value = formatDateForInput(nextDay)
}

// Call this when the input natively registers a complete change
function onDateChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.value) {
    skyStore.setDate(new Date(target.value))
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
      <label for="date-time-select">Date & Time</label>
      <input 
        id="date-time-select" 
        type="datetime-local" 
        :value="dateTimeInput" 
        @change="onDateChange" 
      />
    </div>

    <div class="control-group">
      <label>Time Travel</label>
      <button @click="stepForwardOneDay">+1 Day</button>
    </div>

  </div>
</template>

<style scoped>
.controls-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(5px);
  padding: 15px 20px;
  border-radius: 8px;
  border: 1px solid #444;
  display: flex;
  flex-direction: column;
  gap: 15px;
  color: #fff;
  font-family: sans-serif;
  min-width: 250px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  z-index: 10;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

label {
  font-size: 0.85rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

select, input {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #222;
  color: white;
  outline: none;
  font-size: 1rem;
}

button {
  padding: 8px 12px;
  background: #3a86ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

button:hover {
  background: #2a66cc;
}
</style>
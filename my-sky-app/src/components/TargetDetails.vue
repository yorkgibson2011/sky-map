<script setup lang="ts">
import { useSkyStore } from '../stores/skyStore'
const skyStore = useSkyStore()

function clearTarget() {
  skyStore.selectedTargetId = null
}
</script>

<template>
  <div v-if="skyStore.selectedBody" class="target-details">
    <div class="header">
      <div class="title-group">
        <span class="pulse-dot"></span>
        <h3>{{ skyStore.selectedBody.label }}</h3>
      </div>
      <button class="close-btn" @click="clearTarget" title="Clear Target">✕</button>
    </div>

    <div class="data-grid">
      <div class="data-item" v-if="skyStore.selectedBody.isStar !== undefined">
        <label>Classification</label>
        <span>{{ skyStore.selectedBody.isStar ? (skyStore.selectedBody.id === 'sun' ? 'Star' : 'Deep Space') : 'Solar System' }}</span>
      </div>

      <div class="data-item" v-if="skyStore.selectedBody.visualMagnitude !== undefined">
        <label>Vis. Magnitude</label>
        <span>{{ skyStore.selectedBody.visualMagnitude.toFixed(2) }}</span>
      </div>

      <div class="data-item" v-if="skyStore.selectedBody.altitude !== undefined">
        <label>Altitude</label>
        <span>{{ skyStore.selectedBody.altitude.toFixed(2) }}°</span>
      </div>

      <div class="data-item" v-if="skyStore.selectedBody.azimuth !== undefined">
        <label>Azimuth</label>
        <span>{{ skyStore.selectedBody.azimuth.toFixed(2) }}°</span>
      </div>

      <div class="data-item" v-if="skyStore.selectedBody.RightAscension">
        <label>Right Asc. (RA)</label>
        <span>{{ skyStore.selectedBody.RightAscension }}</span>
      </div>

      <div class="data-item" v-if="skyStore.selectedBody.Declination">
        <label>Declination (Dec)</label>
        <span>{{ skyStore.selectedBody.Declination }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.target-details { background: rgba(40, 15, 20, 0.85); backdrop-filter: blur(5px); padding: 15px 20px; border-radius: 8px; border: 1px solid #ff3a5e; display: flex; flex-direction: column; gap: 12px; color: #fff; font-family: sans-serif; width: 100%; box-sizing: border-box; box-shadow: 0 4px 20px rgba(255, 58, 94, 0.15); animation: slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); flex-shrink: 0;}
@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px; }
.title-group { display: flex; align-items: center; gap: 8px; }
.pulse-dot { width: 8px; height: 8px; background-color: #ff3a5e; border-radius: 50%; box-shadow: 0 0 8px #ff3a5e; animation: pulse 2s infinite; }
@keyframes pulse { 0% { opacity: 1; box-shadow: 0 0 8px #ff3a5e; } 50% { opacity: 0.5; box-shadow: 0 0 2px #ff3a5e; } 100% { opacity: 1; box-shadow: 0 0 8px #ff3a5e; } }
.header h3 { margin: 0; color: #fff; font-size: 1.1rem; letter-spacing: 0.5px; }
.close-btn { background: transparent; border: none; color: #aaa; font-size: 1.2rem; cursor: pointer; padding: 0; transition: color 0.2s; }
.close-btn:hover { color: #fff; }
.data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.data-item { display: flex; flex-direction: column; gap: 2px; }
.data-item label { font-size: 0.7rem; color: #ff8b9f; text-transform: uppercase; letter-spacing: 0.5px; }
.data-item span { font-size: 0.95rem; color: #fff; font-family: monospace; }
</style>
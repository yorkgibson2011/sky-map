<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useSkyStore } from '../stores/skyStore'
import TargetDetails from './TargetDetails.vue'
import SkyControls from './SkyControls.vue'
import WorldMap from './WorldMap.vue'

const skyStore = useSkyStore()
const isPanelOpen = ref(true)
const scrollAreaRef = ref<HTMLElement | null>(null)

// NEW: Auto-scroll functionality
watch(() => skyStore.selectedTargetId, async (newId) => {
  await nextTick() // Wait for the DOM to render the panel
  if (scrollAreaRef.value) {
    if (newId) {
      // Smoothly scroll to the bottom when a target is locked
      scrollAreaRef.value.scrollTo({ top: scrollAreaRef.value.scrollHeight, behavior: 'smooth' })
    } else {
      // Smoothly scroll back to the top when cleared
      scrollAreaRef.value.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
})
</script>

<template>
  <div class="dashboard-sidebar" :class="{ 'is-closed': !isPanelOpen }">
    
    <div class="sidebar-toggle" @click="isPanelOpen = !isPanelOpen">
      <svg v-if="isPanelOpen" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
      </svg>
    </div>

    <div class="sidebar-scroll-area" ref="scrollAreaRef">
      <SkyControls />
      <WorldMap />
      <TargetDetails />
    </div>

  </div>
</template>

<style scoped>
.dashboard-sidebar { position: absolute; top: 0; left: 0; height: 100vh; width: 320px; background: rgba(15, 15, 15, 0.6); backdrop-filter: blur(10px); border-right: 1px solid #444; display: flex; flex-direction: column; transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 50; }
.dashboard-sidebar.is-closed { transform: translateX(-100%); }
.sidebar-toggle { position: absolute; top: 20px; right: -32px; width: 32px; height: 48px; background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(5px); border: 1px solid #444; border-left: none; border-radius: 0 8px 8px 0; color: white; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: background 0.2s; }
.sidebar-toggle:hover { background: rgba(50, 50, 50, 0.95); }
.sidebar-scroll-area { padding: 20px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 20px; height: 100%; box-sizing: border-box; scroll-behavior: smooth; }
.sidebar-scroll-area::-webkit-scrollbar { width: 0; }
</style>
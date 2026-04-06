<script setup lang="ts">
import SkyDome from './components/SkyDome.vue'
import SidePanel from './components/SidePanel.vue'
</script>

<template>
  <div class="app-wrapper">
    <SkyDome />
    <SidePanel />
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  background-color: #0c0c0c;
  overflow: hidden; 
}
.app-wrapper {
  position: relative; 
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
<script setup lang="ts">
import SkyDome from './components/SkyDome.vue'
import SkyControls from './components/SkyControls.vue'
</script>

<template>
  <div class="app-wrapper">
    <SkyControls />
    <SkyDome />
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  background-color: #000;
  overflow: hidden; /* Prevents scrollbars */
}
.app-wrapper {
  position: relative; /* Allows SkyControls to absolute-position on top */
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
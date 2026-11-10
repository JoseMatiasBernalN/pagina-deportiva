<script setup>
defineProps({
  player: { type: Object, required: true },
  teamColor: { type: String, default: '#0033a0' }
})
</script>

<template>
  <div class="card">
    <div class="component-img" :style="{ backgroundColor: teamColor }">
      <img :src="player.image" :alt="player.name" class="imagen-card" />
      <div class="name-card-float" :style="player.nameColor ? { color: player.nameColor } : undefined">
        {{ player.name }}
      </div>
    </div>
    <div class="stats-grid">
      <div v-for="stat in player.stats" :key="stat.label" class="stat-item">
        {{ stat.label }}: <span class="stat-value">{{ stat.value }}</span>
      </div>
    </div>
    <div class="mejor-partido">{{ player.best }}</div>
  </div>
</template>

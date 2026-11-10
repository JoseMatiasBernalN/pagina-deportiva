<script setup>
import PlayerStatCard from './PlayerStatCard.vue'

defineProps({
  team: { type: Object, required: true }
})
</script>

<template>
  <section class="seccion-equipo">
    <h2 class="titulo-equipo" :style="{ borderColor: team.borderColor, color: team.titleColor }">
      {{ team.title }}
    </h2>
    <div class="hilera">
      <PlayerStatCard
        v-for="player in team.players"
        :key="player.image"
        :player="player"
        :team-color="team.color"
      />
    </div>
  </section>
</template>

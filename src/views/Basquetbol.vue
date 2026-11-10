<script setup>
import TeamStatsSection from '../components/TeamStatsSection.vue'
import teams from '../data/basquetbol.js'
import ApiMatchesPanel from '../components/ApiMatchesPanel.vue'
</script>

<template>
  <main class="contenedor-equipos">
    <ApiMatchesPanel sport="basketball" />
    <TeamStatsSection v-for="team in teams" :key="team.title" :team="team" />
  </main>
</template>

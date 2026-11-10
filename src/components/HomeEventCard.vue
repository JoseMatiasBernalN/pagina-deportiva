<script setup>
defineProps({
  event: { type: Object, required: true }
})
</script>

<template>
  <article class="card">
    <div class="component-img">
      <img :src="event.image" :alt="event.home + ' vs ' + event.away" class="imagen-card" />
      <div class="name-card-float">{{ event.home }} vs {{ event.away }}</div>
    </div>
    <div class="cuotas">
      <div class="cuota">
        <div>{{ event.home }}</div>
        <div class="cuota-valor">{{ event.homeOdds.toFixed(2) }}</div>
      </div>
      <div v-if="event.drawOdds" class="cuota">
        <div>Empate</div>
        <div class="cuota-valor">{{ event.drawOdds.toFixed(2) }}</div>
      </div>
      <div class="cuota">
        <div>{{ event.away }}</div>
        <div class="cuota-valor">{{ event.awayOdds.toFixed(2) }}</div>
      </div>
    </div>
  </article>
</template>

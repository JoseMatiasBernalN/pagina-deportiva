<script setup>
defineProps({
  event: { type: Object, required: true }
})
</script>

<template>
  <article class="live-item">
    <div class="component-img">
      <img :src="event.image" :alt="event.alt" />
      <div class="live-badge">EN VIVO</div>
    </div>
    <div class="contenido">
      <h3>{{ event.title }}</h3>
      <p>{{ event.description }}</p>
      <p v-if="event.detail">{{ event.detail }}</p>
      <a href="#" class="btn">Apuesta Ahora</a>
    </div>
  </article>
</template>

<script setup>
defineProps({
  game: { type: Object, required: true }
})

defineEmits(['select'])
</script>

<template>
  <article class="card-juego">
    <img :src="game.image" :alt="game.alt" class="card-img" />
    <h3>{{ game.title }}</h3>
    <p>{{ game.description }}</p>
    <button class="btn-accion" :style="game.buttonStyle" @click="$emit('select', game.id)">
      Jugar Ahora
    </button>
  </article>
</template>

<style scoped>
.card-juego {
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  background: #1e293b;
  color: #fff;
  text-align: center;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card-juego:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.3);
}

.card-img {
  width: 100%;
  height: 140px;
  margin-bottom: 15px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  object-fit: contain;
}

h3 {
  margin-bottom: 8px;
  color: #38bdf8;
  font-size: 1.2rem;
}

p {
  margin-bottom: 15px;
  color: #94a3b8;
  font-size: 0.9rem;
}

.btn-accion {
  width: 100%;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  background: #16a34a;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
}

.btn-accion:hover {
  background: #15803d;
  transform: scale(1.02);
}
</style>

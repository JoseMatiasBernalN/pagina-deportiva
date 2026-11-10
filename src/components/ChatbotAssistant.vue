<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const abierto = ref(false)
const widget = ref(null)
const saludo = ref('Cargando asistente...')

function toggleChat() {
  abierto.value = !abierto.value
  if (abierto.value) saludo.value = 'Hola, soy tu asistente de apuestas'
}

function cerrarSiExterno(event) {
  if (widget.value && !widget.value.contains(event.target)) abierto.value = false
}

onMounted(() => document.addEventListener('click', cerrarSiExterno))
onUnmounted(() => document.removeEventListener('click', cerrarSiExterno))
</script>

<template>
  <div ref="widget" class="chatbot-widget" @click.stop>
    <div id="chatbot-button" role="button" tabindex="0" aria-label="Abrir asistente" @click="toggleChat" @keydown.enter="toggleChat">
      <img src="https://cdn-icons-png.flaticon.com/512/4712/4712100.png" alt="Chatbot" />
    </div>

    <div v-if="abierto" id="chatbot-container" style="display: block">
      <div id="chatbot-header">
        <span>🤖 Asistente PlayExpert</span>
        <button id="close-btn" type="button" aria-label="Cerrar asistente" @click="toggleChat">❌</button>
      </div>
      <div id="chatbot-body">
        <p>{{ saludo }}</p>
        <ul>
          <li><router-link to="/registro">🎁 Bono de Bienvenida</router-link></li>
          <li><router-link to="/apuestas-live">⚽ Apuestas Deportivas</router-link></li>
          <li><a href="/promociones.html">💰 Promociones Activas</a></li>
          <li><a href="/soporte.html">📞 Soporte 24/7</a></li>
        </ul>
      </div>
    </div>
  </div>
</template>

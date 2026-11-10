<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const menuAbierto = ref(false)
const encabezadoOculto = ref(false)
let ultimoScroll = 0
const estiloEncabezado = computed(() => ['home', 'deportes'].includes(route.name) && encabezadoOculto.value ? { top: '-100px' } : undefined)
const enlacesPorPagina = {
  home: [
    { label: 'juegos', to: '/juegos' },
    { label: 'Apuestas en Vivo', to: '/apuestas-live' },
    { label: 'Jugadores', to: '/futbol' },
    { label: 'Mi Cuenta', to: '/cuenta' },
    { label: 'inicio de sesion', to: '/login' }
  ],
  deportes: [
    { label: 'juegos', to: '/juegos' },
    { label: 'Apuestas en Vivo', to: '/apuestas-live' },
    { label: 'Jugadores', to: '/futbol' },
    { label: 'Mi Cuenta', to: '/cuenta' },
    { label: 'inicio de sesion', to: '/login' }
  ],
  futbol: [
    { label: 'Inicio', to: '/' },
    { label: 'futbol', to: '/futbol' },
    { label: 'Básquetbol', to: '/basquetbol' },
    { label: 'Mi Cuenta', to: '/cuenta' }
  ],
  jugadores: [
    { label: 'Inicio', to: '/' },
    { label: 'futbol', to: '/futbol' },
    { label: 'Básquetbol', to: '/basquetbol' },
    { label: 'Mi Cuenta', to: '/cuenta' }
  ],
  basquetbol: [
    { label: 'Inicio', to: '/' },
    { label: 'Fútbol', to: '/futbol' },
    { label: 'Básquetbol', to: '/basquetbol' },
    { label: 'Mi Cuenta', to: '/cuenta' }
  ],
  juegos: [
    { label: 'Juegos', to: '/juegos' },
    { label: 'Apuestas en Vivo', to: '/apuestas-live' },
    { label: 'Jugadores', to: '/jugadores' },
    { label: 'Mi Cuenta', to: '/cuenta' }
  ],
  'apuestas-live': [
    { label: 'Deportes', to: '/deportes' },
    { label: 'Apuestas en Vivo', to: '/apuestas-live' },
    { label: 'Jugadores', to: '/jugadores' },
    { label: 'Mi Cuenta', to: '/cuenta' },
    { label: 'Juegos', to: '/juegos' }
  ]
}
const enlaces = computed(() => enlacesPorPagina[route.name] || enlacesPorPagina.home)

function controlarScroll() {
  const actual = window.scrollY || document.documentElement.scrollTop
  encabezadoOculto.value = route.name === 'home' && actual > ultimoScroll
  ultimoScroll = actual
}

watch(() => route.name, () => {
  encabezadoOculto.value = false
  ultimoScroll = window.scrollY || 0
})

onMounted(() => window.addEventListener('scroll', controlarScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', controlarScroll))

// SEGURIDAD: antes pro.js armaba esto con innerHTML y
// `Hola, ${localStorage.getItem('usuario_nombre')}` directo en el HTML.
// Como "nombre" lo escribe el propio usuario en el registro, alguien
// podía registrarse con un nombre tipo
// "<img src=x onerror=robaCookies()>" y ejecutar JavaScript en la
// sesión de cualquiera que viera esa cadena (XSS almacenado).
// Aquí {{ auth.perfil?.nombre }} usa interpolación de texto de Vue,
// que siempre escapa el contenido: nunca se interpreta como HTML.
async function salir() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="header" :style="estiloEncabezado">
    <button class="menu-toggle" @click="menuAbierto = !menuAbierto">
      <span class="material-symbols-outlined">menu</span>
    </button>
    <div class="logo">
      <img v-if="route.name !== 'juegos'" src="/imagenes/logo.png" alt="PlayExpert Logo" />
      <div class="logo-text">PlayExpert</div>
    </div>
    <nav :class="['nav', { abierto: menuAbierto }]">
      <ul>
        <li v-for="enlace in enlaces" :key="enlace.label">
          <router-link :to="enlace.to" :class="{ activo: route.path === enlace.to }">{{ enlace.label }}</router-link>
        </li>
        <li v-if="auth.logueado" class="sesion-nav">
          <span>Hola, {{ auth.perfil?.nombre?.split(' ')[0] || auth.usuario?.email }}</span>
          <button class="btn-cerrar-sesion" @click="salir">Cerrar sesión</button>
        </li>
      </ul>
    </nav>
  </header>
</template>

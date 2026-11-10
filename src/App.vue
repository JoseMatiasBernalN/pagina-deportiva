<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'

const route = useRoute()
const mostrarNavPrincipal = computed(() => !['login', 'registro', 'cuenta'].includes(route.name))
</script>

<template>
  <NavBar v-if="mostrarNavPrincipal" />
  <main>
    <router-view />
  </main>
</template>

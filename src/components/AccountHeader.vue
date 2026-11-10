<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function cerrarSesion() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="account-header">
    <h1>PlayExpert</h1>
    <nav>
      <router-link to="/">Inicio</router-link>
      <router-link to="/juegos">Juegos</router-link>
      <router-link to="/apuestas-live">Apuestas</router-link>
      <router-link to="/jugadores">Jugadores</router-link>
      <router-link v-if="auth.esStaff" class="admin-link" to="/admin">Panel Admin</router-link>
      <button type="button" @click="cerrarSesion">Cerrar Sesión</button>
    </nav>
  </header>
</template>

<style scoped>
.account-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 30px;
  background: #1a1a1a;
  color: #fff;
}

h1 { margin: 0; font-size: 2rem; }
nav { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
nav a { color: #fff; font-weight: 700; text-decoration: none; }
nav a:hover { color: #ddd; }
.admin-link { padding: 6px 12px; border-radius: 4px; background: #e74c3c; }
button { padding: 6px 12px; border: 0; border-radius: 4px; background: #333; color: #fff; font-weight: 700; cursor: pointer; }

@media (max-width: 700px) {
  .account-header { align-items: flex-start; flex-direction: column; gap: 12px; padding: 15px; }
  nav { gap: 12px; }
}
</style>

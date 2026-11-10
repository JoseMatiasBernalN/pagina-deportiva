<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '../components/AuthLayout.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const correo = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)

async function enviar() {
  error.value = ''
  cargando.value = true
  try {
    await auth.login(correo.value.trim(), password.value)
    // Esperamos a que onSnapshot traiga el perfil para decidir a dónde ir.
    await new Promise((r) => setTimeout(r, 300))
    if (auth.bloqueado) {
      error.value = 'Esta cuenta ha sido bloqueada por motivos de seguridad.'
      await auth.logout()
      return
    }
    router.push(auth.esStaff ? { name: 'admin' } : { name: 'cuenta' })
  } catch (e) {
    if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(e.code)) {
      error.value = 'Correo o contraseña incorrectos.'
    } else if (e.code === 'auth/too-many-requests') {
      error.value = 'Demasiados intentos fallidos. Intenta más tarde.'
    } else {
      error.value = 'Error al conectar con el servidor.'
    }
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <AuthLayout full-screen>
    <section class="card-registro">
      <h2>Iniciar sesión</h2>
      <form @submit.prevent="enviar">
        <label for="correo">Correo Electrónico:</label>
        <input id="correo" v-model="correo" type="email" required autocomplete="email" placeholder="ejemplo@correo.com" />

        <label for="password">Contraseña:</label>
        <input id="password" v-model="password" type="password" required autocomplete="current-password" placeholder="••••••••" />

        <p v-if="error" style="color:#ef4444">{{ error }}</p>

        <button class="btn-submit" type="submit" :disabled="cargando">
          {{ cargando ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
      <p>¿No tienes una cuenta? <router-link to="/registro">Regístrate aquí</router-link></p>
    </section>
  </AuthLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '../components/AuthLayout.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = ref({
  nombre: '', correo: '', cedula: '', fechaExpedicion: '',
  fechaNacimiento: '', telefono: '', ciudad: 'Santa Marta'
})
const contrasena = ref('')
const error = ref('')
const cargando = ref(false)

// Misma validación de mayoría de edad que registro.js, ahora reactiva.
const mensajeEdad = computed(() => {
  if (!form.value.fechaNacimiento) return ''
  const nac = new Date(form.value.fechaNacimiento)
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad < 18 ? 'Debes ser mayor de 18 años para registrarte en PlayExpert.' : '¡Edad verificada con éxito!'
})
const edadOk = computed(() => mensajeEdad.value.startsWith('¡'))

async function enviar() {
  error.value = ''
  if (!edadOk.value) { error.value = 'Debes ser mayor de edad para registrarte.'; return }
  cargando.value = true
  try {
    await auth.registrar({ ...form.value }, contrasena.value)
    router.push({ name: 'login' })
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') error.value = 'Este correo ya está registrado.'
    else if (e.code === 'auth/weak-password') error.value = 'La contraseña debe tener al menos 6 caracteres.'
    else error.value = 'Hubo un error al registrarte: ' + e.message
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="registration-page">
    <header class="auth-header">
      <div class="auth-logo"><h1>PlayExpert</h1></div>
      <nav>
        <ul>
          <li><router-link to="/">Inicio</router-link></li>
          <li><router-link to="/login">Iniciar Sesión</router-link></li>
        </ul>
      </nav>
    </header>

    <AuthLayout>
      <section class="card-registro">
        <h2><i class="fas fa-user-plus" aria-hidden="true"></i> Crear Cuenta</h2>
        <p class="subtitulo">Regístrate para comenzar a apostar y ganar.</p>
        <form @submit.prevent="enviar">
          <label><i class="fas fa-user" aria-hidden="true"></i> Nombre Completo</label>
          <input v-model="form.nombre" required placeholder="Tu nombre completo" />
          <label><i class="fas fa-envelope" aria-hidden="true"></i> Correo Electrónico</label>
          <input v-model="form.correo" type="email" required placeholder="correo@ejemplo.com" />
          <label><i class="fas fa-id-card" aria-hidden="true"></i> Cédula de Ciudadanía</label>
          <input v-model="form.cedula" required placeholder="Número de cédula" />
          <label><i class="fas fa-calendar-alt" aria-hidden="true"></i> Fecha de Expedición de Cédula</label>
          <input v-model="form.fechaExpedicion" type="date" required />
          <label><i class="fas fa-birthday-cake" aria-hidden="true"></i> Fecha de Nacimiento</label>
          <input v-model="form.fechaNacimiento" type="date" required />
          <p v-if="mensajeEdad" :style="{ color: edadOk ? '#22c55e' : '#ef4444' }">{{ mensajeEdad }}</p>
          <label><i class="fas fa-phone" aria-hidden="true"></i> Teléfono Móvil</label>
          <input v-model="form.telefono" required placeholder="Número de celular" />
          <label><i class="fas fa-city" aria-hidden="true"></i> Ciudad</label>
          <input v-model="form.ciudad" required placeholder="Tu ciudad" />
          <label><i class="fas fa-lock" aria-hidden="true"></i> Contraseña</label>
          <input v-model="contrasena" type="password" required minlength="6" placeholder="Contraseña segura (mínimo 6 caracteres)" />

          <p v-if="error" style="color:#ef4444">{{ error }}</p>

          <button class="btn-submit" type="submit" :disabled="cargando || !edadOk">
            {{ cargando ? 'Creando cuenta...' : 'Registrarse y Obtener Bono' }}
          </button>
        </form>
        <p class="footer-link">¿Ya tienes una cuenta? <router-link to="/login">Inicia sesión aquí</router-link></p>
      </section>
    </AuthLayout>
    <footer class="auth-footer">© 2026 PlayExpert. Todos los derechos reservados.</footer>
  </div>
</template>

<style scoped>
.registration-page {
  min-height: 100vh;
  background: #f4f4f4 url('/jigsaw/jigsaw.svg') repeat fixed;
}

.auth-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 30px;
  background: #003366;
  color: #fff;
}

.auth-logo h1 {
  margin: 0;
  color: #fff;
  font-size: 1.8rem;
}

.auth-header ul {
  display: flex;
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.auth-header a {
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}

.auth-header a:hover {
  color: #4da6ff;
}

.subtitulo {
  margin: 0 0 1rem;
  color: #555;
  font-size: 0.9rem;
  text-align: center;
}

.footer-link {
  margin-top: 20px !important;
}

.auth-footer {
  padding: 1rem;
  background: #003366;
  color: #fff;
  text-align: center;
}

@media (max-width: 600px) {
  .auth-header { padding: 12px 16px; }
  .auth-logo h1 { font-size: 1.4rem; }
  .auth-header ul { gap: 12px; }
}
</style>

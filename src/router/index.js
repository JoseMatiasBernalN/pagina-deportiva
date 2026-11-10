import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/Home.vue') },
  { path: '/deportes', name: 'deportes', component: () => import('../views/Home.vue') },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
  { path: '/registro', name: 'registro', component: () => import('../views/Registro.vue') },
  { path: '/cuenta', name: 'cuenta', component: () => import('../views/Cuenta.vue'), meta: { requiereSesion: true } },
  { path: '/depositar', name: 'depositar', component: () => import('../views/Depositar.vue'), meta: { requiereSesion: true } },
  { path: '/retirar', name: 'retirar', component: () => import('../views/Retirar.vue'), meta: { requiereSesion: true } },
  { path: '/historial', name: 'historial', component: () => import('../views/Historial.vue'), meta: { requiereSesion: true } },
  { path: '/apuestas-live', name: 'apuestas-live', component: () => import('../views/ApuestasLive.vue') },
  { path: '/futbol', name: 'futbol', component: () => import('../views/Futbol.vue') },
  { path: '/basquetbol', name: 'basquetbol', component: () => import('../views/Basquetbol.vue') },
  { path: '/jugadores', name: 'jugadores', component: () => import('../views/Jugadores.vue') },
  { path: '/juegos', name: 'juegos', component: () => import('../views/Juegos.vue') },
  { path: '/juego-responsable', name: 'juego-responsable', component: () => import('../views/JuegoResponsable.vue') },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiereSesion: true, requiereStaff: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guard de navegación: antes el "acceso restringido" de cuenta.html y
// admin.html se validaba leyendo localStorage DESPUÉS de que la página
// ya se había cargado (parpadeo + fácil de saltar). Aquí se valida
// contra el estado real de Firebase Auth / Firestore antes de entrar
// a la ruta.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.listo // espera a que Firebase confirme si hay sesión o no

  if (to.meta.requiereSesion && !auth.logueado) {
    return { name: 'login' }
  }
  if (to.meta.requiereStaff && !auth.esStaff) {
    return { name: 'cuenta' }
  }
  return true
})

export default router

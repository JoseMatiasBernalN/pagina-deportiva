<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import AccountHeader from '../components/AccountHeader.vue'
import { useAuthStore } from '../stores/auth'
import { db } from '../firebase'

const auth = useAuthStore()
const cargandoEstadisticas = ref(true)
const errorEstadisticas = ref(false)
const categorias = ref([
  { nombre: 'Depósitos', total: 0, color: '#16a34a' },
  { nombre: 'Retiros', total: 0, color: '#2563eb' },
  { nombre: 'Apuestas', total: 0, color: '#f59e0b' },
  { nombre: 'Premios', total: 0, color: '#9333ea' },
  { nombre: 'Pérdidas', total: 0, color: '#dc2626' }
])
const juegosGanados = ref(0)
const juegosPerdidos = ref(0)

const saldoFormateado = computed(() => '$' + new Intl.NumberFormat('es-CO').format(auth.saldo || 0) + ' COP')
const totalJuegos = computed(() => juegosGanados.value + juegosPerdidos.value)
const porcentajeGanados = computed(() => totalJuegos.value ? Math.round(juegosGanados.value * 100 / totalJuegos.value) : 0)
const radio = 38
const circunferencia = 2 * Math.PI * radio
const arcoGanados = computed(() => `${circunferencia * porcentajeGanados.value / 100} ${circunferencia}`)
const maximoCategoria = computed(() => Math.max(...categorias.value.map((item) => item.total), 1))
const barras = computed(() => categorias.value.map((item, indice) => ({
  ...item,
  y: indice * 34,
  ancho: Math.max(Math.round(item.total / maximoCategoria.value * 170), 2),
  valorX: 86 + Math.round(item.total / maximoCategoria.value * 170)
})))

onMounted(cargarEstadisticas)

async function cargarEstadisticas() {
  if (!auth.usuario?.uid) {
    cargandoEstadisticas.value = false
    return
  }

  try {
    const snapshot = await getDocs(query(
      collection(db, 'historial_apuestas'),
      where('usuarioId', '==', auth.usuario.uid)
    ))
    const totals = Object.fromEntries(categorias.value.map((item) => [item.nombre, 0]))
    let ganados = 0
    let perdidos = 0

    snapshot.forEach((registro) => {
      const item = registro.data()
      const monto = Number(item.numValor || 0)
      const descripcion = item.descripcion || ''
      const gano = (item.valor || '').includes('+')

      if (descripcion.startsWith('Depósito')) totals['Depósitos'] += monto
      else if (descripcion.startsWith('Retiro')) totals.Retiros += monto
      else if (descripcion.startsWith('Apuesta') || descripcion.startsWith('Combinada')) totals.Apuestas += monto
      else if (descripcion.startsWith('Cash')) totals.Premios += monto
      else if (descripcion.startsWith('Juego')) {
        if (gano) {
          totals.Premios += monto
          ganados++
        } else {
          totals['Pérdidas'] += monto
          perdidos++
        }
      }
    })

    categorias.value = categorias.value.map((item) => ({ ...item, total: totals[item.nombre] || 0 }))
    juegosGanados.value = ganados
    juegosPerdidos.value = perdidos
  } catch (error) {
    console.error('No se pudieron cargar las estadísticas:', error)
    errorEstadisticas.value = true
  } finally {
    cargandoEstadisticas.value = false
  }
}
</script>

<template>
  <div class="account-page">
    <AccountHeader />
    <main class="account-content">
      <section v-if="auth.perfil" class="card-registro profile-card">
        <h2>Perfil de Usuario</h2>
        <div class="info-usuario">
          <p><strong>Nombre:</strong> {{ auth.perfil.nombre || 'No disponible' }}</p>
          <p><strong>Correo:</strong> {{ auth.perfil.correo || auth.usuario?.email || 'No disponible' }}</p>
          <p><strong>Cédula:</strong> {{ auth.perfil.cedula || 'No disponible' }}</p>
          <p><strong>Teléfono:</strong> {{ auth.perfil.telefono || 'No disponible' }}</p>
          <p><strong>Ciudad:</strong> {{ auth.perfil.ciudad || 'No disponible' }}</p>
          <p><strong>Saldo Actual:</strong> {{ saldoFormateado }}</p>
        </div>

        <div class="botones-accion">
          <router-link to="/depositar" class="btn depositar">Depositar</router-link>
          <router-link to="/retirar" class="btn retirar">Retirar</router-link>
          <router-link to="/historial" class="btn historial">Historial</router-link>
        </div>
      </section>

      <section class="card-registro statistics-card">
        <h2>Mis estadísticas</h2>
        <p v-if="cargandoEstadisticas">Cargando...</p>
        <p v-else-if="errorEstadisticas">No se pudieron cargar.</p>
        <template v-else>
          <svg class="chart-bars" viewBox="0 0 400 170" role="img" aria-label="Movimientos por categoría">
            <g v-for="(barra, indice) in barras" :key="barra.nombre">
              <text x="0" :y="barra.y + 15" font-size="12" fill="#333">{{ barra.nombre }}</text>
              <rect x="80" :y="barra.y" :width="barra.ancho" height="20" rx="4" :fill="barra.color" />
              <text :x="barra.valorX" :y="barra.y + 15" font-size="11" fill="#333">{{ barra.total.toLocaleString('es-CO') }}</text>
            </g>
          </svg>
          <div class="games-rate">
            <svg width="96" height="96" viewBox="0 0 100 100" role="img" aria-label="Porcentaje de juegos ganados">
              <circle cx="50" cy="50" :r="radio" fill="none" stroke="#fecaca" stroke-width="14" />
              <circle cx="50" cy="50" :r="radio" fill="none" stroke="#16a34a" stroke-width="14" :stroke-dasharray="arcoGanados" transform="rotate(-90 50 50)" />
              <text x="50" y="55" text-anchor="middle" font-size="18" font-weight="700" fill="#333">{{ porcentajeGanados }}%</text>
            </svg>
            <div><strong>Juegos ganados</strong><br />{{ juegosGanados }} de {{ totalJuegos }} jugadas</div>
          </div>
        </template>
      </section>
    </main>
  </div>
</template>

<style scoped>
.account-page {
  min-height: 100vh;
  background: #f4f4f4 url('/jigsaw/jigsaw.svg') repeat fixed;
}

.account-content {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 2rem;
}

.card-registro {
  width: 100%;
  max-width: 500px;
  padding: 2rem;
  border-radius: 12px;
  background: rgba(250, 250, 250, 0.95);
  color: #111;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

h2 { margin: 0 0 1rem; color: #003366; text-align: center; }
.info-usuario { margin-top: 20px; line-height: 1.8; }
.info-usuario p { margin: 0 0 14px; }
.botones-accion { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.btn { display: inline-block; padding: 10px 20px; border-radius: 5px; color: #fff; font-weight: 700; text-decoration: none; }
.depositar { background: #27ae60; }
.retirar { background: #2980b9; }
.historial { background: #f39c12; }
.chart-bars { width: 100%; height: auto; }
.games-rate { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 12px; }

@media (max-width: 600px) {
  .account-content { padding: 1rem; }
  .card-registro { padding: 1.25rem; }
}
</style>

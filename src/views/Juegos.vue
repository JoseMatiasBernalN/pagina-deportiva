<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { addDoc, collection, doc, increment, updateDoc } from 'firebase/firestore'
import GameCard from '../components/GameCard.vue'
import { useAuthStore } from '../stores/auth'
import { db } from '../firebase'

const auth = useAuthStore()
const router = useRouter()
const juegoActivo = ref(null)
const saldoActual = ref(Number(auth.saldo || 0))
const saldoFormateado = computed(() => saldoActual.value.toLocaleString('es-CO'))
const penalEstado = ref('idle')
const penalDireccion = ref('centro')
const arqueroDireccion = ref('izquierda')
const slotGanador = ref(false)
const ruletaGirando = ref(false)
const rotacionRuleta = ref(0)
const dadosGirando = ref(false)
const tiradaDados = ref([2, 5])
const puntosDado = {
  1: [5], 2: [1, 9], 3: [1, 5, 9],
  4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
}
const numerosRuleta = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27]
const juegos = [
  {
    id: 'penal', image: '/imagenes/juego/juego_ Penalty Shootout.webp', alt: 'Penalty',
    title: '⚽ Penalty Shootout', description: 'Elige la dirección del disparo y vence al portero.'
  },
  {
    id: 'slot', image: '/imagenes/juego/Code_Generated_Image.jpg', alt: 'Slots Pro',
    title: '🎰 Slots Pro 3D', description: 'Gira los rodillos y acierta combinaciones ganadoras.',
    buttonStyle: { background: '#d97706' }
  },
  {
    id: 'ruleta', image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=400&auto=format&fit=crop&q=60', alt: 'Ruleta',
    title: '🎡 Ruleta Casino', description: 'Haz girar la rueda y duplica eligiendo color.',
    buttonStyle: { background: '#dc2626' }
  },
  {
    id: 'dados', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&auto=format&fit=crop&q=60', alt: 'Craps',
    title: '🎲 Dados de la Suerte', description: 'Lanza los dados y adivina el resultado de la suma.',
    buttonStyle: { background: '#7c3aed' }
  }
]
let tiempoInactividad
let anguloActual = 0
const limiteInactividad = 10 * 60 * 1000

watch(() => auth.saldo, (saldo) => { saldoActual.value = Number(saldo || 0) })
watch(() => auth.bloqueado, async (bloqueado) => {
  if (bloqueado && auth.logueado) {
    alert('Tu cuenta ha sido suspendida por el administrador.')
    await auth.logout()
    router.replace({ name: 'login' })
  }
})

function reiniciarTemporizador() {
  clearTimeout(tiempoInactividad)
  tiempoInactividad = setTimeout(async () => {
    alert('Tu sesión ha expirado por inactividad (10 minutos). Por seguridad, inicia sesión nuevamente.')
    await auth.logout()
    router.push({ name: 'login' })
  }, limiteInactividad)
}

onMounted(async () => {
  await auth.listo
  if (!auth.logueado) {
    router.replace({ name: 'login' })
    return
  }
  if (auth.bloqueado) {
    alert('Tu cuenta ha sido suspendida por el administrador.')
    await auth.logout()
    router.replace({ name: 'login' })
    return
  }
  saldoActual.value = Number(auth.saldo || 0)
  reiniciarTemporizador()
  for (const evento of ['mousemove', 'keydown', 'click', 'touchstart']) {
    document.addEventListener(evento, reiniciarTemporizador)
  }
})

onUnmounted(() => {
  clearTimeout(tiempoInactividad)
  for (const evento of ['mousemove', 'keydown', 'click', 'touchstart']) {
    document.removeEventListener(evento, reiniciarTemporizador)
  }
})

function abrirJuego(tipo) {
  juegoActivo.value = tipo
  resetearAnimaciones()
}

function volverAlMenu() {
  juegoActivo.value = null
}

function resetearAnimaciones() {
  penalEstado.value = 'idle'
  penalDireccion.value = 'centro'
  arqueroDireccion.value = 'izquierda'
  slotGanador.value = false
  ruletaGirando.value = false
  dadosGirando.value = false
}

function pausa(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function estiloNumeroRuleta(indice) {
  const grados = indice * 30
  return { transform: `rotate(${grados}deg) translateY(-104px) rotate(-${grados}deg)` }
}

async function procesarResultadoJuego(cambio, nombreJuego = 'Minijuego') {
  const nuevoSaldo = saldoActual.value + cambio
  saldoActual.value = nuevoSaldo
  if (!auth.usuario?.uid) return
  try {
    await updateDoc(doc(db, 'usuarios', auth.usuario.uid), { saldo: nuevoSaldo })
    if (cambio < 0) {
      const perdido = Math.abs(cambio)
      await updateDoc(doc(db, 'empresa', 'balance'), { saldoTotal: increment(perdido) })
      await addDoc(collection(db, 'transacciones_empresa'), {
        tipo: 'ingreso',
        monto: perdido,
        descripcion: 'Apuesta perdida en ' + nombreJuego,
        fecha: new Date()
      })
    }
  } catch (error) {
    console.error('Error al sincronizar saldo o ingresos en Firebase:', error)
  }
}

function validarApuesta(valor) {
  if (Number.isNaN(valor) || valor < 5000) {
    alert('La apuesta mínima es de $5.000 COP')
    return false
  }
  if (valor > saldoActual.value) {
    alert('Saldo insuficiente.')
    return false
  }
  return true
}

async function jugarPenal() {
  const btn = document.getElementById('btnPatear')
  const valor = parseInt(document.getElementById('apuestaPenal').value)
  const direccion = document.getElementById('direccionPenal').value
  const resultado = document.getElementById('resultadoPenal')
  if (!validarApuesta(valor)) return
  btn.disabled = true
  resultado.textContent = ''
  resetearAnimaciones()
  penalDireccion.value = direccion
  await procesarResultadoJuego(-valor, 'Penalty Shootout Pro')
  const gano = Math.random() >= 0.5
  arqueroDireccion.value = gano
    ? (direccion === 'izq' ? 'derecha' : 'izquierda')
    : (direccion === 'izq' ? 'izquierda' : direccion === 'der' ? 'derecha' : 'centro')
  penalEstado.value = 'lanzando'
  await pausa(780)
  if (gano) {
    const premio = valor * 2
    await procesarResultadoJuego(premio, 'Penalty Shootout Pro')
    penalEstado.value = 'gol'
    resultado.style.color = '#4ade80'
    resultado.textContent = '¡Gooooool! ⚽🎉 Ganaste $' + premio.toLocaleString('es-CO') + ' COP'
  } else {
    penalEstado.value = 'atajado'
    resultado.style.color = '#f87171'
    resultado.textContent = '¡El portero atajó el balón! 🧤 Perdiste tu apuesta.'
  }
  btn.disabled = false
}

async function jugarSlot() {
  const btn = document.getElementById('btnGirarSlot')
  const valor = parseInt(document.getElementById('apuestaSlot').value)
  const resultado = document.getElementById('resultadoSlot')
  const rodillos = [document.getElementById('slot1'), document.getElementById('slot2'), document.getElementById('slot3')]
  if (!validarApuesta(valor)) return
  btn.disabled = true
  resultado.textContent = ''
  slotGanador.value = false
  rodillos.forEach((r) => r.classList.add('slot-spinning'))
  await procesarResultadoJuego(-valor, 'Slots Pro 3D')
  const simbolos = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣']
  const intervalos = rodillos.map((rodillo) => setInterval(() => {
    rodillo.textContent = simbolos[Math.floor(Math.random() * simbolos.length)]
  }, 65))
  const tirada = []
  for (let indice = 0; indice < rodillos.length; indice++) {
    await pausa(650)
    clearInterval(intervalos[indice])
    tirada.push(simbolos[Math.floor(Math.random() * simbolos.length)])
    rodillos[indice].textContent = tirada[indice]
    rodillos[indice].classList.remove('slot-spinning')
  }
  const [s1, s2, s3] = tirada
  if (s1 === s2 && s2 === s3) {
    const premio = valor * 5
    await procesarResultadoJuego(premio, 'Slots Pro 3D')
    slotGanador.value = true
    resultado.style.color = '#4ade80'
    resultado.textContent = '¡JACKPOT SUPREMO! 🎰 3x ' + s1 + ' | Ganaste $' + premio.toLocaleString('es-CO') + ' COP'
  } else if (s1 === s2 || s2 === s3 || s1 === s3) {
    const premio = valor * 2
    await procesarResultadoJuego(premio, 'Slots Pro 3D')
    slotGanador.value = true
    resultado.style.color = '#4ade80'
    resultado.textContent = '¡Par Ganador! 🌟 Ganaste $' + premio.toLocaleString('es-CO') + ' COP'
  } else {
    resultado.style.color = '#f87171'
    resultado.textContent = 'Sin combinación. ¡Inténtalo de nuevo!'
  }
  btn.disabled = false
}

async function jugarRuleta() {
  const btn = document.getElementById('btnGirarRuleta')
  const valor = parseInt(document.getElementById('apuestaRuleta').value)
  const eleccion = document.getElementById('colorRuleta').value
  const resultado = document.getElementById('resultadoRuleta')
  if (!validarApuesta(valor)) return
  btn.disabled = true
  resultado.textContent = ''
  ruletaGirando.value = true
  await procesarResultadoJuego(-valor, 'Ruleta Casino')
  const esRojo = Math.random() >= 0.5
  const color = esRojo ? 'rojo' : 'negro'
  anguloActual += 1800 + (esRojo ? 45 : 90)
  rotacionRuleta.value = anguloActual
  await pausa(3400)
  ruletaGirando.value = false
  if (eleccion === color) {
    const premio = valor * 2
    await procesarResultadoJuego(premio, 'Ruleta Casino')
    resultado.style.color = '#4ade80'
    resultado.textContent = '¡La bola cayó en ' + color.toUpperCase() + '! 🔴⚫ Ganaste $' + premio.toLocaleString('es-CO') + ' COP'
  } else {
    resultado.style.color = '#f87171'
    resultado.textContent = 'Cayó en ' + color.toUpperCase() + '. Perdiste tu apuesta.'
  }
  btn.disabled = false
}

async function jugarDados() {
  const btn = document.getElementById('btnLanzarDados')
  const valor = parseInt(document.getElementById('apuestaDados').value)
  const prediccion = document.getElementById('prediccionDados').value
  const resultado = document.getElementById('resultadoDados')
  if (!validarApuesta(valor)) return
  btn.disabled = true
  resultado.textContent = ''
  dadosGirando.value = true
  await procesarResultadoJuego(-valor, 'Dados de la Suerte')
  await pausa(1200)
  const d1 = Math.floor(Math.random() * 6) + 1
  const d2 = Math.floor(Math.random() * 6) + 1
  const suma = d1 + d2
  tiradaDados.value = [d1, d2]
  dadosGirando.value = false
  const acierto = (prediccion === 'mayor' && suma > 7) || (prediccion === 'menor' && suma <= 7)
  if (acierto) {
    const premio = valor * 2
    await procesarResultadoJuego(premio, 'Dados de la Suerte')
    resultado.style.color = '#4ade80'
    resultado.textContent = '¡Suma total ' + suma + '! 🎲 Acertaste la predicción. Ganaste $' + premio.toLocaleString('es-CO') + ' COP'
  } else {
    resultado.style.color = '#f87171'
    resultado.textContent = 'Suma total ' + suma + '. No acertaste.'
  }
  btn.disabled = false
}

async function vistaPreviaPenal() {
  const resultado = document.getElementById('resultadoPenal')
  const direccion = penalDireccion.value
  penalEstado.value = 'idle'
  await pausa(50)
  penalDireccion.value = direccion
  const atajada = Math.random() < 0.5
  arqueroDireccion.value = atajada
    ? direccion === 'izq' ? 'izquierda' : direccion === 'der' ? 'derecha' : 'centro'
    : direccion === 'izq' ? 'derecha' : 'izquierda'
  penalEstado.value = 'lanzando'
  await pausa(800)
  penalEstado.value = atajada ? 'atajado' : 'gol'
  resultado.style.color = atajada ? '#f87171' : '#4ade80'
  resultado.textContent = 'Vista previa: animación de ' + (atajada ? 'atajada' : 'gol') + '. No se usó saldo.'
}

async function vistaPreviaSlot() {
  const rodillos = [document.getElementById('slot1'), document.getElementById('slot2'), document.getElementById('slot3')]
  const simbolos = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣']
  const resultado = document.getElementById('resultadoSlot')
  rodillos.forEach((rodillo) => rodillo.classList.add('slot-spinning'))
  const intervalos = rodillos.map((rodillo) => setInterval(() => {
    rodillo.textContent = simbolos[Math.floor(Math.random() * simbolos.length)]
  }, 65))
  for (let indice = 0; indice < rodillos.length; indice++) {
    await pausa(550)
    clearInterval(intervalos[indice])
    rodillos[indice].textContent = simbolos[Math.floor(Math.random() * simbolos.length)]
    rodillos[indice].classList.remove('slot-spinning')
  }
  resultado.style.color = '#fcd34d'
  resultado.textContent = 'Vista previa: giro de demostración. No se usó saldo.'
}

async function vistaPreviaRuleta() {
  ruletaGirando.value = false
  rotacionRuleta.value += 1
  await pausa(50)
  ruletaGirando.value = true
  rotacionRuleta.value += 1440 + Math.floor(Math.random() * 720)
  await pausa(3400)
  ruletaGirando.value = false
  const resultado = document.getElementById('resultadoRuleta')
  resultado.style.color = '#fcd34d'
  resultado.textContent = 'Vista previa: giro de demostración. No se usó saldo.'
}

async function vistaPreviaDados() {
  dadosGirando.value = true
  await pausa(1200)
  tiradaDados.value = [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]
  dadosGirando.value = false
  const resultado = document.getElementById('resultadoDados')
  resultado.style.color = '#c4b5fd'
  resultado.textContent = 'Vista previa: lanzamiento de demostración. No se usó saldo.'
}
</script>

<template>
<main class="seccion-principal casino-page">
    <div class="casino-heading">
      <span class="casino-eyebrow">PLAYEXPERT CASINO</span>
      <h2>Zona Casino Realista</h2>
      <p>La próxima jugada puede cambiarlo todo.</p>
      <div class="balance-chip"><span class="balance-icon">✦</span><span>Saldo Disponible</span><strong id="saldoJuego">${{ saldoFormateado }} COP</strong></div>
    </div>

    <!-- Menú Selección de Juegos -->
    <div id="menuSeleccion" v-show="!juegoActivo" class="grid-juegos">
      <GameCard v-for="game in juegos" :key="game.id" :game="game" @select="abrirJuego" />
    </div>

    <!-- 1. PANTALLA PENALTY -->
    <div id="pantallaPenal" v-show="juegoActivo === 'penal'" class="juego-pantalla">
      <button class="btn-accion btn-volver" @click="volverAlMenu">⬅️ Volver al Menú</button>
      <div class="game-title-row"><span class="game-kicker">01 / PRECISIÓN</span><h3>⚽ Penalty Shootout Pro</h3></div>
      <div class="penalty-stadium">
        <div class="stadium-lights"><i></i><i></i><i></i><i></i></div>
        <div class="stadium-scoreboard"><span>PLAYEXPERT ARENA</span><b>{{ penalEstado === 'gol' ? '¡GOL!' : penalEstado === 'atajado' ? 'ATAJADA' : 'PENALTY' }}</b></div>
        <div class="cancha" :class="[`estado-${penalEstado}`, `disparo-${penalDireccion}`, `arquero-${arqueroDireccion}`]" id="canchaJuego">
          <div class="field-lines"><div class="field-center"></div><div class="field-arc"></div></div>
          <div class="red-arco"><div class="net-pattern"></div><div class="goal-posts"></div></div>
          <div class="arquero" id="elementoArquero">🧤</div>
          <div class="pelota" id="elementoPelota">⚽</div>
          <div v-if="penalEstado === 'gol'" class="goal-burst"><span>GOOOOL</span><i v-for="n in 12" :key="n"></i></div>
        </div>
      </div>
      <div class="controles-juego">
        <label>Monto a Apostar (COP):</label>
        <input type="number" id="apuestaPenal" min="5000" step="1000" placeholder="Mínimo $5.000">
        <label>Dirección del disparo:</label>
        <select id="direccionPenal" v-model="penalDireccion">
          <option value="izq">Izquierda ⬅️</option>
          <option value="centro">Centro ⬆️</option>
          <option value="der">Derecha ➡️</option>
        </select>
        <button class="btn-accion" id="btnPatear" @click="jugarPenal">¡Disparar al Arco!</button>
        <button class="btn-accion btn-demo" @click="vistaPreviaPenal">Ver animación gratis</button>
      </div>
      <p id="resultadoPenal" style="margin-top: 15px; font-weight: bold; font-size: 1.1rem; min-height: 25px;"></p>
    </div>

    <!-- 2. PANTALLA SLOTS -->
    <div id="pantallaSlot" v-show="juegoActivo === 'slot'" class="juego-pantalla">
      <button class="btn-accion btn-volver" @click="volverAlMenu">⬅️ Volver al Menú</button>
      <div class="game-title-row"><span class="game-kicker">02 / AZAR</span><h3>🎰 Slots Pro 3D</h3></div>
      <div class="slot-machine" :class="{ 'slot-machine-winner': slotGanador }">
        <div class="slot-topline"><span>★</span><b>LUCKY SPIN</b><span>★</span></div>
        <div class="slot-lights"><i v-for="n in 18" :key="n"></i></div>
        <div class="slots-box">
          <div class="slot-reel" id="slot1">🍒</div>
          <div class="slot-reel" id="slot2">🍋</div>
          <div class="slot-reel" id="slot3">🔔</div>
        </div>
        <div class="slot-payline">JACKPOT · JACKPOT · JACKPOT</div>
      </div>
      <div class="controles-juego">
        <label>Monto a Apostar (COP):</label>
        <input type="number" id="apuestaSlot" min="5000" step="1000" placeholder="Mínimo $5.000">
        <button class="btn-accion" id="btnGirarSlot" style="background: #d97706;" @click="jugarSlot">¡Girar Rodillos!</button>
        <button class="btn-accion btn-demo" @click="vistaPreviaSlot">Ver animación gratis</button>
      </div>
      <p id="resultadoSlot" style="margin-top: 15px; font-weight: bold; font-size: 1.1rem; min-height: 25px;"></p>
    </div>

    <!-- 3. PANTALLA RULETA -->
    <div id="pantallaRuleta" v-show="juegoActivo === 'ruleta'" class="juego-pantalla">
      <button class="btn-accion btn-volver" @click="volverAlMenu">⬅️ Volver al Menú</button>
      <div class="game-title-row"><span class="game-kicker">03 / RULETA EUROPEA</span><h3>🎡 Ruleta Casino</h3></div>
      <div class="ruleta-container" :class="{ 'ruleta-girando': ruletaGirando }">
        <div class="ruleta-puntero">▼</div>
        <div class="ruleta-rueda" id="ruedaAnimada" :style="{ transform: `rotate(${rotacionRuleta}deg)` }">
          <span v-for="(numero, indice) in numerosRuleta" :key="numero" class="ruleta-numero" :class="{ verde: indice === 0, rojo: indice % 2 === 1 }" :style="estiloNumeroRuleta(indice)">{{ numero }}</span>
          <div class="ruleta-centro">PX</div>
        </div>
        <div class="ruleta-bola"><i></i></div>
      </div>
      <div class="controles-juego">
        <label>Monto a Apostar (COP):</label>
        <input type="number" id="apuestaRuleta" min="5000" step="1000" placeholder="Mínimo $5.000">
        <label>Predicción de Color (Premio x2):</label>
        <select id="colorRuleta">
          <option value="rojo">🔴 Rojo</option>
          <option value="negro">⚫ Negro</option>
        </select>
        <button class="btn-accion" id="btnGirarRuleta" style="background: #dc2626;" @click="jugarRuleta">Girar Rueda</button>
        <button class="btn-accion btn-demo" @click="vistaPreviaRuleta">Ver animación gratis</button>
      </div>
      <p id="resultadoRuleta" style="margin-top: 15px; font-weight: bold; font-size: 1.1rem; min-height: 25px;"></p>
    </div>

    <!-- 4. PANTALLA DADOS -->
    <div id="pantallaDados" v-show="juegoActivo === 'dados'" class="juego-pantalla">
      <button class="btn-accion btn-volver" @click="volverAlMenu">⬅️ Volver al Menú</button>
      <div class="game-title-row"><span class="game-kicker">04 / ALTA O BAJA</span><h3>🎲 Dados de la Suerte</h3></div>
      <div class="dados-mesa" :class="{ 'dados-rodando': dadosGirando }">
        <span class="dice-label">ROLL THE DICE</span>
        <div class="dados-box">
          <div v-for="(valor, indice) in tiradaDados" :key="indice" class="dado" :class="{ 'dado-animando': dadosGirando }" :aria-label="`Dado ${indice + 1}: ${valor}`">
            <i v-for="posicion in 9" :key="posicion" class="punto-dado" :class="{ visible: puntosDado[valor].includes(posicion) }"></i>
          </div>
        </div>
        <div class="dice-table-mark">🎲 &nbsp; PLAYEXPERT &nbsp; 🎲</div>
      </div>
      <div class="controles-juego">
        <label>Monto a Apostar (COP):</label>
        <input type="number" id="apuestaDados" min="5000" step="1000" placeholder="Mínimo $5.000">
        <label>Predicción del resultado:</label>
        <select id="prediccionDados">
          <option value="mayor">Suma Mayor a 7 (Ganas x2)</option>
          <option value="menor">Suma Menor o Igual a 7 (Ganas x2)</option>
        </select>
        <button class="btn-accion" id="btnLanzarDados" style="background: #7c3aed;" @click="jugarDados">Lanzar Dados</button>
        <button class="btn-accion btn-demo" @click="vistaPreviaDados">Ver animación gratis</button>
      </div>
      <p id="resultadoDados" style="margin-top: 15px; font-weight: bold; font-size: 1.1rem; min-height: 25px;"></p>
    </div>
  </main>
</template>

<style scoped>
.casino-page {
  position: relative;
  max-width: 1180px;
  min-height: calc(100vh - 90px);
  margin: 0 auto;
  padding: 36px 22px 64px;
  color: #f8fafc;
  isolation: isolate;
}
.casino-page::before { position: fixed; z-index: -1; inset: 90px 0 0; content: ''; pointer-events: none; background: radial-gradient(ellipse at 50% 0%, rgba(34, 211, 238, .10), transparent 45%), radial-gradient(ellipse at 12% 55%, rgba(124, 58, 237, .12), transparent 34%), radial-gradient(ellipse at 90% 80%, rgba(245, 158, 11, .09), transparent 32%); }
.casino-heading { position: relative; margin: 0 auto 34px; text-align: center; }
.casino-eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #67e8f9; font-size: .72rem; font-weight: 900; letter-spacing: .28em; }
.casino-eyebrow::before, .casino-eyebrow::after { width: 26px; height: 1px; background: linear-gradient(90deg, transparent, #67e8f9); content: ''; }
.casino-eyebrow::after { transform: rotate(180deg); }
.casino-heading h2 { margin: 8px 0 3px; color: #fff; font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 950; letter-spacing: -.05em; text-shadow: 0 0 30px rgba(34, 211, 238, .32); }
.casino-heading p { margin: 0; color: #94a3b8; }
.balance-chip { display: inline-flex; align-items: center; gap: 10px; margin-top: 19px; padding: 10px 17px; border: 1px solid rgba(52, 211, 153, .3); border-radius: 999px; background: rgba(2, 15, 31, .72); box-shadow: 0 0 24px rgba(16, 185, 129, .12), inset 0 0 18px rgba(16, 185, 129, .06); color: #a7f3d0; font-size: .84rem; }
.balance-icon { color: #fbbf24; font-size: 1.1rem; }
.balance-chip strong { color: #fff; font-size: 1rem; letter-spacing: .03em; }
.grid-juegos { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 22px; margin: 0 auto; }
.juego-pantalla { position: relative; overflow: hidden; max-width: 780px; margin: 0 auto; padding: clamp(18px, 4vw, 34px); border: 1px solid rgba(148, 163, 184, .18); border-radius: 25px; background: linear-gradient(145deg, rgba(15, 23, 42, .98), rgba(5, 12, 26, .98)); box-shadow: 0 30px 90px rgba(0, 0, 0, .55), 0 0 40px rgba(34, 211, 238, .08); text-align: center; }
.juego-pantalla::before { position: absolute; top: -130px; right: -120px; width: 300px; height: 300px; border-radius: 50%; background: radial-gradient(circle, rgba(34, 211, 238, .11), transparent 68%); content: ''; pointer-events: none; }
.game-title-row { position: relative; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 5px 0 22px; text-align: left; }
.game-title-row h3 { margin: 0; color: #fff; font-size: clamp(1.35rem, 4vw, 1.8rem); font-weight: 900; letter-spacing: -.03em; }
.game-kicker { color: #64748b; font-size: .68rem; font-weight: 800; letter-spacing: .18em; white-space: nowrap; }
.btn-accion { width: 100%; padding: 13px 22px; border: 1px solid rgba(255, 255, 255, .12); border-radius: 12px; background: linear-gradient(135deg, #16a34a, #059669); color: #fff; font-size: .95rem; font-weight: 900; letter-spacing: .02em; cursor: pointer; transition: transform .2s ease, filter .2s ease, box-shadow .2s ease; box-shadow: 0 8px 22px rgba(16, 185, 129, .22); }
.btn-accion:hover { transform: translateY(-2px); filter: brightness(1.12); box-shadow: 0 12px 28px rgba(16, 185, 129, .3); }
.btn-accion:active { transform: translateY(1px) scale(.99); }
.btn-accion:disabled { background: #475569; cursor: wait; filter: grayscale(.3); box-shadow: none; }
.btn-volver { display: inline-flex; align-items: center; gap: 8px; width: auto; margin: 0 auto 12px 0; padding: 9px 14px; border-color: rgba(148, 163, 184, .2); background: rgba(51, 65, 85, .75); color: #cbd5e1; font-size: .8rem; box-shadow: none; }
.btn-volver:hover { background: #475569; }
.btn-demo { border-color: rgba(103, 232, 249, .42); background: linear-gradient(135deg, #164e63, #155e75); color: #cffafe; box-shadow: 0 0 22px rgba(34, 211, 238, .16); }
.btn-demo:hover { background: linear-gradient(135deg, #0e7490, #0891b2); box-shadow: 0 0 30px rgba(34, 211, 238, .35); }
.controles-juego { position: relative; display: grid; grid-template-columns: 1fr 1fr; align-items: end; gap: 12px 16px; margin: 20px auto 0; text-align: left; }
.controles-juego label { display: block; align-self: end; color: #cbd5e1; font-size: .8rem; font-weight: 800; }
.controles-juego input, .controles-juego select { width: 100%; min-height: 46px; padding: 11px 13px; border: 1px solid #334155; border-radius: 10px; outline: none; background: #101d31; color: #f8fafc; font-size: .95rem; transition: border-color .2s, box-shadow .2s; }
.controles-juego input:focus, .controles-juego select:focus { border-color: #22d3ee; box-shadow: 0 0 0 3px rgba(34, 211, 238, .12); }
.controles-juego button { grid-column: 1 / -1; }
.juego-pantalla > p[id^='resultado'] { position: relative; min-height: 30px; margin: 18px 0 0; font-size: 1rem; font-weight: 900; text-shadow: 0 0 18px currentColor; }

/* Penales: estadio, césped en perspectiva, red y remate animado. */
.penalty-stadium { position: relative; overflow: hidden; padding: 22px 16px 16px; border: 1px solid rgba(125, 211, 252, .22); border-radius: 20px; background: radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, .2), transparent 58%), linear-gradient(180deg, #07172b, #10233a); box-shadow: inset 0 0 45px rgba(2, 6, 23, .55); }
.stadium-lights { position: absolute; top: 10px; left: 7%; right: 7%; display: flex; justify-content: space-between; }
.stadium-lights i { width: 56px; height: 14px; border-radius: 50%; background: #e0f2fe; box-shadow: 0 0 12px #7dd3fc, 0 0 30px rgba(56, 189, 248, .8); opacity: .8; }
.stadium-lights i { animation: foco-estadio 1.4s ease-in-out infinite alternate; }
.stadium-lights i:nth-child(even) { animation-delay: .45s; }
.stadium-scoreboard { position: relative; display: flex; justify-content: space-between; max-width: 560px; margin: 3px auto 13px; color: #93c5fd; font-size: .66rem; font-weight: 900; letter-spacing: .17em; }
.stadium-scoreboard b { color: #fbbf24; }
.cancha { position: relative; height: clamp(235px, 38vw, 310px); overflow: hidden; border: 2px solid rgba(255, 255, 255, .8); border-radius: 18px; background: repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 2px, transparent 2px 24px), linear-gradient(180deg, #16784a 0%, #0b653f 45%, #087044 100%); box-shadow: inset 0 -25px 45px rgba(2, 44, 34, .38), 0 14px 30px rgba(0, 0, 0, .38); perspective: 650px; }
.cancha::after { position: absolute; right: 0; bottom: 0; left: 0; height: 40%; background: linear-gradient(0deg, rgba(2, 6, 23, .27), transparent); content: ''; pointer-events: none; }
.field-lines { position: absolute; inset: 0; opacity: .4; }
.field-center { position: absolute; bottom: -55%; left: 50%; width: 54%; aspect-ratio: 1; border: 2px solid rgba(255, 255, 255, .72); border-radius: 50%; transform: translateX(-50%); }
.field-arc { position: absolute; top: 101px; left: 50%; width: 35%; height: 54px; border: 2px solid rgba(255,255,255,.75); border-bottom: 0; border-radius: 50% 50% 0 0; transform: translateX(-50%); }
.red-arco { position: absolute; z-index: 1; top: 28px; left: 50%; width: min(44%, 300px); height: 104px; border: 7px solid #f8fafc; border-bottom: 0; border-radius: 10px 10px 0 0; background: repeating-linear-gradient(0deg, transparent 0 12px, rgba(255,255,255,.24) 12px 14px), repeating-linear-gradient(90deg, transparent 0 14px, rgba(255,255,255,.2) 14px 16px), linear-gradient(180deg, rgba(2,6,23,.28), rgba(255,255,255,.06)); box-shadow: 0 0 20px rgba(255,255,255,.28); transform: translateX(-50%); }
.net-pattern { position: absolute; inset: 0; background: repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,.12) 12px 13px); }
.goal-posts { position: absolute; right: -7px; bottom: -5px; left: -7px; height: 7px; border-radius: 5px; background: #fff; box-shadow: 0 0 14px #fff; }
.arquero { position: absolute; z-index: 3; top: 83px; left: 50%; font-size: clamp(2.7rem, 6vw, 4rem); filter: drop-shadow(0 9px 5px rgba(0,0,0,.45)); transform: translateX(-50%); }
.pelota { position: absolute; z-index: 4; bottom: 22px; left: 50%; font-size: 2rem; filter: drop-shadow(0 8px 4px rgba(0,0,0,.45)); transform: translateX(-50%); }
.cancha:not(.estado-lanzando):not(.estado-gol):not(.estado-atajado) .pelota { animation: pelota-espera 1.15s ease-in-out infinite; }
.cancha:not(.estado-lanzando):not(.estado-gol):not(.estado-atajado) .arquero { animation: arquero-espera 1.8s ease-in-out infinite alternate; }
.cancha.estado-lanzando.disparo-izq .pelota { animation: disparo-izquierda .75s cubic-bezier(.2,.8,.3,1) forwards; }
.cancha.estado-lanzando.disparo-centro .pelota { animation: disparo-centro .75s cubic-bezier(.2,.8,.3,1) forwards; }
.cancha.estado-lanzando.disparo-der .pelota { animation: disparo-derecha .75s cubic-bezier(.2,.8,.3,1) forwards; }
.cancha.estado-lanzando.arquero-izquierda .arquero { animation: vuelo-izquierda .68s cubic-bezier(.2,.8,.3,1) forwards; }
.cancha.estado-lanzando.arquero-centro .arquero { animation: vuelo-centro .68s ease-out forwards; }
.cancha.estado-lanzando.arquero-derecha .arquero { animation: vuelo-derecha .68s cubic-bezier(.2,.8,.3,1) forwards; }
.cancha.estado-gol.disparo-izq .pelota, .cancha.estado-atajado.disparo-izq .pelota { bottom: 188px; left: 23%; }
.cancha.estado-gol.disparo-centro .pelota, .cancha.estado-atajado.disparo-centro .pelota { bottom: 195px; left: 50%; }
.cancha.estado-gol.disparo-der .pelota, .cancha.estado-atajado.disparo-der .pelota { bottom: 188px; left: 77%; }
.cancha.estado-gol.arquero-izquierda .arquero, .cancha.estado-atajado.arquero-izquierda .arquero { left: 24%; transform: translateX(-50%) rotate(-30deg) scale(1.25); }
.cancha.estado-gol.arquero-derecha .arquero, .cancha.estado-atajado.arquero-derecha .arquero { left: 76%; transform: translateX(-50%) rotate(30deg) scale(1.25); }
.goal-burst { position: absolute; z-index: 5; inset: 0; display: grid; place-items: center; pointer-events: none; }
.goal-burst span { color: #fff; font-size: clamp(2.6rem, 8vw, 5rem); font-weight: 1000; font-style: italic; letter-spacing: .08em; text-shadow: 0 0 10px #fbbf24, 0 0 32px #f97316, 0 8px 0 rgba(127,29,29,.6); animation: gol-impacto .5s cubic-bezier(.2,1.6,.4,1) both; }
.goal-burst i { position: absolute; width: 8px; height: 24px; border-radius: 5px; background: hsl(calc(var(--n) * 31), 95%, 60%); animation: confeti .9s ease-out both; }
.goal-burst i:nth-of-type(1) { --n: 1; left: 15%; top: 28%; } .goal-burst i:nth-of-type(2) { --n: 2; left: 23%; top: 18%; } .goal-burst i:nth-of-type(3) { --n: 3; left: 31%; top: 35%; } .goal-burst i:nth-of-type(4) { --n: 4; left: 39%; top: 20%; } .goal-burst i:nth-of-type(5) { --n: 5; left: 47%; top: 30%; } .goal-burst i:nth-of-type(6) { --n: 6; left: 55%; top: 16%; } .goal-burst i:nth-of-type(7) { --n: 7; left: 63%; top: 34%; } .goal-burst i:nth-of-type(8) { --n: 8; left: 71%; top: 20%; } .goal-burst i:nth-of-type(9) { --n: 9; left: 79%; top: 32%; } .goal-burst i:nth-of-type(10) { --n: 10; left: 87%; top: 19%; } .goal-burst i:nth-of-type(11) { --n: 11; left: 18%; top: 55%; } .goal-burst i:nth-of-type(12) { --n: 12; left: 82%; top: 53%; }
@keyframes disparo-izquierda { 0% { bottom: 20px; left: 50%; transform: translateX(-50%) scale(1); } 65% { bottom: 145px; left: 25%; transform: translateX(-50%) scale(1.35) rotate(420deg); } 100% { bottom: 188px; left: 23%; transform: translateX(-50%) scale(.85) rotate(720deg); } }
@keyframes disparo-centro { 0% { bottom: 20px; left: 50%; transform: translateX(-50%) scale(1); } 70% { bottom: 150px; left: 50%; transform: translateX(-50%) scale(1.4) rotate(500deg); } 100% { bottom: 195px; left: 50%; transform: translateX(-50%) scale(.85) rotate(720deg); } }
@keyframes disparo-derecha { 0% { bottom: 20px; left: 50%; transform: translateX(-50%) scale(1); } 65% { bottom: 145px; left: 75%; transform: translateX(-50%) scale(1.35) rotate(420deg); } 100% { bottom: 188px; left: 77%; transform: translateX(-50%) scale(.85) rotate(720deg); } }
@keyframes vuelo-izquierda { 0% { left: 50%; transform: translateX(-50%) scale(1); } 65% { left: 22%; transform: translateX(-50%) rotate(-45deg) scale(1.35); } 100% { left: 24%; transform: translateX(-50%) rotate(-35deg) scale(1.2); } }
@keyframes vuelo-centro { 0%,100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) translateY(-12px) scale(1.2); } }
@keyframes vuelo-derecha { 0% { left: 50%; transform: translateX(-50%) scale(1); } 65% { left: 78%; transform: translateX(-50%) rotate(45deg) scale(1.35); } 100% { left: 76%; transform: translateX(-50%) rotate(35deg) scale(1.2); } }
@keyframes gol-impacto { 0% { opacity: 0; transform: scale(.2) rotate(-12deg); } 70% { opacity: 1; transform: scale(1.18) rotate(4deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes confeti { 0% { opacity: 0; transform: translateY(-35px) rotate(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(190px) rotate(500deg); } }

/* Tragamonedas con rodillos independientes, brillo y secuencia escalonada. */
.slot-machine { position: relative; max-width: 510px; margin: 0 auto; padding: 18px 22px 16px; border: 3px solid #f59e0b; border-radius: 25px; background: linear-gradient(145deg, #7c2d12, #451a03 55%, #1c0a05); box-shadow: 0 0 0 5px #451a03, 0 0 35px rgba(245, 158, 11, .36), inset 0 0 30px rgba(0,0,0,.6); }
.slot-machine-winner { animation: jackpot-flash .6s ease-in-out 3; }
.slot-topline { display: flex; align-items: center; justify-content: center; gap: 12px; color: #fde68a; font-size: .72rem; letter-spacing: .32em; text-shadow: 0 0 12px #f59e0b; }
.slot-topline span { color: #fff7ae; font-size: 1.2rem; animation: star-twinkle 1s ease-in-out infinite alternate; }
.slot-lights { display: flex; justify-content: space-around; margin: 12px 0 7px; }
.slot-lights i { width: 9px; height: 9px; border-radius: 50%; background: #fde68a; box-shadow: 0 0 10px #fbbf24; animation: light-chase .65s ease-in-out infinite alternate; }
.slot-lights i:nth-child(even) { animation-delay: .3s; }
.slots-box { display: flex; justify-content: center; gap: clamp(8px, 3vw, 18px); padding: 20px 12px; border: 5px ridge #fbbf24; border-radius: 15px; background: linear-gradient(180deg, #0b1020, #263349 48%, #0b1020); box-shadow: inset 0 0 28px #000, 0 0 18px rgba(251,191,36,.26); }
.slot-reel { position: relative; display: grid; width: clamp(72px, 19vw, 112px); height: clamp(82px, 22vw, 124px); place-items: center; overflow: hidden; border: 3px solid #cbd5e1; border-radius: 14px; background: linear-gradient(110deg, #fff, #e2e8f0 35%, #fff 65%, #94a3b8); color: #111827; font-size: clamp(3rem, 8vw, 4.4rem); text-shadow: 0 3px 0 #cbd5e1, 0 8px 15px rgba(0,0,0,.3); box-shadow: inset 0 0 18px rgba(15,23,42,.22), 0 8px 15px rgba(0,0,0,.35); }
.slot-reel:not(.slot-spinning) { animation: reel-idle 1.6s ease-in-out infinite alternate; }
.slot-reel:nth-child(2) { animation-delay: .25s; }
.slot-reel:nth-child(3) { animation-delay: .5s; }
.slot-reel::after { position: absolute; right: 0; left: 0; height: 2px; background: rgba(255,255,255,.78); box-shadow: 0 -4px 0 rgba(15,23,42,.08), 0 4px 0 rgba(15,23,42,.08); content: ''; }
.slot-spinning { animation: reel-shake .11s linear infinite; filter: blur(.7px) saturate(1.4); }
.slot-payline { margin-top: 10px; color: #fcd34d; font-size: .6rem; font-weight: 900; letter-spacing: .32em; text-align: center; }
@keyframes reel-shake { 0% { transform: translateY(-9px); } 50% { transform: translateY(9px); } 100% { transform: translateY(-9px); } }
@keyframes jackpot-flash { 50% { filter: brightness(1.7); box-shadow: 0 0 0 5px #fef3c7, 0 0 65px #fbbf24; } }
@keyframes star-twinkle { to { opacity: .35; transform: scale(.75) rotate(25deg); } }
@keyframes light-chase { to { opacity: .25; transform: scale(.72); } }

/* Ruleta con sectores, marcadores y bola orbital. */
.ruleta-container { position: relative; display: grid; width: min(310px, 78vw); aspect-ratio: 1; margin: 0 auto 20px; place-items: center; filter: drop-shadow(0 18px 22px rgba(0,0,0,.48)); }
.ruleta-container::before { position: absolute; inset: 0; border: 8px solid #fbbf24; border-radius: 50%; background: repeating-conic-gradient(#fbbf24 0deg 2deg, #7c2d12 2deg 30deg); box-shadow: 0 0 0 4px #451a03, inset 0 0 14px #000; content: ''; }
.ruleta-rueda { position: absolute; inset: 15px; overflow: hidden; border: 6px solid #fcd34d; border-radius: 50%; background: conic-gradient(#15803d 0deg 30deg, #b91c1c 30deg 60deg, #111827 60deg 90deg, #b91c1c 90deg 120deg, #111827 120deg 150deg, #b91c1c 150deg 180deg, #111827 180deg 210deg, #b91c1c 210deg 240deg, #111827 240deg 270deg, #b91c1c 270deg 300deg, #111827 300deg 330deg, #b91c1c 330deg 360deg); box-shadow: inset 0 0 18px #000, 0 0 18px rgba(0,0,0,.75); transition: transform 3.4s cubic-bezier(.08,.78,.15,1); }
.ruleta-rueda::before { position: absolute; inset: 0; border-radius: 50%; background: repeating-conic-gradient(from 0deg, transparent 0deg 29deg, rgba(253,230,138,.85) 29deg 30deg); content: ''; }
.ruleta-numero { position: absolute; top: 50%; left: 50%; z-index: 1; width: 23px; margin: -10px 0 0 -11px; color: #fff; font-size: .6rem; font-weight: 900; text-align: center; text-shadow: 0 1px 2px #000; }
.ruleta-numero.verde { color: #bbf7d0; }
.ruleta-centro { position: absolute; top: 50%; left: 50%; z-index: 2; display: grid; width: 70px; aspect-ratio: 1; place-items: center; border: 5px ridge #fcd34d; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #1e293b, #020617 70%); color: #fef3c7; font-size: 1.3rem; font-weight: 1000; box-shadow: 0 0 20px rgba(251,191,36,.48); transform: translate(-50%,-50%); }
.ruleta-puntero { position: absolute; top: -4px; left: 50%; z-index: 5; color: #fff7ae; font-size: 2rem; text-shadow: 0 0 12px #f59e0b, 0 2px 5px #000; transform: translateX(-50%); }
.ruleta-bola { position: absolute; z-index: 4; inset: 9px; border-radius: 50%; pointer-events: none; }
.ruleta-bola { animation: bola-espera 5s linear infinite; }
.ruleta-bola i { position: absolute; top: 2px; left: 50%; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #cbd5e1 55%, #475569); box-shadow: 0 0 12px #fff; transform: translateX(-50%); }
.ruleta-girando .ruleta-bola { animation: bola-orbital 3.4s cubic-bezier(.1,.75,.15,1) both; }
@keyframes bola-orbital { 0% { transform: rotate(0) scale(1); } 70% { transform: rotate(1450deg) scale(1); } 100% { transform: rotate(1800deg) scale(.9); } }

/* Dados estilo mesa de casino, con puntos que representan cada cara. */
.dados-mesa { position: relative; max-width: 480px; margin: 0 auto; padding: 25px; overflow: hidden; border: 1px solid rgba(167,139,250,.35); border-radius: 24px; background: radial-gradient(ellipse at center, #183c37, #082c2b 70%); box-shadow: inset 0 0 32px rgba(0,0,0,.55), 0 15px 35px rgba(0,0,0,.32); }
.dados-mesa::before { position: absolute; inset: 12px; border: 1px solid rgba(167,139,250,.14); border-radius: 18px; content: ''; pointer-events: none; }
.dice-label { position: relative; color: #c4b5fd; font-size: .65rem; font-weight: 900; letter-spacing: .32em; }
.dados-box { position: relative; display: flex; justify-content: center; gap: clamp(22px, 7vw, 48px); padding: 25px 0; perspective: 700px; }
.dado { display: grid; width: clamp(76px, 19vw, 104px); aspect-ratio: 1; grid-template: repeat(3, 1fr) / repeat(3, 1fr); gap: 5px; padding: 14px; border: 1px solid #fff; border-radius: 18px; background: linear-gradient(145deg, #fff, #dbeafe 60%, #94a3b8); box-shadow: 0 16px 25px rgba(0,0,0,.44), inset 0 1px 4px #fff; animation: dado-espera 1.5s ease-in-out infinite alternate; }
.punto-dado { align-self: center; justify-self: center; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #475569, #020617 70%); opacity: 0; transform: scale(.4); }
.punto-dado.visible { opacity: 1; transform: scale(1); }
.dado-animando { animation: dado-lanzado .32s ease-in-out infinite alternate; }
.dado-animando:nth-child(2) { animation-delay: .12s; }
.dados-rodando .dado { box-shadow: 0 0 25px rgba(196,181,253,.55), 0 16px 25px rgba(0,0,0,.44); }
.dice-table-mark { position: relative; color: rgba(196,181,253,.6); font-size: .62rem; font-weight: 900; letter-spacing: .25em; }
@keyframes dado-lanzado { 0% { transform: translateY(-7px) rotate(-14deg) scale(.94); } 100% { transform: translateY(7px) rotate(14deg) scale(1.04); } }
@keyframes pelota-espera { 0%,100% { transform: translateX(-50%) translateY(0) rotate(-8deg); } 50% { transform: translateX(-50%) translateY(-15px) rotate(18deg); } }
@keyframes arquero-espera { from { transform: translateX(-50%) translateY(0) rotate(-3deg); } to { transform: translateX(-50%) translateY(-7px) rotate(3deg); } }
@keyframes foco-estadio { from { opacity: .45; filter: brightness(.75); } to { opacity: 1; filter: brightness(1.5); } }
@keyframes reel-idle { from { transform: translateY(0) rotate(-1deg); } to { transform: translateY(-7px) rotate(1deg); } }
@keyframes bola-espera { to { transform: rotate(360deg); } }
@keyframes dado-espera { from { transform: translateY(3px) rotate(-4deg); } to { transform: translateY(-7px) rotate(4deg); } }

@media (max-width: 640px) {
  .casino-page { padding: 25px 14px 45px; }
  .casino-heading { margin-bottom: 24px; }
  .balance-chip { gap: 7px; padding: 9px 12px; font-size: .72rem; }
  .balance-chip strong { font-size: .82rem; }
  .juego-pantalla { border-radius: 19px; padding: 16px; }
  .game-title-row { align-items: flex-start; flex-direction: column; gap: 4px; margin-bottom: 16px; }
  .penalty-stadium { padding: 22px 9px 10px; }
  .stadium-lights i { width: 34px; height: 9px; }
  .controles-juego { grid-template-columns: 1fr; gap: 8px; }
  .controles-juego button { grid-column: auto; margin-top: 5px; }
  .slot-machine { padding: 14px 10px; }
  .ruleta-container { width: min(280px, 76vw); }
  .ruleta-numero { font-size: .52rem; }
  .ruleta-centro { width: 58px; }
  .dados-mesa { padding: 20px 12px; }
}

</style>

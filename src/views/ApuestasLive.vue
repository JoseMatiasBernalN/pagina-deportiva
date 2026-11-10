<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, addDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth'
import { db } from '../firebase'
import { footballApi, basketballApi } from '../services/sportsApi'

const auth = useAuthStore()
const partidos = ref([])
const cargando = ref(true)
const errorCarga = ref(false)
const carrito = ref([])
const monto = ref('')
const carritoAbierto = ref(false)
const enviando = ref(false)
const notificaciones = ref([])
const relojCuotas = ref(Date.now())
const actualizandoCuotas = ref(false)
let unsubscribe
let freshnessTimer
let secuenciaToast = 0

const saldo = computed(() => Number(auth.saldo || 0))
const cuotaTotal = computed(() => carrito.value.length ? carrito.value.reduce((total, item) => total * item.cuota, 1) : 0)
const montoNumero = computed(() => Number(monto.value) || 0)
const gananciaPotencial = computed(() => montoNumero.value * cuotaTotal.value)
const formatCOP = (value) => '$' + Number(value || 0).toLocaleString('es-CO') + ' COP'

onMounted(() => {
  cargarPartidosEnVivo()
  freshnessTimer = setInterval(() => { relojCuotas.value = Date.now() }, 15_000)
})
onUnmounted(() => { unsubscribe?.(); clearInterval(freshnessTimer) })

function notificar(tipo, texto) {
  const id = ++secuenciaToast
  notificaciones.value.push({ id, tipo, texto })
  setTimeout(() => { notificaciones.value = notificaciones.value.filter((toast) => toast.id !== id) }, 4200)
}

function claveSeleccion(partido, tipo) { return `${partido.id}:${tipo}` }
function mercado(partido) { return partido.mercado || partido.tipoMercado || 'Resultado del partido' }
function campoCuota(tipo) { return tipo === 'local' ? 'cLocal' : tipo === 'visitante' ? 'cVisitante' : 'cEmpate' }
function cuotaFresca(partido) {
  if (partido.origen !== 'api') return !partido.cuotasVigentesHasta || new Date(partido.cuotasVigentesHasta?.toDate?.() || partido.cuotasVigentesHasta).getTime() > relojCuotas.value
  const expires = partido.cuotasVigentesHasta?.toDate ? partido.cuotasVigentesHasta.toDate().getTime() : new Date(partido.cuotasVigentesHasta || 0).getTime()
  return partido.cuotasEstado === 'disponibles' && expires > relojCuotas.value
}
function cuotaValor(partido, tipo) {
  const value = Number(partido[campoCuota(tipo)])
  return cuotaFresca(partido) && Number.isFinite(value) && value > 1 ? value : null
}
function normalizarTexto(valor) { return String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') }
function leerMercadoCuota(row, deporte) {
  const bookmakers = row.bookmakers?.length
    ? row.bookmakers.map((bookmaker) => ({ casa: bookmaker.name, mercados: bookmaker.bets || [] }))
    : [{ casa: row.bookmaker?.name || row.bookmaker, mercados: row.odds || [] }]
  for (const bookmaker of bookmakers) {
    for (const market of bookmaker.mercados) {
      const nombre = String(market.name || '').toLowerCase()
      if (deporte === 'futbol' ? !/match winner|match result|1x2|full time result/.test(nombre) : !/home\/away|winner|moneyline/.test(nombre)) continue
      const valor = (opciones) => {
        const item = (market.values || []).find((entry) => opciones.includes(normalizarTexto(entry.value)) && entry.suspended !== true)
        const odd = Number(item?.odd)
        return Number.isFinite(odd) && odd > 1 ? odd : null
      }
      const local = valor(['home', 'local', '1'])
      const empate = deporte === 'futbol' ? valor(['draw', 'tie', 'empate', 'x']) : null
      const visitante = valor(['away', 'visitor', 'visitante', '2'])
      if (local || empate || visitante) return { cLocal: local, cEmpate: empate, cVisitante: visitante, cuotasCasa: bookmaker.casa || 'Casa no especificada', cuotasMercado: market.name, cuotasEstado: 'disponibles' }
    }
  }
  return null
}
function aplicarCuotas(partidosActualizados) {
  for (const item of carrito.value) {
    const partido = partidosActualizados.find((actual) => actual.id === item.partidoId)
    if (!partido || suspendido(partido, item.tipo)) {
      item.suspendido = true
      continue
    }
    const nuevaCuota = cuotaValor(partido, item.tipo)
    if (nuevaCuota === null) { item.suspendido = true; continue }
    if (item.cuota !== nuevaCuota) {
      const notificarCambio = !item.requiereAceptacion || item.cuotaPendiente !== nuevaCuota
      item.cuotaPendiente = nuevaCuota
      item.requiereAceptacion = true
      item.proveedorCuotaPendiente = partido.cuotasProveedor || item.proveedorCuota
      item.casaCuotaPendiente = partido.cuotasCasa || item.casaCuota
      item.mercadoPendiente = partido.cuotasMercado || item.mercado
      item.cuotasActualizadasPendiente = partido.cuotasActualizadasEn || null
      if (notificarCambio) notificar('cuota', `La cuota cambió de ${item.cuota.toFixed(2)} a ${nuevaCuota.toFixed(2)}. Acepta el nuevo valor para continuar.`)
    } else {
      item.cuotasActualizadasEn = partido.cuotasActualizadasEn || null
      item.proveedorCuota = partido.cuotasProveedor || item.proveedorCuota
      item.casaCuota = partido.cuotasCasa || item.casaCuota
      item.mercado = partido.cuotasMercado || item.mercado
    }
    item.suspendido = false
  }
}

async function actualizarCuotas() {
  if (actualizandoCuotas.value || !partidos.value.length) return
  actualizandoCuotas.value = true
  try {
    const API = new Map()
    const footballLive = partidos.value.filter((partido) => partido.deporte === 'futbol' && partido.proveedor === 'api-football' && partido.estado === 'en_vivo')
    const footballUpcoming = partidos.value.filter((partido) => partido.deporte === 'futbol' && partido.proveedor === 'api-football' && partido.estado === 'programado')
    if (footballLive.length) {
      const rows = await footballApi.liveOdds()
      for (const row of rows) if (row.fixture?.id) API.set(`futbol:${row.fixture.id}`, { row, live: true })
    }
    // Pre-match odds update every 3 hours. One date query (first provider page)
    // is used per date to avoid one request per fixture.
    const footballDates = [...new Set(footballUpcoming.map((partido) => {
      const fecha = partido.fecha?.toDate ? partido.fecha.toDate() : new Date(partido.fecha || 0)
      return Number.isFinite(fecha.getTime()) ? fecha.toISOString().slice(0, 10) : null
    }).filter(Boolean))].slice(0, 2)
    for (const date of footballDates) {
      const rows = await footballApi.odds({ date })
      for (const row of rows) if (row.fixture?.id) API.set(`futbol:${row.fixture.id}`, { row, live: false })
    }
    const basketballMatches = partidos.value.filter((partido) => partido.deporte === 'baloncesto' && ['api-ninjas', 'api-sports-basketball'].includes(partido.proveedor) && partido.estado === 'programado')
    // API-Ninjas IDs differ from API-Basketball IDs. Match exact teams and
    // kickoff first; if there is no safe match, leave the quote unavailable.
    const basketballDates = [...new Set(basketballMatches.filter((partido) => partido.proveedor === 'api-ninjas').map((partido) => {
      const fecha = partido.fecha?.toDate ? partido.fecha.toDate() : new Date(partido.fecha || 0)
      return Number.isFinite(fecha.getTime()) ? fecha.toISOString().slice(0, 10) : null
    }).filter(Boolean))].slice(0, 2)
    const basketballGames = (await Promise.all(basketballDates.map((date) => basketballApi.games({ date })))).flat()
    let basketballOddsCount = 0
    for (const partido of basketballMatches) {
      if (basketballOddsCount >= 5) break
      if (partido.proveedor === 'api-sports-basketball' && partido.apiBasketballGameId) {
        const rows = await basketballApi.odds({ game: partido.apiBasketballGameId })
        if (rows[0]) API.set(`baloncesto:${partido.id}`, { row: rows[0], live: false })
        basketballOddsCount += 1
        continue
      }
      const fecha = partido.fecha?.toDate ? partido.fecha.toDate().getTime() : new Date(partido.fecha || 0).getTime()
      const match = basketballGames.find((entry) => {
        const game = entry.game || {}
        const teams = entry.teams || {}
        const kickoff = game.timestamp ? Number(game.timestamp) * 1000 : new Date(game.date || 0).getTime()
        return normalizarTexto(partido.local) === normalizarTexto(teams.home?.name)
          && normalizarTexto(partido.visitante) === normalizarTexto(teams.away?.name)
          && Number.isFinite(fecha) && Number.isFinite(kickoff) && Math.abs(fecha - kickoff) <= 6 * 60 * 60_000
      })
      const gameId = match?.game?.id
      if (!gameId) continue
      const rows = await basketballApi.odds({ game: gameId })
      if (rows[0]) API.set(`baloncesto:${partido.id}`, { row: rows[0], live: false })
      basketballOddsCount += 1
    }
    const updated = partidos.value.map((partido) => {
      const fixtureId = partido.providerId || partido.id.replace(/^api_football_/, '')
      const result = partido.deporte === 'futbol'
        ? API.get(`futbol:${fixtureId}`)
        : API.get(`baloncesto:${partido.id}`)
      const odds = result && leerMercadoCuota(result.row, partido.deporte)
      if (!odds) {
        if (partido.origen !== 'api') return partido
        return { ...partido, cLocal: null, cEmpate: null, cVisitante: null, cuotasEstado: 'no_disponibles', cuotasVigentesHasta: null }
      }
      const bloqueada = result.live && (result.row.status?.blocked || result.row.status?.stopped || result.row.status?.finished)
      return { ...partido, ...odds, cuotasProveedor: partido.deporte === 'futbol' ? 'API-Football' : 'API-Basketball', cuotasTipo: result.live ? 'live' : 'pre-match', cuotasEstado: bloqueada ? 'bloqueadas' : odds.cuotasEstado, cuotasActualizadasEn: result.row.update ? new Date(result.row.update) : new Date(), cuotasVigentesHasta: new Date(Date.now() + (result.live ? 70 : 240) * 60_000) }
    })
    partidos.value = updated
    aplicarCuotas(updated)
    const conCuota = updated.filter((partido) => partido.cuotasEstado === 'disponibles').length
    notificar(conCuota ? 'success' : 'info', conCuota ? `Cuotas reales actualizadas para ${conCuota} partido(s).` : 'El proveedor no ofrece cuotas vigentes para los partidos cargados.')
  } catch (error) {
    console.error('Error al actualizar cuotas:', error)
    notificar('error', error.message || 'No se pudieron consultar las cuotas. Revisa conexión, clave y cuota de API.')
  } finally { actualizandoCuotas.value = false }
}
function fechaCuota(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('es-CO') : 'Fecha no disponible'
}
function competicion(partido) { return partido.competicion || partido.competencia || partido.liga || 'Competición no especificada' }
function suspendido(partido, tipo) {
  return ['suspendido', 'suspended', 'finalizado', 'cancelado', 'aplazado'].includes(String(partido.estado || '').toLowerCase()) || cuotaValor(partido, tipo) === null || (partido.deporte === 'baloncesto' && partido.estado === 'en_vivo')
}
function seleccionActualDisponible(item) {
  const partido = partidos.value.find((match) => match.id === item.partidoId)
  return !!partido && !suspendido(partido, item.tipo) && cuotaValor(partido, item.tipo) === item.cuota
}

function estadoPartido(short, sport) {
  const status = String(short || '').toUpperCase()
  if (['NS', 'TBD'].includes(status)) return 'programado'
  if (['FT', 'AET', 'PEN', 'AOT'].includes(status)) return 'finalizado'
  if (['PST', 'POST', 'DEL'].includes(status)) return 'aplazado'
  if (['CANC', 'CANCELED'].includes(status)) return 'cancelado'
  if (['SUSP', 'ABD'].includes(status)) return 'suspendido'
  if (sport === 'baloncesto' && status === 'LIVE') return 'en_vivo'
  return 'en_vivo'
}

async function cargarPartidosDirectos() {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
  const resultados = await Promise.allSettled([footballApi.live(), footballApi.next(20), basketballApi.games({ date: hoy })])
  const footballLive = resultados[0].status === 'fulfilled' ? resultados[0].value : []
  const footballNext = resultados[1].status === 'fulfilled' ? resultados[1].value : []
  const basketballGames = resultados[2].status === 'fulfilled' ? resultados[2].value : []
  const football = [...footballLive, ...footballNext].map((match) => ({
    id: `api_football_${match.id}`, providerId: String(match.id), proveedor: 'api-football', origen: 'api', deporte: 'futbol',
    estado: estadoPartido(match.statusShort, 'futbol'), estadoProveedor: match.statusShort,
    local: match.home, visitante: match.away, fecha: match.date, competicion: match.league,
    marcadorLocal: match.homeScore, marcadorVisitante: match.awayScore,
    logosApi: { local: match.homeLogo, visitante: match.awayLogo }
  }))
  const basketball = basketballGames.map((entry) => {
    const game = entry.game || {}
    const teams = entry.teams || {}
    return {
      id: `api_basketball_${game.id}`, providerId: String(game.id), apiBasketballGameId: String(game.id),
      proveedor: 'api-sports-basketball', origen: 'api', deporte: 'baloncesto',
      estado: estadoPartido(game.status?.short, 'baloncesto'), estadoProveedor: game.status?.short,
      local: teams.home?.name || 'Equipo local', visitante: teams.away?.name || 'Equipo visitante',
      fecha: game.date, competicion: entry.league?.name || 'Baloncesto',
      marcadorLocal: entry.scores?.home?.total ?? null, marcadorVisitante: entry.scores?.away?.total ?? null
    }
  })
  const merged = [...football, ...basketball]
  if (merged.length) {
    partidos.value = merged
    errorCarga.value = false
    cargando.value = false
    void actualizarCuotas()
    return
  }
  const errors = resultados.filter((result) => result.status === 'rejected')
  if (errors.length === resultados.length) {
    errorCarga.value = true
    notificar('error', errors[0].reason?.message || 'No fue posible consultar partidos de las APIs.')
  }
  cargando.value = false
}

async function cargarPartidosEnVivo() {
  cargando.value = true
  errorCarga.value = false
  try {
    unsubscribe = onSnapshot(collection(db, 'partidos'), (snapshot) => {
      const siguientes = snapshot.docs.map((partido) => ({ id: partido.id, ...partido.data() }))
        .filter((partido) => partido.origen === 'api'
          ? ['en_vivo', 'programado'].includes(partido.estado)
          : partido.estado !== 'finalizado')
      for (const item of carrito.value) {
        const partido = siguientes.find((actual) => actual.id === item.partidoId)
        const tipo = item.tipo
        if (!partido || suspendido(partido, tipo)) {
          item.suspendido = true
          notificar('suspendido', `Selección suspendida: ${item.descripcionPartido}`)
          continue
        }
        const nuevaCuota = cuotaValor(partido, tipo)
        if (nuevaCuota === null) {
          item.suspendido = true
          notificar('suspendido', `Cuota vencida o suspendida: ${item.descripcionPartido}`)
          continue
        }
        if (item.cuota !== nuevaCuota) {
          const cuotaPendienteCambio = !item.requiereAceptacion || item.cuotaPendiente !== nuevaCuota
          item.cuotaPendiente = nuevaCuota
          item.requiereAceptacion = true
          item.proveedorCuotaPendiente = partido.cuotasProveedor || item.proveedorCuota
          item.casaCuotaPendiente = partido.cuotasCasa || item.casaCuota
          item.mercadoPendiente = partido.cuotasMercado || item.mercado
          item.cuotasActualizadasPendiente = partido.cuotasActualizadasEn || null
          if (cuotaPendienteCambio) notificar('cuota', `La cuota cambio de ${item.cuota.toFixed(2)} a ${nuevaCuota.toFixed(2)}. Acepta el nuevo valor para continuar.`)
        } else {
          if (item.requiereAceptacion) {
            item.requiereAceptacion = false
            item.cuotaPendiente = null
            item.proveedorCuotaPendiente = null
            item.casaCuotaPendiente = null
            item.mercadoPendiente = null
            item.cuotasActualizadasPendiente = null
            notificar('info', 'La cuota volvio al valor que habias seleccionado.')
          }
          item.cuotasActualizadasEn = partido.cuotasActualizadasEn || null
          item.proveedorCuota = partido.cuotasProveedor || item.proveedorCuota
          item.casaCuota = partido.cuotasCasa || item.casaCuota
          item.mercado = partido.cuotasMercado || item.mercado
        }
        item.suspendido = false
      }
      partidos.value = siguientes
      cargando.value = false
      if (siguientes.length) void actualizarCuotas()
      else { cargando.value = true; void cargarPartidosDirectos() }
    }, (error) => {
      console.error('Error al cargar partidos de Firebase:', error)
      errorCarga.value = true
      cargando.value = false
      notificar('error', 'Error de conexión al cargar los partidos.')
    })
  } catch (error) {
    console.error('Error al cargar partidos de Firebase:', error)
    errorCarga.value = true
    cargando.value = false
    notificar('error', 'Error de conexión al cargar los partidos.')
  }
}

function agregarSeleccion(partido, tipo) {
  if (suspendido(partido, tipo)) {
    notificar('suspendido', 'Partido suspendido o cuota no disponible.')
    return
  }
  const key = claveSeleccion(partido, tipo)
  if (carrito.value.some((item) => item.key === key)) {
    notificar('info', 'Esa selección ya está en el ticket.')
    return
  }
  if (carrito.value.some((item) => item.partidoId === partido.id)) {
    notificar('error', 'Por ahora solo se permite una selección por partido en cada ticket.')
    return
  }
  const seleccion = tipo === 'local' ? partido.local : tipo === 'visitante' ? partido.visitante : 'Empate'
  const item = {
    key, tipo, partidoId: partido.id, local: partido.local, visitante: partido.visitante,
    descripcionPartido: `${partido.local} vs ${partido.visitante}`,
    competicion: competicion(partido), mercado: partido.cuotasMercado || mercado(partido), seleccion,
    cuota: cuotaValor(partido, tipo), suspendido: false, requiereAceptacion: false,
    proveedorCuota: partido.cuotasProveedor || (partido.origen === 'api' ? 'API' : 'DEMO'),
    casaCuota: partido.cuotasCasa || (partido.origen === 'api' ? 'No especificada' : 'DEMO'),
    cuotasActualizadasEn: partido.cuotasActualizadasEn || null
  }
  carrito.value = [...carrito.value, item]
  carritoAbierto.value = true
  notificar('success', `Selección agregada: ${seleccion} @ ${item.cuota.toFixed(2)}.`)
}

function aceptarNuevaCuota(item) {
  if (item.suspendido || !Number.isFinite(item.cuotaPendiente) || item.cuotaPendiente <= 1) return
  item.cuota = item.cuotaPendiente
  item.cuotaPendiente = null
  item.requiereAceptacion = false
  item.proveedorCuota = item.proveedorCuotaPendiente || item.proveedorCuota
  item.casaCuota = item.casaCuotaPendiente || item.casaCuota
  item.mercado = item.mercadoPendiente || item.mercado
  item.cuotasActualizadasEn = item.cuotasActualizadasPendiente || item.cuotasActualizadasEn
  item.proveedorCuotaPendiente = null
  item.casaCuotaPendiente = null
  item.mercadoPendiente = null
  item.cuotasActualizadasPendiente = null
  notificar('success', `Nueva cuota aceptada: ${item.seleccion} @ ${item.cuota.toFixed(2)}.`)
}

function quitarSeleccion(item) {
  carrito.value = carrito.value.filter((actual) => actual.key !== item.key)
  notificar('info', `Selección eliminada: ${item.seleccion}.`)
}

async function confirmarApuesta() {
  if (!auth.logueado || !auth.usuario?.uid) {
    notificar('error', 'Inicia sesión para confirmar la apuesta.')
    return
  }
  const valor = montoNumero.value
  if (!Number.isFinite(valor) || !Number.isInteger(valor) || valor < 5000) {
    notificar('error', 'Ingresa un monto válido. El mínimo es $5.000 COP.')
    return
  }
  if (!carrito.value.length) {
    notificar('error', 'Agrega una selección antes de confirmar.')
    return
  }
  if (carrito.value.some((item) => item.suspendido)) {
    notificar('suspendido', 'Elimina las selecciones suspendidas para continuar.')
    return
  }
  if (carrito.value.some((item) => item.requiereAceptacion)) {
    notificar('cuota', 'Acepta las cuotas modificadas antes de confirmar.')
    return
  }
  const seleccionesActuales = carrito.value.map((seleccion) => {
    const partido = partidos.value.find((actual) => actual.id === seleccion.partidoId)
    return { seleccion, partido }
  })
  if (seleccionesActuales.some(({ seleccion, partido }) => !partido || suspendido(partido, seleccion.tipo) || cuotaValor(partido, seleccion.tipo) !== seleccion.cuota)) {
    notificar('suspendido', 'Una o más cuotas ya no están disponibles. Actualiza el ticket para continuar.')
    return
  }
  if (valor > saldo.value) {
    notificar('saldo', 'Saldo insuficiente para realizar esta apuesta.')
    return
  }
  enviando.value = true
  try {
    const perfilRef = doc(db, 'usuarios', auth.usuario.uid)
    const saldoActual = Number(auth.saldo || 0)
    if (valor > saldoActual) {
      notificar('saldo', 'Tu saldo cambió y ya no es suficiente.')
      return
    }
    const esCombinada = carrito.value.length > 1
    const detalleSelecciones = carrito.value.map((seleccion) => ({
      partidoId: seleccion.partidoId,
      local: seleccion.local,
      visitante: seleccion.visitante,
      competicion: seleccion.competicion,
      mercado: seleccion.mercado,
      seleccion: seleccion.seleccion,
      cuota: seleccion.cuota,
      proveedorCuota: seleccion.proveedorCuota,
      casaCuota: seleccion.casaCuota,
      cuotasActualizadasEn: seleccion.cuotasActualizadasEn
    }))
    const descripcionTicket = carrito.value.map((seleccion) => `${seleccion.descripcionPartido}: ${seleccion.seleccion} @ ${seleccion.cuota}`).join(' | ')
    await addDoc(collection(db, 'historial_apuestas'), {
      usuarioId: auth.usuario.uid,
      partidoId: esCombinada ? null : carrito.value[0].partidoId,
      tipoApuesta: esCombinada ? 'combinada' : 'individual',
      selecciones: detalleSelecciones,
      cuotaCombinada: cuotaTotal.value,
      seleccion: esCombinada ? 'Combinada' : carrito.value[0].seleccion,
      descripcion: (esCombinada ? 'Apuesta combinada: ' : 'Apuesta: ') + descripcionTicket,
      detalle: `${carrito.value.map((seleccion) => `${seleccion.seleccion} @ ${seleccion.cuota}`).join(' × ')} = ${cuotaTotal.value.toFixed(2)}`,
      valor: '- $' + valor.toLocaleString('es-CO'),
      numValor: valor,
      fecha: new Date().toLocaleDateString(),
      estado: 'pendiente',
      timestamp: new Date(),
      cuota: cuotaTotal.value,
      proveedorCuota: esCombinada ? 'Mixto' : carrito.value[0].proveedorCuota,
      casaCuota: esCombinada ? 'Múltiples' : carrito.value[0].casaCuota,
      mercadoCuota: esCombinada ? 'Combinada' : carrito.value[0].mercado,
      cuotasActualizadasEn: esCombinada ? null : carrito.value[0].cuotasActualizadasEn,
      esDemo: carrito.value.some((seleccion) => seleccion.proveedorCuota === 'DEMO')
    })
    await updateDoc(perfilRef, { saldo: saldoActual - valor })
    carrito.value = []
    monto.value = ''
    carritoAbierto.value = false
    notificar('success', 'Apuesta realizada correctamente.')
  } catch (error) {
    console.error('Error al registrar la apuesta:', error)
    notificar('error', 'Error de conexión al registrar la apuesta. Inténtalo de nuevo.')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="contenedor-apuestas betslip-page">
    <div class="live-heading">
      <h2 class="titulo-pagina">Apuestas en Vivo</h2>
      <div class="live-heading-actions">
        <button class="refresh-odds" :disabled="actualizandoCuotas" @click="actualizarCuotas">{{ actualizandoCuotas ? 'Actualizando cuotas…' : 'Actualizar cuotas' }}</button>
        <span class="saldo-live">Saldo Disponible: <strong>{{ formatCOP(saldo) }}</strong></span>
      </div>
    </div>
    <div class="live-layout">
      <section class="grid-partidos">
        <p v-if="cargando" class="estado-lista">Cargando partidos en vivo...</p>
        <p v-else-if="errorCarga" class="estado-lista error">Error al cargar los partidos.</p>
        <p v-else-if="!partidos.length" class="estado-lista">No hay partidos en vivo disponibles en este momento.</p>
        <article v-else v-for="partido in partidos" :key="partido.id" class="tarjeta-partido">
          <div class="info-evento">
            <span class="badge-en-vivo" :class="{ 'badge-suspendido': partido.estado === 'suspendido' }">{{ partido.estado === 'suspendido' ? 'Suspendido' : partido.estado === 'programado' ? 'Programado' : 'En Vivo' }}</span>
            <span class="competition-label">{{ competicion(partido) }}</span>
          </div>
          <div class="equipos">{{ partido.local }} vs {{ partido.visitante }}</div>
          <div class="opciones-cuotas">
            <button class="btn-apostar-cuota" :disabled="suspendido(partido, 'local')" @click="agregarSeleccion(partido, 'local')"><span>{{ partido.local }}</span><span class="valor-cuota">{{ cuotaValor(partido, 'local')?.toFixed(2) || 'No disponible' }}</span></button>
            <button v-if="partido.deporte !== 'baloncesto'" class="btn-apostar-cuota" :disabled="suspendido(partido, 'empate')" @click="agregarSeleccion(partido, 'empate')"><span>Empate</span><span class="valor-cuota">{{ cuotaValor(partido, 'empate')?.toFixed(2) || 'No disponible' }}</span></button>
            <button class="btn-apostar-cuota" :disabled="suspendido(partido, 'visitante')" @click="agregarSeleccion(partido, 'visitante')"><span>{{ partido.visitante }}</span><span class="valor-cuota">{{ cuotaValor(partido, 'visitante')?.toFixed(2) || 'No disponible' }}</span></button>
          </div>
          <small class="odds-provenance">{{ partido.origen === 'api' ? `${partido.cuotasProveedor || 'Proveedor API'} · ${partido.cuotasCasa || 'Casa no disponible'} · ${partido.cuotasEstado === 'disponibles' ? `Actualizada ${fechaCuota(partido.cuotasActualizadasEn)}` : 'Cuota no disponible'}` : 'DEMO · Cuota manual' }}</small>
        </article>
      </section>

      <button class="betslip-mobile-trigger" :aria-expanded="carritoAbierto" @click="carritoAbierto = !carritoAbierto">Apuesta <span>{{ carrito.length }}</span><b>{{ carritoAbierto ? 'Cerrar' : 'Ver carrito' }}</b></button>
      <aside class="betslip" :class="{ abierto: carritoAbierto }">
        <header class="betslip-header"><div><span class="betslip-eyebrow">PLAYEXPERT</span><h3>{{ carrito.length > 1 ? 'Apuesta combinada' : 'Mi apuesta' }} <span>{{ carrito.length }}</span></h3></div><button class="betslip-close" aria-label="Cerrar carrito" @click="carritoAbierto = false">×</button></header>
        <div v-if="!carrito.length" class="betslip-empty"><span>＋</span><strong>Tu carrito está vacío</strong><small>Selecciona una cuota para comenzar.</small></div>
        <div v-else class="bet-selections">
          <article v-for="item in carrito" :key="item.key" class="bet-selection" :class="{ suspendida: item.suspendido || !seleccionActualDisponible(item) }">
            <button class="remove-selection" :aria-label="`Eliminar ${item.seleccion}`" @click="quitarSeleccion(item)">×</button>
            <strong class="bet-selection-teams">{{ item.local }} vs {{ item.visitante }}</strong>
            <small>{{ item.competicion }} · {{ item.mercado }}</small>
            <div class="selection-pick"><span>{{ item.seleccion }}<em v-if="item.suspendido"> · Suspendida</em></span><b>@ {{ item.cuota.toFixed(2) }}</b></div>
            <small>{{ item.proveedorCuota }} · {{ item.casaCuota }}</small>
            <div v-if="item.requiereAceptacion" class="quote-change"><span>La cuota cambió a @ {{ item.cuotaPendiente?.toFixed(2) }}. Debes aceptar el nuevo valor.</span><button @click="aceptarNuevaCuota(item)">Aceptar nueva cuota</button></div>
          </article>
        </div>
        <div class="stake-section">
          <label for="monto-apuesta">Monto de apuesta</label>
          <div class="stake-input"><span>$</span><input id="monto-apuesta" v-model="monto" type="number" min="5000" step="1000" inputmode="numeric" placeholder="Mínimo 5.000" /></div>
          <div class="bet-summary"><span>{{ carrito.length > 1 ? `Cuota combinada (${carrito.length} selecciones)` : 'Cuota total' }}</span><strong>{{ cuotaTotal.toFixed(2) }}</strong><span>Monto apostado</span><strong>{{ formatCOP(montoNumero) }}</strong></div>
          <div class="potential-win"><span>Ganancia potencial</span><strong>{{ formatCOP(gananciaPotencial) }}</strong><small>Incluye el monto apostado</small></div>
          <button class="confirm-bet" :disabled="enviando || !carrito.length || carrito.some((item) => item.requiereAceptacion || item.suspendido || !seleccionActualDisponible(item))" @click="confirmarApuesta">{{ enviando ? 'Registrando…' : 'Confirmar apuesta' }}</button>
          <small class="balance-footnote">Saldo disponible: {{ formatCOP(saldo) }}</small>
        </div>
      </aside>
    </div>
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <div v-for="toast in notificaciones" :key="toast.id" class="toast" :class="`toast-${toast.tipo}`"><span>{{ toast.tipo === 'success' ? '✓' : toast.tipo === 'saldo' ? '$' : toast.tipo === 'cuota' ? '↗' : toast.tipo === 'suspendido' ? '!' : '•' }}</span>{{ toast.texto }}</div>
    </div>
  </main>
</template>

<style scoped>
.betslip-page { max-width: 1440px; }
.live-heading { display:flex; justify-content:space-between; align-items:center; gap:18px; margin-bottom:22px; }
.live-heading-actions { display:flex; align-items:center; gap:16px; }
.refresh-odds { border:1px solid #2b5878; border-radius:9px; padding:9px 13px; background:#142d48; color:#e5f2ff; cursor:pointer; }
.refresh-odds:disabled { opacity:.6; cursor:wait; }
.live-heading .titulo-pagina { margin:0; }
.saldo-live { color:#cbd5e1; font-weight:700; }
.saldo-live strong { color:#4ade80; }
.live-layout { display:grid; grid-template-columns:minmax(0,1fr) 340px; align-items:start; gap:24px; }
.grid-partidos { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px; }
.tarjeta-partido { min-width:0; }
.competition-label { color:#9ca3af; font-size:.78rem; }
.equipos { font-size:1.1rem; font-weight:800; }
.btn-apostar-cuota { transition:transform .16s ease,border-color .16s ease,background .16s ease; }
.btn-apostar-cuota:hover:not(:disabled) { transform:translateY(-2px); border-color:#38bdf8; background:#233c5b; }
.btn-apostar-cuota:disabled { cursor:not-allowed; opacity:.45; text-decoration:line-through; }
.badge-suspendido { background:#783b25; }
.estado-lista { grid-column:1/-1; color:#fff; text-align:center; padding:20px; }
.estado-lista.error { color:#fca5a5; }
.betslip { position:sticky; top:18px; overflow:hidden; border:1px solid rgba(56,189,248,.25); border-radius:16px; background:linear-gradient(155deg,#10243e,#081629); box-shadow:0 18px 50px rgba(0,0,0,.35); color:#f8fafc; }
.betslip-header { display:flex; justify-content:space-between; align-items:center; padding:18px 20px; border-bottom:1px solid rgba(148,163,184,.16); background:rgba(0,161,224,.08); }
.betslip-eyebrow { color:#38bdf8; font-size:.62rem; font-weight:900; letter-spacing:.2em; }
.betslip-header h3 { margin:3px 0 0; font-size:1.15rem; }
.betslip-header h3 span { display:inline-grid; min-width:22px; height:22px; place-items:center; margin-left:5px; border-radius:50%; background:#0891b2; font-size:.75rem; }
.betslip-close { display:none; border:0; background:none; color:#cbd5e1; font-size:1.8rem; cursor:pointer; }
.betslip-empty { display:grid; min-height:180px; place-content:center; justify-items:center; gap:8px; color:#cbd5e1; text-align:center; }
.betslip-empty span { color:#38bdf8; font-size:2rem; }
.betslip-empty small { color:#94a3b8; }
.bet-selections { display:grid; max-height:35vh; gap:10px; overflow:auto; padding:14px; }
.bet-selection { position:relative; padding:13px; border:1px solid rgba(148,163,184,.18); border-radius:11px; background:rgba(30,48,72,.72); }
.bet-selection.suspendida { border-color:#f87171; }
.odds-provenance { display:block; margin-top:8px; color:#94a3b8; font-size:.7rem; }
.quote-change { display:grid; gap:8px; margin-top:10px; padding:10px; border:1px solid rgba(250,204,21,.45); border-radius:8px; color:#fde68a; font-size:.78rem; }
.quote-change button { padding:7px 10px; border:0; border-radius:6px; background:#facc15; color:#172033; font-weight:800; cursor:pointer; }
.bet-selection-teams { display:block; padding-right:25px; font-size:.86rem; }
.bet-selection small { display:block; margin-top:5px; color:#94a3b8; font-size:.72rem; }
.selection-pick { display:flex; justify-content:space-between; gap:10px; margin-top:12px; color:#bae6fd; font-size:.84rem; }
.selection-pick b { color:#4ade80; }
.selection-pick em { color:#fca5a5; font-style:normal; }
.remove-selection { position:absolute; top:8px; right:9px; border:0; background:transparent; color:#94a3b8; font-size:1.3rem; cursor:pointer; }
.remove-selection:hover { color:#f87171; }
.stake-section { padding:16px 18px 18px; border-top:1px solid rgba(148,163,184,.16); }
.stake-section label { display:block; margin-bottom:7px; color:#cbd5e1; font-size:.8rem; font-weight:800; }
.stake-input { display:flex; align-items:center; gap:8px; padding:0 12px; border:1px solid #334155; border-radius:9px; background:#0b1728; color:#94a3b8; }
.stake-input:focus-within { border-color:#38bdf8; box-shadow:0 0 0 3px rgba(56,189,248,.12); }
.stake-input input { width:100%; min-height:43px; border:0; outline:none; background:transparent; color:white; }
.bet-summary { display:grid; grid-template-columns:1fr auto; gap:9px; margin-top:14px; color:#aab7c8; font-size:.78rem; }
.bet-summary strong { color:white; text-align:right; }
.potential-win { display:grid; gap:4px; margin-top:15px; padding:13px; border:1px solid rgba(74,222,128,.2); border-radius:10px; background:rgba(20,83,45,.2); }
.potential-win span { color:#bbf7d0; font-size:.78rem; }
.potential-win strong { color:#4ade80; font-size:1.35rem; }
.potential-win small,.balance-footnote { color:#94a3b8; font-size:.68rem; }
.confirm-bet { width:100%; margin-top:14px; padding:13px; border:0; border-radius:9px; background:linear-gradient(100deg,#0284c7,#06b6d4); color:white; font-weight:900; cursor:pointer; }
.confirm-bet:disabled { cursor:not-allowed; opacity:.45; }
.balance-footnote { display:block; margin-top:10px; text-align:center; }
.betslip-mobile-trigger { display:none; }
.toast-stack { position:fixed; z-index:1000; top:18px; right:18px; display:grid; width:min(380px,calc(100vw - 32px)); gap:9px; }
.toast { display:flex; align-items:center; gap:11px; padding:13px 15px; border:1px solid rgba(255,255,255,.14); border-radius:11px; background:#10243e; color:#f8fafc; box-shadow:0 12px 35px rgba(0,0,0,.35); animation:toast-in .22s ease-out both; font-size:.84rem; }
.toast span { display:grid; width:25px; height:25px; flex:none; place-items:center; border-radius:50%; background:rgba(255,255,255,.1); font-weight:900; }
.toast-success { border-color:rgba(74,222,128,.4); }.toast-success span { color:#4ade80; }
.toast-info,.toast-cuota { border-color:rgba(56,189,248,.4); }.toast-info span,.toast-cuota span { color:#38bdf8; }
.toast-saldo,.toast-suspendido,.toast-error { border-color:rgba(248,113,113,.4); }.toast-saldo span,.toast-suspendido span,.toast-error span { color:#f87171; }
.betslip-mobile-trigger { display:none; }
@keyframes toast-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
@media(max-width:850px) {
  .betslip-page { padding-bottom:90px; }
  .live-layout { display:block; }
  .betslip { position:fixed; z-index:50; right:0; bottom:0; left:0; top:auto; max-height:82vh; overflow:auto; border-radius:18px 18px 0 0; transform:translateY(calc(100% - 64px)); transition:transform .28s ease; box-shadow:0 -14px 45px rgba(0,0,0,.4); }
  .betslip.abierto { transform:translateY(0); }
  .betslip-mobile-trigger { position:fixed; z-index:51; right:12px; bottom:12px; left:12px; display:flex; align-items:center; gap:10px; min-height:48px; padding:0 15px; border:1px solid #38bdf8; border-radius:12px; background:#08233e; color:white; font-weight:800; box-shadow:0 8px 25px rgba(0,0,0,.38); }
  .betslip-mobile-trigger span { display:grid; width:22px; height:22px; place-items:center; border-radius:50%; background:#0891b2; }
  .betslip-mobile-trigger b { margin-left:auto; color:#67e8f9; }
  .betslip-close { display:block; }
  .betslip-header { position:sticky; top:0; z-index:1; }
  .bet-selections { max-height:28vh; }
  .live-heading { align-items:flex-start; flex-direction:column; }
  .live-heading-actions { flex-wrap:wrap; }
}
@media(max-width:440px) { .grid-partidos { grid-template-columns:1fr; }.betslip-page { padding-right:4%; padding-left:4%; } }
</style>

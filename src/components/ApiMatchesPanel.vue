<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { footballApi } from '../services/sportsApi'
import { sportsDb } from '../services/sportsDb'
import { apiNinjasBasketball, basketballLeagues } from '../services/apiNinjasBasketball'

const props = defineProps({ sport: { type: String, required: true } })
const mode = ref('live')
const matches = ref([])
const synchronizedMatches = ref([])
const loading = ref(false)
const message = ref('')
const selectedDate = ref(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }))
const searchText = ref('')
const searchSeason = ref(String(new Date().getFullYear()))
const searchKind = ref('team')
const selectedLeague = ref('nba')
const entities = ref([])
const entityMessage = ref('')
const detailByMatch = ref({})
const detailLoading = ref(null)
let unsubscribeMatches
let matchesSnapshotReady = false

function mapStoredMatch(document) {
  const value = document.data()
  const date = value.fecha?.toDate ? value.fecha.toDate().toISOString() : value.fecha || null
  const labels = { en_vivo: 'En juego', programado: 'Programado', finalizado: 'Finalizado', suspendido: 'Suspendido', aplazado: 'Aplazado', cancelado: 'Cancelado', demorado: 'Demorado' }
  return { id: document.id, providerId: value.providerId, sport: value.deporte, date, status: labels[value.estado] || value.estado || 'Estado no disponible', statusShort: value.estadoProveedor || value.estado, elapsed: value.minuto ? `${value.minuto}'` : value.period ? `P${value.period}` : null, home: value.local, away: value.visitante, homeLogo: value.logosApi?.local || null, awayLogo: value.logosApi?.visitante || null, league: value.competicion || value.liga || 'Competición no especificada', country: value.pais || null, homeScore: value.marcadorLocal ?? null, awayScore: value.marcadorVisitante ?? null, periodScores: value.puntosPorPeriodo || null, venue: value.sede || null, original: value }
}

async function load(allowProviderFallback = true) {
  if (['leagues','teams','players'].includes(mode.value)) return
  const wantedSport = props.sport === 'football' ? 'futbol' : 'baloncesto'
  let stored = synchronizedMatches.value.filter((match) => match.sport === wantedSport)
  if (props.sport === 'basketball') stored = stored.filter((match) => match.original.competicion === selectedLeague.value)
  if (mode.value === 'live') stored = stored.filter((match) => match.original.estado === 'en_vivo')
  if (mode.value === 'next') stored = stored.filter((match) => ['programado', 'aplazado', 'demorado'].includes(match.original.estado))
  if (mode.value === 'recent') stored = stored.filter((match) => match.original.estado === 'finalizado')
  if ((props.sport === 'basketball' || ['next', 'recent'].includes(mode.value)) && selectedDate.value) stored = stored.filter((match) => match.date && new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(match.date)) === selectedDate.value)
  matches.value = stored
  message.value = ''
  if (stored.length || !allowProviderFallback) {
    if (!stored.length) message.value = 'No hay partidos sincronizados para este filtro.'
    return
  }
  loading.value = true
  try {
    let current
    if (props.sport === 'football') {
      current = mode.value === 'live' ? await footballApi.live() : await footballApi.byDate(selectedDate.value)
      if (mode.value === 'next') current = current.filter((match) => ['NS', 'TBD'].includes(match.statusShort))
      if (mode.value === 'recent') current = current.filter((match) => ['FT', 'AET', 'PEN', 'AOT'].includes(match.statusShort))
    } else {
      current = await apiNinjasBasketball.games(mode.value === 'live' ? { league: selectedLeague.value } : { league: selectedLeague.value, date: selectedDate.value })
      current = current.filter((match) => mode.value === 'live' ? match.statusShort === 'LIVE' : mode.value === 'next' ? ['NS', 'TBD'].includes(match.statusShort) : ['FT', 'AET', 'PEN'].includes(match.statusShort))
    }
    const dateFilter = props.sport === 'basketball' || ['next', 'recent'].includes(mode.value)
    if (dateFilter && selectedDate.value) current = current.filter((match) => match.date && new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(match.date)) === selectedDate.value)
    matches.value = current
    if (!current.length) message.value = 'La API no reporta partidos para este filtro.'
  } catch (error) {
    matches.value = []
    message.value = error.message || 'No se pudieron consultar partidos del proveedor.'
  } finally { loading.value = false }
}

async function searchEntities() {
  entityMessage.value = ''
  entities.value = []
  try {
    if (props.sport === 'basketball') {
      const league = selectedLeague.value
      const season = searchSeason.value.trim()
      if (mode.value === 'leagues') {
        const standings = await apiNinjasBasketball.standings({ league, season })
        entities.value = standings.map((entry) => ({ ...entry, name: entry.team?.name || entry.name || entry.team_name, group: `Temporada ${season}` }))
      } else if (searchKind.value === 'team') {
        const list = await apiNinjasBasketball.teams({ league, team: searchText.value.trim() })
        entities.value = await Promise.all(list.map(async (team) => {
          const extra = await sportsDb.team(team.name).catch(() => null)
          return { ...team, name: team.name || team.team_name, image: extra?.strBadge || team.logo, flag: extra?.strCountry || '', description: extra?.strDescriptionEN || '' }
        }))
      } else {
        const list = await apiNinjasBasketball.players({ league, name: searchText.value.trim() })
        entities.value = await Promise.all(list.map(async (player) => {
          const name = player.name || [player.first_name, player.last_name].filter(Boolean).join(' ')
          const extra = await sportsDb.player(name).catch(() => null)
          return { ...player, name, image: player.photo || extra?.strThumb, bio: extra?.strDescriptionEN || '', nationality: extra?.strNationality || player.nationality }
        }))
      }
      if (!entities.value.length) entityMessage.value = 'Sin datos disponibles para esa consulta.'
      return
    }
    const api = footballApi
    const season = searchSeason.value.trim()
    if (mode.value === 'leagues') entities.value = await api.leagues({ search: searchText.value.trim(), season })
    else if (searchKind.value === 'team') {
      // API-Football rejects `season` together with `search` on /teams.
      const teamParams = { search: searchText.value.trim() }
      const list = await api.teams(teamParams)
      entities.value = await Promise.all(list.map(async (entry) => {
        const team = entry.team || entry
        const extra = await sportsDb.team(team.name).catch(() => null)
        return { ...team, group: entry.league?.name, image: extra?.strBadge || team.logo, flag: extra?.strCountry || '', description: extra?.strDescriptionEN || '' }
      }))
    } else {
      const list = await api.playerProfiles({ search: searchText.value.trim() })
      entities.value = await Promise.all(list.map(async (entry) => {
        const player = entry.player || entry
        const extra = await sportsDb.player(player.name).catch(() => null)
        return { ...player, name: player.name || player.firstname + ' ' + player.lastname, image: player.photo || extra?.strThumb, bio: extra?.strDescriptionEN || '', nationality: extra?.strNationality || player.nationality }
      }))
    }
    if (!entities.value.length) entityMessage.value = 'Sin datos disponibles para esa consulta.'
  } catch (error) { entityMessage.value = error.message || 'No se pudo consultar. Verifica clave, cobertura y parámetros.' }
}

async function showDetails(match) {
  if (detailByMatch.value[match.id]) { detailByMatch.value[match.id].open = !detailByMatch.value[match.id].open; return }
  detailLoading.value = match.id
  try {
    if (props.sport === 'football') {
      const fixtureId = match.original?.providerId || match.id
      const [events, stats, fixture] = await Promise.all([footballApi.events(fixtureId).catch(() => []), footballApi.statistics(fixtureId).catch(() => []), footballApi.fixtureDetails(fixtureId).catch(() => [])])
      detailByMatch.value[match.id] = { open: true, events, stats, players: fixture[0]?.players || [] }
    } else {
      detailByMatch.value[match.id] = { open: true, events: [], stats: [], players: [], periodScores: match.periodScores, venue: match.venue }
    }
  } catch { detailByMatch.value[match.id] = { open: true, events: [], stats: [], players: [] } }
  finally { detailLoading.value = null }
}

watch(mode, () => load())
onMounted(() => {
  loading.value = true
  unsubscribeMatches = onSnapshot(collection(db, 'partidos'), (snapshot) => {
    synchronizedMatches.value = snapshot.docs.filter((document) => document.data().origen === 'api').map(mapStoredMatch)
    loading.value = false
    const isInitialSnapshot = !matchesSnapshotReady
    matchesSnapshotReady = true
    load(isInitialSnapshot)
  }, (error) => {
    console.error('No se pudieron leer los partidos sincronizados:', error)
    loading.value = false
    synchronizedMatches.value = []
    load()
  })
})
onUnmounted(() => unsubscribeMatches?.())
</script>

<template>
  <section class="api-sports-panel">
    <header><div><span>DATOS SINCRONIZADOS</span><h2>{{ sport === 'football' ? 'Fútbol' : 'Baloncesto' }} · Partidos</h2></div><button @click="load" :disabled="loading">Actualizar</button></header>
    <nav><button v-for="tab in ['live','next','recent','leagues','teams','players']" :key="tab" :class="{ selected: mode === tab }" @click="mode = tab; entities = []; entityMessage = ''; message = ''; matches = []">{{ {live:'En vivo',next:'Próximos',recent:'Resultados',leagues:'Ligas',teams:'Equipos',players:'Jugadores'}[tab] }}</button></nav>
    <div v-if="sport === 'basketball' && !['leagues','teams','players'].includes(mode)" class="api-filter"><label>Liga <select v-model="selectedLeague" @change="load"><option v-for="league in basketballLeagues" :key="league.code" :value="league.code">{{ league.name }}</option></select></label><label>Fecha <input v-model="selectedDate" type="date" @change="load"></label><button @click="load">Consultar fecha</button></div>
    <div v-else-if="sport === 'football' && ['next','recent'].includes(mode)" class="api-filter"><label>Fecha <input v-model="selectedDate" type="date" @change="load"></label><button @click="load">Consultar fecha</button></div>
    <form v-if="['leagues','teams','players'].includes(mode)" class="api-filter" @submit.prevent="searchEntities"><label v-if="sport === 'basketball'">Liga <select v-model="selectedLeague"><option v-for="league in basketballLeagues" :key="league.code" :value="league.code">{{ league.name }}</option></select></label><select v-if="mode !== 'leagues'" v-model="searchKind"><option value="team">Equipos</option><option value="player">Jugadores</option></select><input v-if="mode !== 'leagues'" v-model="searchText" required minlength="2" :placeholder="searchKind === 'team' ? 'Nombre del equipo' : 'Nombre del jugador'"><input v-if="sport === 'basketball'" v-model="searchSeason" placeholder="Temporada, ej. 2026"><button>Buscar</button></form>
    <p v-if="entityMessage" class="api-state">{{ entityMessage }}</p>
    <div v-if="entities.length" class="api-entity-list"><article v-for="entity in entities" :key="entity.team_id || entity.player_id || entity.id || entity.idLeague || entity.idPlayer || entity.name" class="api-match"><img v-if="entity.image || entity.logo" class="entity-image" :src="entity.image || entity.logo" alt="" @error="$event.target.hidden = true"><strong>{{ entity.name || entity.strPlayer || entity.strTeam || entity.strLeague }}</strong><small>{{ entity.group || entity.country?.name || entity.nationality || entity.flag || '' }}</small><small v-if="entity.wins != null || entity.losses != null">Victorias: {{ entity.wins ?? '—' }} · Derrotas: {{ entity.losses ?? '—' }}<template v-if="entity.win_pct != null"> · Porcentaje: {{ entity.win_pct }}</template></small><p v-if="entity.description || entity.bio">{{ entity.description || entity.bio }}</p></article></div>
    <p v-if="loading" class="api-state">Consultando proveedor…</p><p v-else-if="message" class="api-state">{{ message }}</p>
    <div v-else-if="!['leagues','teams','players'].includes(mode)" class="api-match-list">
      <article v-for="match in matches" :key="match.id" class="api-match" :class="{ 'match-live': match.status === 'En juego', 'match-football': sport === 'football', 'match-basketball': sport === 'basketball' }">
        <div class="match-court" aria-hidden="true">
          <svg v-if="sport === 'football'" viewBox="0 0 360 180" preserveAspectRatio="none"><rect x="10" y="10" width="340" height="160" rx="5"/><line x1="180" y1="10" x2="180" y2="170"/><circle cx="180" cy="90" r="27"/><rect x="10" y="48" width="40" height="84"/><rect x="310" y="48" width="40" height="84"/></svg>
          <svg v-else viewBox="0 0 360 180" preserveAspectRatio="none"><rect x="10" y="10" width="340" height="160" rx="7"/><line x1="180" y1="10" x2="180" y2="170"/><circle cx="180" cy="90" r="25"/><path d="M10 45h35v90H10M350 45h-35v90h35M10 65h16v50H10M350 65h-16v50h16"/><path d="M45 45a42 42 0 0 1 0 90M315 45a42 42 0 0 0 0 90"/></svg>
        </div>
        <div class="api-league"><img v-if="match.leagueLogo" :src="match.leagueLogo" alt="" @error="$event.target.hidden = true"><span>{{ match.league }}<template v-if="match.country"> · {{ match.country }}</template></span><b><i v-if="match.status === 'En juego'" class="live-indicator"></i>{{ match.status }}<template v-if="match.elapsed"> · {{ match.elapsed }}′</template></b></div>
        <div class="api-teams"><div><span class="team-crest"><img v-if="match.homeLogo" :src="match.homeLogo" :alt="match.home" @error="$event.target.hidden = true"><span v-else>{{ match.home?.slice(0, 2).toUpperCase() }}</span></span><span>{{ match.home }}</span><strong v-if="match.homeScore !== null">{{ match.homeScore }}</strong></div><div><span class="team-crest"><img v-if="match.awayLogo" :src="match.awayLogo" :alt="match.away" @error="$event.target.hidden = true"><span v-else>{{ match.away?.slice(0, 2).toUpperCase() }}</span></span><span>{{ match.away }}</span><strong v-if="match.awayScore !== null">{{ match.awayScore }}</strong></div></div>
        <time>{{ match.date ? new Date(match.date).toLocaleString('es-CO') : 'Fecha no disponible' }}</time>
        <button class="detail-toggle" @click="showDetails(match)">{{ detailLoading === match.id ? 'Cargando…' : detailByMatch[match.id]?.open ? 'Ocultar detalles' : sport === 'football' ? 'Eventos, jugadores y estadísticas' : 'Detalle del marcador' }}</button>
        <div v-if="detailByMatch[match.id]?.open" class="match-details">
          <section v-if="detailByMatch[match.id].events.length"><b>Eventos del partido</b><p v-for="(event,index) in detailByMatch[match.id].events" :key="index">{{ event.time?.elapsed ?? '' }}′ · {{ event.team?.name || '' }} · {{ event.player?.name || '' }} · {{ event.detail || event.type }}</p></section>
          <section v-if="detailByMatch[match.id].stats.length"><b>Estadísticas disponibles</b><p v-for="(stat,index) in detailByMatch[match.id].stats" :key="index">{{ stat.team?.name || stat.player?.name || stat.type || 'Dato' }}: {{ stat.statistics?.map(item => `${item.type}: ${item.value}`).join(' · ') || stat.value || stat.points || '' }}</p></section>
          <section v-if="detailByMatch[match.id].players.length"><b>Jugadores</b><p v-for="(group,index) in detailByMatch[match.id].players" :key="index">{{ group.team?.name || group.player?.name || 'Jugador' }} <span v-for="(player,j) in group.players || []" :key="j">· {{ player.player?.name }}</span></p></section>
          <section v-if="detailByMatch[match.id].periodScores"><b>Puntos por periodo</b><p>Local: {{ detailByMatch[match.id].periodScores.home?.join(' · ') }}</p><p>Visitante: {{ detailByMatch[match.id].periodScores.away?.join(' · ') }}</p></section>
          <section v-if="detailByMatch[match.id].venue"><b>Sede</b><p>{{ [detailByMatch[match.id].venue.name, detailByMatch[match.id].venue.city, detailByMatch[match.id].venue.state, detailByMatch[match.id].venue.country].filter(Boolean).join(', ') }}</p></section>
          <p v-if="!detailByMatch[match.id].events.length && !detailByMatch[match.id].stats.length && !detailByMatch[match.id].players.length">El proveedor no ofrece detalles para este partido.</p>
        </div>
      </article>
    </div>
    <footer>Fuente: {{ sport === 'football' ? 'API-Sports' : 'API Ninjas' }}. Datos disponibles según competición, temporada y plan contratado.</footer>
  </section>
</template>

<style scoped>
.api-sports-panel{margin:0 0 30px;padding:20px;border:1px solid rgba(56,189,248,.22);border-radius:14px;background:rgba(10,31,58,.88);color:#f8fafc}.api-sports-panel header{display:flex;align-items:center;justify-content:space-between}.api-sports-panel header span{color:#38bdf8;font-size:.68rem;font-weight:900;letter-spacing:.15em}.api-sports-panel h2{margin:4px 0 14px}.api-sports-panel button{padding:8px 12px;border:1px solid #31506f;border-radius:8px;background:#142b46;color:white;cursor:pointer}.api-sports-panel nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.api-sports-panel nav .selected{border-color:#38bdf8;background:#075985}.api-state{padding:20px;text-align:center;color:#cbd5e1}.api-match-list,.api-entity-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:15px}.api-match{position:relative;isolation:isolate;overflow:hidden;padding:15px;border:1px solid rgba(148,163,184,.2);border-radius:14px;background:linear-gradient(145deg,#142c49,#0b1c32 72%);box-shadow:0 10px 24px #02081755;transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}.api-match:hover{transform:translateY(-3px);border-color:#38bdf877;box-shadow:0 16px 32px #02081788}.match-court{position:absolute;z-index:-1;inset:34px 0 auto;height:150px;overflow:hidden;opacity:.14;pointer-events:none}.match-court svg{width:100%;height:100%;fill:none;stroke:#6dd5ff;stroke-width:1.5}.match-basketball .match-court svg{stroke:#ffbd6b}.api-league{display:flex;align-items:center;gap:7px;color:#cbd5e1;font-size:.75rem}.api-league img{width:20px;height:20px;object-fit:contain}.api-league b{margin-left:auto;color:#4ade80;font-size:.7rem;text-align:right}.live-indicator{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;animation:live-pulse 1.5s infinite}.api-teams{display:grid;gap:10px;margin:18px 0}.api-teams div{display:flex;align-items:center;gap:9px;min-height:39px;padding:5px 9px;border:1px solid #ffffff0c;border-radius:9px;background:#07182a80}.team-crest{display:grid;width:32px;height:32px;flex:none;place-items:center;border:1px solid #ffffff25;border-radius:50%;background:linear-gradient(145deg,#274968,#10243b);color:#b9eaff;font-size:.6rem;font-weight:900}.team-crest img{width:24px;height:24px;object-fit:contain}.api-teams strong{margin-left:auto;color:#facc15;font-size:1.2rem;text-shadow:0 0 12px #facc1555}.match-live .api-teams strong{animation:score-glow 2s ease-in-out infinite alternate}.api-match time,.api-sports-panel footer{color:#94a3b8;font-size:.7rem}.api-sports-panel footer{margin-top:13px}.api-filter{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:12px 0}.api-filter input,.api-filter select{min-height:38px;padding:7px 10px;border:1px solid #334155;border-radius:7px;background:#0b1728;color:white}.api-filter label{display:flex;align-items:center;gap:8px;color:#cbd5e1}.api-entity-list article{display:grid;gap:7px}.api-entity-list small,.api-entity-list p{color:#aebed0;font-size:.78rem}.entity-image{width:44px;height:44px;object-fit:contain}.detail-toggle{margin-top:12px!important;font-size:.75rem}.match-details{margin-top:12px;padding-top:10px;border-top:1px solid #334155;font-size:.75rem}.match-details p{color:#cbd5e1}@keyframes live-pulse{50%{opacity:.45;transform:scale(.82)}}@keyframes score-glow{to{text-shadow:0 0 13px #facc1599}}@media(prefers-reduced-motion:reduce){.api-match,.live-indicator,.match-live .api-teams strong{animation:none;transition:none}}
</style>

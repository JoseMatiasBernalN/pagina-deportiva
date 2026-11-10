import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { defineSecret } from 'firebase-functions/params'
import { onSchedule } from 'firebase-functions/v2/scheduler'

initializeApp()

const db = getFirestore()
const footballKey = defineSecret('API_FOOTBALL_KEY')
const basketballKey = defineSecret('API_NINJAS_KEY')
const apiSportsBasketballKey = defineSecret('API_BASKETBALL_KEY')
const FOOTBALL_URL = 'https://v3.football.api-sports.io/fixtures'
const NINJAS_URL = 'https://api.api-ninjas.com/v1/basketballgames'
const basketballLeagues = ['nba', 'wnba', 'ncaab', 'ncaaw']

const timestampOrNull = (value) => {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? Timestamp.fromDate(date) : null
}

function footballStatus(short) {
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'].includes(short)) return short === 'SUSP' ? 'suspendido' : 'en_vivo'
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finalizado'
  if (['PST', 'TBD'].includes(short)) return 'aplazado'
  if (short === 'CANC' || short === 'ABD') return 'cancelado'
  if (short === 'NS') return 'programado'
  return 'desconocido'
}

function basketballStatus(status) {
  return ({
    scheduled: 'programado', in_progress: 'en_vivo', final: 'finalizado',
    postponed: 'aplazado', suspended: 'suspendido', canceled: 'cancelado', delayed: 'demorado'
  })[status] || 'desconocido'
}

function footballRecord(item) {
  const fixture = item.fixture || {}
  const goals = item.goals || {}
  const id = fixture.id
  return {
    id: `api_football_${id}`,
    data: {
      local: item.teams?.home?.name || 'Equipo local',
      visitante: item.teams?.away?.name || 'Equipo visitante',
      deporte: 'futbol', proveedor: 'api-football', providerId: String(id), origen: 'api',
      estado: footballStatus(fixture.status?.short), estadoProveedor: fixture.status?.short || null,
      fecha: timestampOrNull(fixture.date), competicion: item.league?.name || null,
      pais: item.league?.country || null, temporada: item.league?.season ?? null,
      marcadorLocal: goals.home ?? null, marcadorVisitante: goals.away ?? null,
      minuto: fixture.status?.elapsed ?? null,
      equiposApi: { localId: item.teams?.home?.id ?? null, visitanteId: item.teams?.away?.id ?? null },
      logosApi: { local: item.teams?.home?.logo || null, visitante: item.teams?.away?.logo || null },
      actualizadoApiEn: Timestamp.now()
    }
  }
}

function basketballRecord(game) {
  const id = String(game.game_id || '')
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_')
  return {
    id: `api_basketball_${safeId}`,
    data: {
      local: game.home_team?.name || 'Equipo local',
      visitante: game.away_team?.name || 'Equipo visitante',
      deporte: 'baloncesto', proveedor: 'api-ninjas', providerId: id, origen: 'api',
      estado: basketballStatus(game.status), estadoProveedor: game.status || null,
      fecha: timestampOrNull(game.start_time || game.date), competicion: game.league || null,
      temporada: game.season_label || game.season || null,
      marcadorLocal: game.home_score ?? null, marcadorVisitante: game.away_score ?? null,
      periodo: game.period ?? null, reloj: game.clock ?? null,
      puntosPorPeriodo: game.period_scores || null,
      sede: game.venue || null,
      equiposApi: { localId: game.home_team?.team_id || null, visitanteId: game.away_team?.team_id || null },
      actualizadoApiEn: Timestamp.now()
    }
  }
}

async function upsertProviderMatch(provider, record) {
  const ref = db.collection('partidos').doc(record.id)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (snapshot.exists && (snapshot.get('origen') !== 'api' || snapshot.get('proveedor') !== provider)) return 'skipped'
    transaction.set(ref, record.data, { merge: true })
    return snapshot.exists ? 'updated' : 'created'
  })
}

async function saveSyncState(provider, fields) {
  await db.collection('sincronizacion_partidos').doc(provider).set({
    proveedor: provider,
    actualizadoEn: Timestamp.now(),
    ...fields
  }, { merge: true })
}

async function syncRecords(provider, records) {
  const totals = { received: records.length, created: 0, updated: 0, skippedManual: 0 }
  // Keep concurrent transactions bounded; each document has a deterministic ID.
  for (let offset = 0; offset < records.length; offset += 10) {
    const group = records.slice(offset, offset + 10)
    const results = await Promise.all(group.map((record) => upsertProviderMatch(provider, record)))
    for (const result of results) {
      if (result === 'created') totals.created += 1
      else if (result === 'updated') totals.updated += 1
      else totals.skippedManual += 1
    }
  }
  return totals
}

async function fetchFootball(date) {
  const response = await fetch(`${FOOTBALL_URL}?date=${encodeURIComponent(date)}`, {
    headers: { 'x-apisports-key': footballKey.value() },
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`API-Football respondió HTTP ${response.status}.`)
  const json = await response.json()
  if (json.errors && Object.keys(json.errors).length) throw new Error(`API-Football: ${JSON.stringify(json.errors)}`)
  return (json.response || []).map(footballRecord)
}

async function fetchBasketball(league) {
  const url = new URL(NINJAS_URL)
  url.searchParams.set('league', league)
  const response = await fetch(url, {
    headers: { 'X-Api-Key': basketballKey.value() },
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`API Ninjas respondió HTTP ${response.status}.`)
  const games = await response.json()
  if (!Array.isArray(games)) throw new Error(games.error || 'API Ninjas devolvió una respuesta inesperada.')
  return games.map(basketballRecord)
}

function cleanChoice(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function findOddsMarket(row, sport, live = false) {
  const sources = row.bookmakers?.length
    ? row.bookmakers.map((bookmaker) => ({ bookmaker: bookmaker.name, markets: bookmaker.bets || [] }))
    : [{ bookmaker: row.bookmaker?.name || row.bookmaker || null, markets: row.odds || [] }]
  for (const source of sources) {
    for (const market of source.markets) {
      const marketName = String(market.name || '').toLowerCase()
      const values = market.values || []
      const supportedMarket = sport === 'futbol'
        ? /match winner|match result|1x2|full time result/.test(marketName)
        : /home\/away|winner|moneyline/.test(marketName)
      if (!supportedMarket) continue
      const getOdd = (aliases) => {
        const match = values.find((item) => aliases.includes(cleanChoice(item.value)))
        if (!match || match.suspended === true || !Number.isFinite(Number(match.odd)) || Number(match.odd) <= 1) return null
        return Number(match.odd)
      }
      const local = getOdd(['home', 'local', '1'])
      const empate = sport === 'futbol' ? getOdd(['draw', 'tie', 'empate', 'x']) : null
      const visitante = getOdd(['away', 'visitor', 'visitante', '2'])
      if (local || visitante || empate) return { bookmaker: source.bookmaker, market: market.name, local, empate, visitante, marketSuspended: values.length > 0 && values.every((item) => item.suspended === true) }
    }
  }
  return null
}

async function responseData(url, key, header = 'x-apisports-key') {
  const response = await fetch(url, { headers: { [header]: key }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Proveedor de cuotas respondió HTTP ${response.status}.`)
  const json = await response.json()
  if (json.errors && Object.keys(json.errors).length) throw new Error(`Proveedor de cuotas: ${JSON.stringify(json.errors)}`)
  return json.response || []
}

async function saveOdds(provider, gameId, row, sport, sourceType, ttlMs, targetDocumentId = null) {
  const documentId = targetDocumentId || (sport === 'futbol' ? `api_football_${gameId}` : `api_basketball_${String(gameId).replace(/[^a-zA-Z0-9_-]/g, '_')}`)
  const ref = db.collection('partidos').doc(documentId)
  const market = row ? findOddsMarket(row, sport, sourceType === 'live') : null
  const now = Date.now()
  const providerUpdate = row?.update ? new Date(row.update) : null
  const updatedAt = providerUpdate && Number.isFinite(providerUpdate.getTime()) ? Timestamp.fromDate(providerUpdate) : Timestamp.now()
  const blocked = sourceType === 'live' && (row?.status?.blocked || row?.status?.stopped || row?.status?.finished)
  const available = !!market && !!market.bookmaker && !market.marketSuspended && !blocked
  const data = {
    cuotasProveedor: sport === 'futbol' ? 'API-Football' : 'API-Basketball',
    cuotasTipo: sourceType,
    cuotasCasa: market?.bookmaker || null,
    cuotasMercado: market?.market || null,
    cuotasEstado: blocked ? 'bloqueadas' : available ? 'disponibles' : 'no_disponibles',
    cuotasActualizadasEn: updatedAt,
    cuotasVigentesHasta: available ? Timestamp.fromMillis(now + ttlMs) : null,
    cLocal: available ? market.local : null,
    cEmpate: available ? market.empate : null,
    cVisitante: available ? market.visitante : null
  }
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    let base = {}
    if (!snapshot.exists) {
      if (sport !== 'futbol' || sourceType !== 'pre-match' || !row?.fixture?.id) return
      base = {
        local: row.teams?.home?.name || 'Equipo local', visitante: row.teams?.away?.name || 'Equipo visitante',
        deporte: 'futbol', proveedor: 'api-football', providerId: String(gameId), origen: 'api', estado: 'programado',
        estadoProveedor: 'NS', fecha: timestampOrNull(row.fixture?.date), competicion: row.league?.name || null,
        pais: row.league?.country || null, temporada: row.league?.season ?? null,
        marcadorLocal: null, marcadorVisitante: null
      }
    } else if (snapshot.get('origen') !== 'api') return
    else if (sport === 'futbol' && snapshot.get('proveedor') !== 'api-football') return
    else if (sport === 'baloncesto' && snapshot.get('proveedor') === 'api-ninjas' && !snapshot.get('apiBasketballGameId')) return
    transaction.set(ref, { ...base, ...data }, { merge: true })
  })
}

async function syncFootballLiveOdds() {
  const rows = await responseData('https://v3.football.api-sports.io/odds/live', footballKey.value())
  const found = new Set()
  for (const row of rows) {
    const id = row.fixture?.id
    if (!id) continue
    found.add(String(id))
    await saveOdds('api-football', id, row, 'futbol', 'live', 70 * 60_000)
  }
  // A live snapshot expires quickly; remove old values from API-owned live fixtures.
  const snapshot = await db.collection('partidos').get()
  const stale = snapshot.docs.filter((document) => document.get('origen') === 'api' && document.get('proveedor') === 'api-football' && document.get('estado') === 'en_vivo' && !found.has(String(document.get('providerId'))))
  for (const document of stale) {
    await document.ref.set({ cuotasEstado: 'no_disponibles', cuotasVigentesHasta: null, cLocal: null, cEmpate: null, cVisitante: null }, { merge: true })
  }
  return rows.length
}

async function syncFootballPreMatchOdds(date) {
  const url = new URL('https://v3.football.api-sports.io/odds')
  url.searchParams.set('date', date)
  const rows = await responseData(url, footballKey.value())
  for (const row of rows) {
    const id = row.fixture?.id
    if (id) await saveOdds('api-football', id, row, 'futbol', 'pre-match', 4 * 60 * 60_000)
  }
  return rows.length
}

async function syncFootballLiveBetCatalog() {
  const rows = await responseData('https://v3.football.api-sports.io/odds/live/bets', footballKey.value())
  await db.collection('sincronizacion_partidos').doc('api-football-live-bets').set({
    proveedor: 'api-football', estado: 'correcto', actualizadoEn: Timestamp.now(),
    mercadosEnVivo: rows.map(({ id, name }) => ({ id, name }))
  }, { merge: true })
  return rows.length
}

function normalizedTeam(value) {
  return cleanChoice(value).replace(/[^a-z0-9]/g, '')
}

async function mapAndSyncBasketballOdds() {
  const date = new Date().toISOString().slice(0, 10)
  const gamesUrl = new URL('https://v1.basketball.api-sports.io/games')
  gamesUrl.searchParams.set('date', date)
  const apiGames = await responseData(gamesUrl, apiSportsBasketballKey.value())
  const documents = await db.collection('partidos').get()
  const candidates = documents.docs.filter((document) => {
    const data = document.data()
    return data.origen === 'api' && data.proveedor === 'api-ninjas' && data.deporte === 'baloncesto' && data.estado === 'programado'
  })
  let updated = 0
  for (const gameEntry of apiGames) {
    const game = gameEntry.game || {}
    const teams = gameEntry.teams || {}
    const homeName = normalizedTeam(teams.home?.name)
    const awayName = normalizedTeam(teams.away?.name)
    if (!game.id || !homeName || !awayName) continue
    const matchingDoc = candidates.find((document) => {
      const data = document.data()
      const storedDate = data.fecha?.toMillis?.() || new Date(data.fecha || 0).getTime()
      const apiDate = game.timestamp ? Number(game.timestamp) * 1000 : new Date(game.date || 0).getTime()
      return normalizedTeam(data.local) === homeName && normalizedTeam(data.visitante) === awayName && Number.isFinite(storedDate) && Number.isFinite(apiDate) && Math.abs(storedDate - apiDate) <= 6 * 60 * 60_000
    })
    if (!matchingDoc) continue
    const previousUpdate = matchingDoc.get('cuotasActualizadasEn')?.toMillis?.() || 0
    if (Date.now() - previousUpdate < 23 * 60 * 60_000) continue
    await matchingDoc.ref.set({ apiBasketballGameId: String(game.id) }, { merge: true })
    const oddsUrl = new URL('https://v1.basketball.api-sports.io/odds')
    oddsUrl.searchParams.set('game', String(game.id))
    const oddsRows = await responseData(oddsUrl, apiSportsBasketballKey.value())
    await saveOdds('api-basketball', game.id, oddsRows[0] || null, 'baloncesto', 'pre-match', 26 * 60 * 60_000, matchingDoc.id)
    updated += 1
    if (updated >= 25) break
  }
  return updated
}

async function shouldSync(provider, intervalMs) {
  const snapshot = await db.collection('sincronizacion_partidos').doc(provider).get()
  const lastSuccess = snapshot.get('ultimaSincronizacionExitosa')?.toMillis?.() || 0
  return Date.now() - lastSuccess >= intervalMs
}

async function runProvider(provider, fetchRecords) {
  await saveSyncState(provider, { estado: 'en_progreso', ultimoIntento: Timestamp.now(), ultimoError: null })
  try {
    const records = await fetchRecords()
    const totals = await syncRecords(provider, records)
    await saveSyncState(provider, {
      estado: 'correcto', ultimaSincronizacionExitosa: Timestamp.now(), ultimoError: null, ...totals
    })
    logger.info('Sincronización de partidos completada', { provider, ...totals })
    return { provider, ...totals }
  } catch (error) {
    await saveSyncState(provider, { estado: 'error', ultimoError: String(error?.message || error) })
    logger.error('Falló la sincronización de partidos', { provider, error })
    throw error
  }
}

export const sincronizarPartidos = onSchedule({
  schedule: 'every 60 minutes',
  timeZone: 'UTC',
  region: 'us-central1',
  maxInstances: 1,
  timeoutSeconds: 300,
  retryCount: 2,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 300,
  secrets: [footballKey, basketballKey]
}, async (event) => {
  const scheduledAt = new Date(event.scheduleTime || Date.now())
  const date = scheduledAt.toISOString().slice(0, 10)
  const tasks = []

  if (await shouldSync('api-football', 55 * 60_000)) {
    tasks.push(runProvider('api-football', () => fetchFootball(date)))
  }

  // API Ninjas free data has no live scores. Sync all four schedules/tables at
  // most every six hours, keeping this well below a one-call-per-league-hour loop.
  if (await shouldSync('api-ninjas', 5 * 60 * 60_000)) {
    tasks.push(runProvider('api-ninjas', async () => {
      const batches = await Promise.all(basketballLeagues.map(fetchBasketball))
      return batches.flat()
    }))
  }

  if (!tasks.length) return logger.info('Sincronización omitida: aún no corresponde por intervalo.')
  const results = await Promise.allSettled(tasks)
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'Uno o más proveedores no pudieron sincronizarse.')
})

export const sincronizarCuotas = onSchedule({
  schedule: 'every 60 minutes',
  timeZone: 'UTC',
  region: 'us-central1',
  maxInstances: 1,
  timeoutSeconds: 300,
  retryCount: 2,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 300,
  secrets: [footballKey, apiSportsBasketballKey]
}, async (event) => {
  const scheduledAt = new Date(event.scheduleTime || Date.now())
  const tasks = []

  if (await shouldSync('api-football-live-odds', 55 * 60_000)) {
    tasks.push(runProvider('api-football-live-odds', syncFootballLiveOdds))
  }
  if (await shouldSync('api-football-live-markets', 23 * 60 * 60_000)) {
    tasks.push(runProvider('api-football-live-markets', syncFootballLiveBetCatalog))
  }
  if (scheduledAt.getUTCHours() % 3 === 0 && await shouldSync('api-football-pre-match-odds', 2 * 60 * 60_000 + 50 * 60_000)) {
    const tomorrow = new Date(scheduledAt.getTime() + 24 * 60 * 60_000).toISOString().slice(0, 10)
    tasks.push(runProvider('api-football-pre-match-odds', () => syncFootballPreMatchOdds(tomorrow)))
  }
  if (scheduledAt.getUTCHours() === 12 && await shouldSync('api-basketball-odds', 23 * 60 * 60_000)) {
    tasks.push(runProvider('api-basketball-odds', mapAndSyncBasketballOdds))
  }

  if (!tasks.length) return logger.info('Sincronización de cuotas omitida: aún no corresponde por intervalo.')
  const results = await Promise.allSettled(tasks)
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'Uno o más mercados no pudieron sincronizarse.')
})

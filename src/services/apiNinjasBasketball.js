const BASE_URL = 'https://api.api-ninjas.com/v1'
const API_KEY = import.meta.env.VITE_API_NINJAS_KEY
const cache = new Map()
const CACHE_MS = 60_000

export const basketballLeagues = [
  { code: 'nba', name: 'NBA' },
  { code: 'wnba', name: 'WNBA' },
  { code: 'ncaab', name: 'NCAA Basketball' },
  { code: 'ncaaw', name: "NCAA Women's Basketball" }
]

async function get(path, params = {}, ttl = CACHE_MS) {
  if (!API_KEY) throw new Error('Falta VITE_API_NINJAS_KEY en .env.local.')
  const url = new URL(`${BASE_URL}/${path}`)
  Object.entries(params).forEach(([name, value]) => value !== '' && value != null && url.searchParams.set(name, value))
  const key = url.toString()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < ttl) return cached.data
  let response
  try { response = await fetch(url, { headers: { 'X-Api-Key': API_KEY } }) }
  catch { throw new Error('No se pudo conectar con API Ninjas (red o CORS).') }
  if (!response.ok) {
    let detail = ''
    try { const body = await response.clone().json(); detail = body.error || body.message || '' } catch {}
    throw new Error(`API Ninjas respondió HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error(data.error || 'API Ninjas devolvió una respuesta inesperada.')
  cache.set(key, { at: Date.now(), data })
  return data
}

function normalizeGame(game) {
  const status = game.status || 'scheduled'
  return {
    id: game.game_id, sport: 'basketball', date: game.start_time || game.date,
    status: ({ scheduled: 'Programado', in_progress: 'En juego', final: 'Finalizado', postponed: 'Aplazado', canceled: 'Cancelado', suspended: 'Suspendido', delayed: 'Demorado' })[status] || status,
    statusShort: ({ scheduled: 'NS', in_progress: 'LIVE', final: 'FT', postponed: 'PST', canceled: 'CANC', suspended: 'SUSP', delayed: 'DEL' })[status] || status,
    elapsed: game.period ? `P${game.period}` : null,
    home: game.home_team?.name || 'Equipo no disponible', away: game.away_team?.name || 'Equipo no disponible',
    homeLogo: null, awayLogo: null, league: game.league || 'Liga no disponible', country: null,
    season: game.season_label || game.season || null, homeScore: game.home_score ?? null, awayScore: game.away_score ?? null,
    periodScores: game.period_scores || null, venue: game.venue || null, original: game
  }
}

export const apiNinjasBasketball = {
  games: async (params = {}) => (await get('basketballgames', params)).map(normalizeGame),
  teams: (params = {}) => get('basketballteams', params, 6 * 60 * 60_000),
  players: (params = {}) => get('basketballplayers', params, 6 * 60 * 60_000),
  standings: (params = {}) => get('basketballstandings', params, 60 * 60_000)
}

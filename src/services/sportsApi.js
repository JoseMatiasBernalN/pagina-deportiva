const FOOTBALL = 'https://v3.football.api-sports.io'
const BASKETBALL = 'https://v1.basketball.api-sports.io'
const cache = new Map()
const CACHE_MS = 60_000

const keys = {
  football: import.meta.env.VITE_API_FOOTBALL_KEY,
  basketball: import.meta.env.VITE_API_BASKETBALL_KEY
}

export class SportsApiError extends Error {
  constructor(message, code = 'API_ERROR') { super(message); this.code = code }
}

async function request(sport, endpoint, params = {}, ttl = CACHE_MS) {
  if (!keys[sport]) throw new SportsApiError(`Falta configurar VITE_API_${sport.toUpperCase()}_KEY en .env.local`, 'NO_KEY')
  const url = new URL(`${sport === 'football' ? FOOTBALL : BASKETBALL}/${endpoint}`)
  Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && url.searchParams.set(key, value))
  const cacheKey = url.toString()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < ttl) return cached.data
  let response
  try {
    response = await fetch(url, { headers: { 'x-apisports-key': keys[sport] } })
  } catch {
    throw new SportsApiError('No se pudo conectar con API-Sports. Comprueba internet y CORS.', 'NETWORK_ERROR')
  }
  if (!response.ok) {
    let detail = ''
    try { const body = await response.clone().json(); detail = JSON.stringify(body.errors || body.message || '') } catch {}
    throw new SportsApiError(`API-Sports respondió HTTP ${response.status}${detail ? `: ${detail}` : ''}`, 'HTTP_ERROR')
  }
  const json = await response.json()
  if (json.errors && Object.keys(json.errors).length) throw new SportsApiError(`API-Sports: ${JSON.stringify(json.errors)}`, 'PROVIDER_ERROR')
  const data = json.response || []
  cache.set(cacheKey, { at: Date.now(), data })
  return data
}

const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

export function normalizeFootballFixture(item) {
  const fixture = item.fixture || {}
  const teams = item.teams || {}
  const goals = item.goals || {}
  return {
    id: fixture.id, sport: 'football', date: fixture.date, timestamp: fixture.timestamp,
    status: fixture.status?.long || 'Estado no disponible', statusShort: fixture.status?.short || '',
    elapsed: fixture.status?.elapsed, home: teams.home?.name || 'Equipo no disponible',
    away: teams.away?.name || 'Equipo no disponible', homeLogo: teams.home?.logo || null,
    awayLogo: teams.away?.logo || null, league: item.league?.name || 'Competición no disponible',
    country: item.league?.country || null, leagueLogo: item.league?.logo || null,
    season: item.league?.season || null, homeScore: goals.home, awayScore: goals.away,
    events: item.events || [], statistics: item.statistics || [], players: item.players || []
  }
}

export function normalizeBasketballGame(item) {
  const game = item.game || {}
  const teams = item.teams || {}
  const scores = item.scores || {}
  return {
    id: game.id, sport: 'basketball', date: game.date, timestamp: game.timestamp,
    status: game.status?.long || 'Estado no disponible', statusShort: game.status?.short || '',
    home: teams.home?.name || 'Equipo no disponible', away: teams.away?.name || 'Equipo no disponible',
    homeLogo: teams.home?.logo || null, awayLogo: teams.away?.logo || null,
    league: item.league?.name || 'Competición no disponible', country: item.country?.name || null,
    season: item.league?.season || null, homeScore: scores.home?.total ?? scores.home?.quarter_1 ?? null,
    awayScore: scores.away?.total ?? scores.away?.quarter_1 ?? null
  }
}

export const footballApi = {
  live: async () => (await request('football', 'fixtures', { live: 'all' }, 15_000)).map(normalizeFootballFixture),
  byDate: async (date) => (await request('football', 'fixtures', { date })).map(normalizeFootballFixture),
  next: async (count = 20) => (await request('football', 'fixtures', { next: count })).map(normalizeFootballFixture),
  recent: async (count = 20) => (await request('football', 'fixtures', { last: count })).map(normalizeFootballFixture),
  leagues: (params = {}) => request('football', 'leagues', params, 24 * 60 * 60_000),
  teams: (params = {}) => request('football', 'teams', params, 24 * 60 * 60_000),
  players: (params = {}) => request('football', 'players', params, 6 * 60 * 60_000),
  playerProfiles: (params = {}) => request('football', 'players/profiles', params, 6 * 60 * 60_000),
  teamStatistics: (params = {}) => request('football', 'teams/statistics', params, 60 * 60_000),
  fixtureDetails: (id) => request('football', 'fixtures', { id }, 60_000),
  events: (fixture) => request('football', 'fixtures/events', { fixture }, 15_000),
  statistics: (fixture) => request('football', 'fixtures/statistics', { fixture }, 60_000),
  // Odds use their own documented refresh windows; these requests run only
  // when the betting view asks for them, never once per component render.
  liveOdds: (params = {}) => request('football', 'odds/live', params, 60_000),
  odds: (params = {}) => request('football', 'odds', params, 3 * 60 * 60_000)
}

export const basketballApi = {
  live: async () => (await request('basketball', 'games', { live: 'all' }, 15_000)).map(normalizeBasketballGame),
  byDate: async (date = dateToday()) => (await request('basketball', 'games', { date })).map(normalizeBasketballGame),
  games: async (params = {}) => (await request('basketball', 'games', params)).map(normalizeBasketballGame),
  leagues: (params = {}) => request('basketball', 'leagues', params, 24 * 60 * 60_000),
  teams: (params = {}) => request('basketball', 'teams', params, 24 * 60 * 60_000),
  players: (params = {}) => request('basketball', 'players', params, 6 * 60 * 60_000),
  standings: (params = {}) => request('basketball', 'standings', params, 60 * 60_000),
  teamSeasonStats: (params = {}) => request('basketball', 'statistics', params, 60 * 60_000),
  teamStatistics: (id) => request('basketball', 'games/statistics/teams', { id }, 60_000),
  playerStatistics: (id) => request('basketball', 'games/statistics/players', { id }, 60_000),
  odds: (params = {}) => request('basketball', 'odds', params, 24 * 60 * 60_000)
}

export function clearSportsApiCache() { cache.clear() }


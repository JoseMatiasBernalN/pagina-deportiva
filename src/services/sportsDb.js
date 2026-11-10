const key = import.meta.env.VITE_THESPORTSDB_KEY || '123'
const cache = new Map()

async function search(kind, value) {
  if (!value?.trim()) return null
  const param = kind === 'team' ? 't' : 'p'
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/search${kind === 'team' ? 'teams' : 'players'}.php?${param}=${encodeURIComponent(value.trim())}`
  if (cache.has(url)) return cache.get(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`TheSportsDB ${response.status}`)
  const data = await response.json()
  const result = data[kind === 'team' ? 'teams' : 'player']?.[0] || null
  cache.set(url, result)
  return result
}

export const sportsDb = {
  team: (name) => search('team', name),
  player: (name) => search('player', name)
}

// RDAP (Registration Data Access Protocol) lookup for domain age detection.
// Queries rdap.org, a public aggregator that routes to the correct registry per TLD.
// Only the registered domain (eTLD+1) is sent — never the full URL path.
// Results are persisted to chrome.storage.session so the cache survives
// service worker restarts (service workers are terminated after ~30s of inactivity).

const RDAP_BASE = 'https://rdap.org/domain/'
const TIMEOUT_MS = 5_000
const CACHE_TTL_MS = 60 * 60 * 1_000   // 1 hour
const CACHE_PREFIX = 'rdap:'

interface CacheEntry {
  value: number | null
  exp: number
}

async function readCache(domain: string): Promise<{ hit: boolean; value: number | null }> {
  try {
    const key = CACHE_PREFIX + domain
    const stored = await chrome.storage.session.get(key)
    const entry = stored[key] as CacheEntry | undefined
    if (!entry || Date.now() > entry.exp) return { hit: false, value: null }
    return { hit: true, value: entry.value }
  } catch {
    return { hit: false, value: null }
  }
}

async function writeCache(domain: string, value: number | null): Promise<void> {
  try {
    const key = CACHE_PREFIX + domain
    const entry: CacheEntry = { value, exp: Date.now() + CACHE_TTL_MS }
    await chrome.storage.session.set({ [key]: entry })
  } catch {
    // Storage write failure is non-fatal — skip caching.
  }
}

// Returns the domain's age in days since registration, or null if the lookup
// fails (network error, timeout, registry not available, malformed response).
// Failure is treated as "no information" — callers must not penalise on null.
export async function fetchDomainAge(domain: string): Promise<number | null> {
  const registrable = extractRegistrable(domain)
  if (!registrable) return null

  const cached = await readCache(registrable)
  if (cached.hit) return cached.value

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(`${RDAP_BASE}${encodeURIComponent(registrable)}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) {
      await writeCache(registrable, null)
      return null
    }

    const data: unknown = await response.json()
    const ageDays = parseRegistrationAge(data)
    await writeCache(registrable, ageDays)
    return ageDays
  } catch {
    // AbortError (timeout), network failure, JSON parse error — fail open.
    await writeCache(registrable, null)
    return null
  }
}

function parseRegistrationAge(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null

  const events = (data as Record<string, unknown>).events
  if (!Array.isArray(events)) return null

  const regEvent = events.find(
    (e): e is { eventAction: string; eventDate: string } =>
      typeof e === 'object' &&
      e !== null &&
      (e as Record<string, unknown>).eventAction === 'registration',
  )
  if (!regEvent?.eventDate) return null

  const regDate = new Date(regEvent.eventDate)
  if (isNaN(regDate.getTime())) return null

  return Math.floor((Date.now() - regDate.getTime()) / 86_400_000)
}

function extractRegistrable(hostname: string): string | null {
  const parts = hostname.split('.')
  if (parts.length < 2) return null
  return parts.slice(-2).join('.')
}

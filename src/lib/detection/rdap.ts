// RDAP (Registration Data Access Protocol) lookup for domain age detection.
// Queries rdap.org, a public aggregator that routes to the correct registry per TLD.
// Only the registered domain (eTLD+1) is sent — never the full URL path.
// All lookups are cached in memory for the lifetime of the service worker.

const RDAP_BASE = 'https://rdap.org/domain/'
const TIMEOUT_MS = 5_000

const cache = new Map<string, number | null>()

// Returns the domain's age in days since registration, or null if the lookup
// fails (network error, timeout, registry not available, malformed response).
// Failure is treated as "no information" — callers must not penalise on null.
export async function fetchDomainAge(domain: string): Promise<number | null> {
  const registrable = extractRegistrable(domain)
  if (!registrable) return null

  if (cache.has(registrable)) return cache.get(registrable)!

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(`${RDAP_BASE}${encodeURIComponent(registrable)}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) {
      cache.set(registrable, null)
      return null
    }

    const data: unknown = await response.json()
    const ageDays = parseRegistrationAge(data)
    cache.set(registrable, ageDays)
    return ageDays
  } catch {
    // AbortError (timeout), network failure, or JSON parse error — fail open.
    cache.set(registrable, null)
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

// Returns the registrable domain (last two DNS labels).
// Covers the common TLD shapes: .com, .net, .org, .io, .xyz, .tk, etc.
// Compound ccTLDs like .co.uk are out of scope for the MVP.
function extractRegistrable(hostname: string): string | null {
  const parts = hostname.split('.')
  if (parts.length < 2) return null
  return parts.slice(-2).join('.')
}

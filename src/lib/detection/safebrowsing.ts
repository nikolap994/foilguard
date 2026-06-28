// Google Safe Browsing Lookup API v4
// Requires an API key configured in options. Free tier: 10k lookups/day.
// Key is stored in chrome.storage.sync so it syncs across devices.

const CACHE_TTL = 10 * 60 * 1000 // 10 min — Safe Browsing cache minimum
const cache = new Map<string, { safe: boolean; threat?: string; ts: number }>()

export async function checkSafeBrowsing(url: string): Promise<{ safe: boolean; threat?: string } | null> {
  const apiKey = await getApiKey()
  if (!apiKey) return null

  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { safe: cached.safe, threat: cached.threat }
  }

  try {
    const body = {
      client: { clientId: 'foilguard', clientVersion: '0.4.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    }

    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    )

    if (!res.ok) return null

    const data = await res.json() as { matches?: Array<{ threatType: string }> }
    const safe = !data.matches || data.matches.length === 0
    const threat = data.matches?.[0]?.threatType

    cache.set(url, { safe, threat, ts: Date.now() })
    return { safe, threat }
  } catch {
    return null
  }
}

async function getApiKey(): Promise<string | null> {
  const s = await chrome.storage.sync.get('foilguard_personal_policy')
  const policy = s['foilguard_personal_policy'] as { safeBrowsingApiKey?: string } | undefined
  return policy?.safeBrowsingApiKey?.trim() || null
}

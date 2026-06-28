import { calculateRiskScore, calculateRiskScoreSync } from '../lib/detection/score'
import { extendTopDomains } from '../lib/detection/domains'
import { getPolicy } from '../lib/policy'
import { logEvent } from '../lib/audit'
import type { RiskResult } from '../lib/detection/score'

// ─── Remote domain list sync ───────────────────────────────────────────────
// Updating top-domains.json in the repo propagates to all installed users
// within 24 hours — no extension update required.
const REMOTE_DOMAINS_URL =
  'https://raw.githubusercontent.com/nikolap994/foilguard/master/src/data/top-domains.json'
const REMOTE_KEY = 'foilguard_remote_domains'
const REMOTE_TS_KEY = 'foilguard_remote_domains_ts'
const UPDATE_ALARM = 'foilguard-domains-refresh'
const STALE_MS = 24 * 60 * 60 * 1000

// Tracks whether this worker instance already merged cached remote domains.
// Reset to false each time the service worker restarts (module re-initialised).
let remoteMerged = false

async function applyCachedDomains(): Promise<void> {
  if (remoteMerged) return
  const stored = await chrome.storage.local.get(REMOTE_KEY)
  const cached = stored[REMOTE_KEY]
  if (Array.isArray(cached)) extendTopDomains(cached as string[])
  remoteMerged = true
}

async function fetchRemoteDomains(): Promise<void> {
  try {
    const res = await fetch(REMOTE_DOMAINS_URL, { cache: 'no-store' })
    if (!res.ok) return
    const list: unknown = await res.json()
    if (!Array.isArray(list)) return
    const domains = (list as unknown[]).filter((d): d is string => typeof d === 'string')
    await chrome.storage.local.set({ [REMOTE_KEY]: domains, [REMOTE_TS_KEY]: Date.now() })
    extendTopDomains(domains)
    remoteMerged = true
  } catch { /* network unavailable — bundled list stays active */ }
}

async function syncDomainsIfStale(): Promise<void> {
  const stored = await chrome.storage.local.get(REMOTE_TS_KEY)
  const ts = stored[REMOTE_TS_KEY] as number | undefined
  if (!ts || Date.now() - ts > STALE_MS) {
    await fetchRemoteDomains()
  } else {
    await applyCachedDomains()
  }
}

// Apply any cached remote domains immediately when the worker starts.
// This covers restarts triggered by navigation events — the bundled list
// is always valid, remote extras kick in as soon as storage resolves.
applyCachedDomains()

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) fetchRemoteDomains()
})
// ──────────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.create({
    id: 'foilguard-check',
    title: 'Check this link with FoilGuard',
    contexts: ['link'],
  })

  // Create the 24-hour refresh alarm (idempotent — Chrome deduplicates by name).
  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 60 * 24 })

  // Fetch immediately on install/update so users get the latest list right away.
  await syncDomainsIfStale()

  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/onboarding.html') })
  }
})

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'foilguard-check' || !info.linkUrl) return
  let hostname: string
  try {
    hostname = new URL(info.linkUrl).hostname
    if (!hostname) return
  } catch {
    return
  }
  const result = calculateRiskScoreSync(hostname)
  const safe = result.score === 0
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/foilguard-48.png'),
    title: safe ? `${hostname} looks safe` : `Risk score ${result.score} — ${hostname}`,
    message: safe ? 'No threats detected.' : (result.reasons[0] ?? 'Potential threat detected.'),
  })
})

// Intercept navigation before the page loads.
// Runs a fast sync score — no RDAP network call, negligible delay.
chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return

  let hostname: string
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || !parsed.protocol.startsWith('http')) return
    hostname = parsed.hostname
  } catch {
    return
  }

  const policy = await getPolicy()
  const result = calculateRiskScoreSync(hostname)

  // Admin-managed allowlist takes priority over everything
  if (policy.customAllowlist.includes(result.domain)) return

  // Admin-managed blocklist forces a block regardless of score
  const forceBlock = policy.customBlocklist.includes(result.domain)

  if (!forceBlock && result.score < policy.blockThreshold) return

  // Check if the user already chose to proceed past this domain this session
  const bypassKey = `bypass:${result.domain}`
  const session = await chrome.storage.session.get(bypassKey)
  if (session[bypassKey] && !forceBlock) return

  if (policy.reportOnly) {
    // Log but do not redirect — useful for rollout monitoring
    await logEvent({ domain: result.domain, score: result.score, reasons: result.reasons, action: 'warned' })
    return
  }

  await logEvent({ domain: result.domain, score: result.score, reasons: result.reasons, action: 'blocked' })

  const warningUrl =
    chrome.runtime.getURL('src/warning/warning.html') +
    `?url=${encodeURIComponent(url)}` +
    `&score=${result.score}` +
    `&domain=${encodeURIComponent(result.domain)}` +
    `&reasons=${encodeURIComponent(JSON.stringify(result.reasons))}` +
    `&forceBlock=${forceBlock}`

  await chrome.tabs.update(tabId, { url: warningUrl })
})

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === 'test-domain' && typeof msg.hostname === 'string') {
    calculateRiskScore(msg.hostname).then(respond)
    return true
  }

  if (msg?.type === 'get-policy') {
    getPolicy().then(respond)
    return true
  }

  return false
})

chrome.webNavigation.onCompleted.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return

  let result: RiskResult

  try {
    const { hostname, protocol } = new URL(url)
    if (!hostname || !protocol.startsWith('http')) return

    result = await calculateRiskScore(hostname)
  } catch {
    return
  }

  const policy = await getPolicy()

  if (policy.customAllowlist.includes(result.domain)) {
    await chrome.storage.session.set({ [tabId]: { ...result, score: 0 } })
    await chrome.action.setBadgeText({ text: '', tabId })
    return
  }

  await chrome.storage.session.set({ [tabId]: result })
  await updateBadge(tabId, result.score, policy.blockThreshold)
})

chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') {
    chrome.storage.session.remove(String(tabId))
    chrome.action.setBadgeText({ text: '', tabId })
  }
})

async function updateBadge(tabId: number, score: number, blockThreshold: number): Promise<void> {
  if (score === 0) {
    await chrome.action.setBadgeText({ text: '', tabId })
    return
  }

  const color =
    score >= blockThreshold ? '#ef4444' :
    score >= 40             ? '#f59e0b' :
                              '#22c55e'

  await chrome.action.setBadgeBackgroundColor({ color, tabId })
  await chrome.action.setBadgeText({ text: String(score), tabId })
}

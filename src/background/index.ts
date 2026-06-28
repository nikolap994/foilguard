import { calculateRiskScore, calculateRiskScoreSync } from '../lib/detection/score'
import { extendTopDomains, TOP_DOMAINS } from '../lib/detection/domains'
import { getPolicy } from '../lib/policy'
import { logEvent, getAuditLog } from '../lib/audit'
import { checkSafeBrowsing } from '../lib/detection/safebrowsing'
import type { RiskResult } from '../lib/detection/score'

// ─── Remote domain list sync ───────────────────────────────────────────────
const REMOTE_DOMAINS_URL =
  'https://raw.githubusercontent.com/nikolap994/foilguard/master/src/data/top-domains.json'
const REMOTE_KEY = 'foilguard_remote_domains'
const REMOTE_TS_KEY = 'foilguard_remote_domains_ts'
const UPDATE_ALARM = 'foilguard-domains-refresh'
const STALE_MS = 24 * 60 * 60 * 1000

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

applyCachedDomains()

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) fetchRemoteDomains()
})
// ──────────────────────────────────────────────────────────────────────────

// ─── Redirect chain tracking ───────────────────────────────────────────────
// Tracks the number of server-initiated redirects per tab within the current
// navigation so we can boost the score of the final destination when a chain
// is suspiciously long (≥3 hops within 3 seconds).
const tabRedirects = new Map<number, { count: number; firstMs: number }>()

chrome.webNavigation.onBeforeRedirect.addListener(({ tabId, frameId }) => {
  if (frameId !== 0) return
  const entry = tabRedirects.get(tabId) ?? { count: 0, firstMs: Date.now() }
  tabRedirects.set(tabId, { count: entry.count + 1, firstMs: entry.firstMs })
})
// ──────────────────────────────────────────────────────────────────────────

// ─── Daily block counter ───────────────────────────────────────────────────
async function getTodayBlockCount(): Promise<number> {
  try {
    const log = await getAuditLog()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    return log.filter(e => e.ts >= startOfDay.getTime() && (e.action === 'blocked' || e.action === 'popup')).length
  } catch {
    return 0
  }
}
// ──────────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.create({
    id: 'foilguard-check',
    title: 'Check this link with FoilGuard',
    contexts: ['link'],
  })

  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 60 * 24 })
  await syncDomainsIfStale()

  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/onboarding.html') })
  }
})

// ─── Context menu → side panel scan ───────────────────────────────────────
const SCAN_KEY = 'foilguard_sidepanel_scan'

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'foilguard-check' || !info.linkUrl) return
  let hostname: string
  try {
    hostname = new URL(info.linkUrl).hostname
    if (!hostname) return
  } catch {
    return
  }

  const result = calculateRiskScoreSync(hostname)

  // Store scan result for the side panel to pick up
  await chrome.storage.session.set({
    [SCAN_KEY]: {
      domain: result.domain,
      score: result.score,
      reasons: result.reasons,
      url: info.linkUrl,
    },
  })

  // Open the side panel if the API is available (Chrome 114+)
  if (tab?.id && chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId: tab.id })
  } else {
    // Fallback: notification for older Chrome
    const safe = result.score === 0
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/foilguard-48.png'),
      title: safe ? `${hostname} looks safe` : `Risk score ${result.score} — ${hostname}`,
      message: safe ? 'No threats detected.' : (result.reasons[0] ?? 'Potential threat detected.'),
    })
  }
})
// ──────────────────────────────────────────────────────────────────────────

// ─── Navigation blocker ────────────────────────────────────────────────────
// Suspicious URL path keywords that, when combined with a non-zero domain risk score,
// suggest a credential-harvesting page.
const PATH_KEYWORDS = ['/login', '/signin', '/verify', '/secure', '/account', '/update', '/password', '/auth']

chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return

  let hostname: string
  let protocol: string
  let pathname: string
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || !parsed.protocol.startsWith('http')) return
    hostname = parsed.hostname
    protocol = parsed.protocol
    pathname = parsed.pathname.toLowerCase()
  } catch {
    return
  }

  const policy = await getPolicy()
  let result = calculateRiskScoreSync(hostname)

  // Redirect chain boost: 3+ hops in under 3 seconds → +20 to destination score
  const redir = tabRedirects.get(tabId)
  if (redir && redir.count >= 3 && Date.now() - redir.firstMs < 3000) {
    result = {
      ...result,
      score: Math.min(result.score + 20, 100),
      reasons: [
        ...result.reasons,
        `This page was reached through ${redir.count} automatic redirects in rapid succession — a common pattern used by ad networks and phishing redirect chains`,
      ],
    }
    tabRedirects.delete(tabId)
  }

  // Plain-HTTP signal: known brand served over unencrypted connection
  if (protocol === 'http:' && result.score === 0) {
    const base = result.domain.split('.')[0]
    if (TOP_DOMAINS.has(base)) {
      result = {
        ...result,
        score: 30,
        reasons: [
          `This site uses plain HTTP — the real ${base}.com always uses HTTPS. This could be a phishing copy or a network interception attempt`,
        ],
      }
    }
  }

  // Suspicious path signal: if domain already scored > 0 AND path suggests credential harvesting
  if (result.score >= 20) {
    const matchedPath = PATH_KEYWORDS.find(kw => pathname === kw || pathname.startsWith(kw + '/') || pathname.startsWith(kw + '?'))
    if (matchedPath) {
      result = {
        ...result,
        score: Math.min(result.score + 10, 100),
        reasons: [
          ...result.reasons,
          `The URL path '${matchedPath}' combined with other risk signals suggests this could be a credential-harvesting page`,
        ],
      }
    }
  }

  if (policy.customAllowlist.includes(result.domain)) return

  const forceBlock = policy.customBlocklist.includes(result.domain)

  if (!forceBlock && result.score < policy.blockThreshold) return

  const bypassKey = `bypass:${result.domain}`
  const session = await chrome.storage.session.get(bypassKey)
  if (session[bypassKey] && !forceBlock) return

  if (policy.reportOnly) {
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

// ─── Popup & drive-by tab blocking ────────────────────────────────────────
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.openerTabId || !tab.id) return

  const policy = await getPolicy()
  if (!policy.blockPopups) return

  try {
    const win = await chrome.windows.get(tab.windowId)
    if (win.type !== 'popup') return

    const opener = await chrome.tabs.get(tab.openerTabId)
    if (!opener.url) return

    const hostname = new URL(opener.url).hostname
    if (!hostname) return

    const result = calculateRiskScoreSync(hostname)
    if (result.score >= policy.blockThreshold) {
      await chrome.tabs.remove(tab.id)
      await logEvent({
        domain: result.domain,
        score: result.score,
        reasons: ['Popup window blocked — opened by a suspicious page'],
        action: 'popup',
      })
    }
  } catch { /* opener tab or window no longer exists */ }
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

  if (msg?.type === 'popup_suppressed') {
    getPolicy().then(async (policy) => {
      if (!policy.blockPopups) return
      const pageUrl = typeof msg.pageUrl === 'string' ? msg.pageUrl : ''
      let domain = 'unknown'
      try { domain = new URL(pageUrl).hostname } catch { /* ignore */ }
      await logEvent({
        domain,
        score: 0,
        reasons: [`Drive-by popup suppressed${msg.url ? `: ${msg.url}` : ''}`],
        action: 'popup',
      })
    })
    return false
  }

  return false
})

chrome.webNavigation.onCompleted.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return

  // Clear redirect chain tracker for this tab
  tabRedirects.delete(tabId)

  let result: RiskResult
  let hostname: string
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || !parsed.protocol.startsWith('http')) return
    hostname = parsed.hostname
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

  // Safe Browsing check (requires API key in options)
  const sbResult = await checkSafeBrowsing(url)
  if (sbResult && !sbResult.safe) {
    result = {
      ...result,
      score: Math.min(100, result.score + 60),
      reasons: [
        ...result.reasons,
        `Google Safe Browsing flagged this URL as ${sbResult.threat ?? 'a threat'} — do not proceed`,
      ],
    }
  }

  // Visit history trust: if the user has visited this domain 5+ times in the
  // last 6 months it's almost certainly a legitimate site they use regularly.
  if (result.score > 0) {
    try {
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000
      const items = await chrome.history.search({ text: result.domain, startTime: sixMonthsAgo, maxResults: 20 })
      const domainVisits = items.filter(item => {
        try { return new URL(item.url ?? '').hostname.endsWith(result.domain) } catch { return false }
      })
      if (domainVisits.length >= 5) {
        result = { ...result, score: Math.max(0, result.score - 30) }
      }
    } catch { /* history permission unavailable */ }
  }

  await chrome.storage.session.set({ [tabId]: result })
  await updateBadge(tabId, result.score, policy.blockThreshold)
})

chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') {
    chrome.storage.session.remove(String(tabId))
    chrome.action.setBadgeText({ text: '', tabId })
    // Reset redirect counter on new navigation
    tabRedirects.delete(tabId)
  }
})

async function updateBadge(tabId: number, score: number, blockThreshold: number): Promise<void> {
  if (score === 0) {
    // Show today's total block count in a dim badge when the page itself is clean
    const todayCount = await getTodayBlockCount()
    if (todayCount > 0) {
      await chrome.action.setBadgeBackgroundColor({ color: '#1e2533', tabId })
      await chrome.action.setBadgeText({ text: String(todayCount), tabId })
    } else {
      await chrome.action.setBadgeText({ text: '', tabId })
    }
    return
  }

  const color =
    score >= blockThreshold ? '#ef4444' :
    score >= 40             ? '#f59e0b' :
                              '#22c55e'

  await chrome.action.setBadgeBackgroundColor({ color, tabId })
  await chrome.action.setBadgeText({ text: String(score), tabId })
}

import { calculateRiskScore, calculateRiskScoreSync } from '../lib/detection/score'
import { getPolicy } from '../lib/policy'
import { logEvent } from '../lib/audit'
import type { RiskResult } from '../lib/detection/score'

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

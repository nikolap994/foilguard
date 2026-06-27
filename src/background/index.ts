import { calculateRiskScore } from '../lib/detection/score'
import type { RiskResult } from '../lib/detection/score'

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type !== 'test-domain' || typeof msg.hostname !== 'string') return false
  calculateRiskScore(msg.hostname).then(respond)
  return true // keep channel open for async response
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

  await chrome.storage.session.set({ [tabId]: result })
  await updateBadge(tabId, result.score)
})

// Clear stored result when tab navigates away (covers SPA transitions)
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') {
    chrome.storage.session.remove(String(tabId))
    chrome.action.setBadgeText({ text: '', tabId })
  }
})

async function updateBadge(tabId: number, score: number): Promise<void> {
  if (score === 0) {
    await chrome.action.setBadgeText({ text: '', tabId })
    return
  }

  const color =
    score >= 70 ? '#ef4444' :
    score >= 40 ? '#f59e0b' :
               '#22c55e'

  await chrome.action.setBadgeBackgroundColor({ color, tabId })
  await chrome.action.setBadgeText({ text: String(score), tabId })
}

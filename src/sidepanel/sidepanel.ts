import './sidepanel.css'

const logoIcon = document.getElementById('logo-icon') as HTMLImageElement
logoIcon.src = chrome.runtime.getURL('icons/foilguard-16.png')

const idleState = document.getElementById('idle-state')!
const resultState = document.getElementById('result-state')!
const scoreCircle = document.getElementById('score-circle')!
const scoreValue = document.getElementById('score-value')!
const domainText = document.getElementById('domain-text')!
const verdictText = document.getElementById('verdict-text')!
const reasonsList = document.getElementById('reasons')!
const visitLink = document.getElementById('visit-link') as HTMLAnchorElement

const SCAN_KEY = 'foilguard_sidepanel_scan'
const POLICY_KEY = 'foilguard_personal_policy'
const DEFAULT_THRESHOLD = 65

let blockThreshold = DEFAULT_THRESHOLD

async function loadThreshold(): Promise<void> {
  const s = await chrome.storage.sync.get(POLICY_KEY)
  const policy = s[POLICY_KEY] as { blockThreshold?: number } | undefined
  if (typeof policy?.blockThreshold === 'number') blockThreshold = policy.blockThreshold
}

chrome.storage.sync.onChanged.addListener((changes) => {
  const policy = changes[POLICY_KEY]?.newValue as { blockThreshold?: number } | undefined
  if (typeof policy?.blockThreshold === 'number') blockThreshold = policy.blockThreshold
})

function showResult(data: { domain: string; score: number; reasons: string[]; url: string }): void {
  idleState.classList.add('hidden')
  resultState.classList.remove('hidden')
  reasonsList.innerHTML = ''

  domainText.textContent = data.domain
  scoreValue.textContent = String(data.score)

  if (data.score === 0) {
    scoreCircle.className = 'safe'
    verdictText.textContent = 'No threats detected'
    verdictText.className = 'verdict-text verdict-safe'
  } else if (data.score >= blockThreshold) {
    scoreCircle.className = 'danger'
    verdictText.textContent = 'High risk — likely phishing'
    verdictText.className = 'verdict-text verdict-danger'
  } else if (data.score >= 40) {
    scoreCircle.className = 'warning'
    verdictText.textContent = 'Suspicious — proceed with caution'
    verdictText.className = 'verdict-text verdict-warn'
  } else {
    scoreCircle.className = 'safe'
    verdictText.textContent = 'Low risk'
    verdictText.className = 'verdict-text verdict-safe'
  }

  for (const reason of data.reasons) {
    const li = document.createElement('li')
    li.textContent = reason
    reasonsList.appendChild(li)
  }

  if (data.score < blockThreshold) {
    visitLink.href = data.url
    visitLink.classList.remove('hidden')
  } else {
    visitLink.classList.add('hidden')
  }
}

let currentTabId: number | null = null

async function checkCurrentTab(): Promise<void> {
  await loadThreshold()
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  currentTabId = tab.id
  // Background writes results under tab ID for navigation scans, and under
  // SCAN_KEY for context-menu triggered scans. Check both.
  const stored = await chrome.storage.session.get([SCAN_KEY, String(tab.id)])
  const data = stored[SCAN_KEY] ?? stored[String(tab.id)]
  if (data) showResult(data)
  else {
    idleState.classList.remove('hidden')
    resultState.classList.add('hidden')
  }
}

chrome.storage.session.onChanged.addListener((changes) => {
  const fromScanKey = changes[SCAN_KEY]?.newValue
  const fromTabKey = currentTabId != null ? changes[String(currentTabId)]?.newValue : null
  const data = fromScanKey ?? fromTabKey
  if (data) showResult(data)
})

chrome.tabs.onActivated.addListener(() => checkCurrentTab())

checkCurrentTab()

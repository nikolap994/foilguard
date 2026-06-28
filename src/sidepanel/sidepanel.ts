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
const BLOCK_THRESHOLD = 65

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
  } else if (data.score >= BLOCK_THRESHOLD) {
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

  if (data.score < BLOCK_THRESHOLD) {
    visitLink.href = data.url
    visitLink.classList.remove('hidden')
  } else {
    visitLink.classList.add('hidden')
  }
}

// Poll for new scan results — chrome.storage.onChanged fires in the sidepanel
// context so we get updates without polling, but we also check on open.
async function checkForScan(): Promise<void> {
  const stored = await chrome.storage.session.get(SCAN_KEY)
  const data = stored[SCAN_KEY]
  if (data) showResult(data)
}

chrome.storage.session.onChanged.addListener((changes) => {
  if (changes[SCAN_KEY]?.newValue) showResult(changes[SCAN_KEY].newValue)
})

checkForScan()

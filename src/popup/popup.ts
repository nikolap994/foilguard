import type { RiskResult } from '../lib/detection/score'

function setupDevPanel(): void {
  const form = document.getElementById('dev-form') as HTMLFormElement
  const input = document.getElementById('dev-input') as HTMLInputElement
  const resultEl = document.getElementById('dev-result')!

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const hostname = input.value.trim().replace(/^https?:\/\//, '').split('/')[0]
    if (!hostname) return

    resultEl.textContent = 'scanning…'
    resultEl.className = ''

    chrome.runtime.sendMessage({ type: 'test-domain', hostname }, (result: RiskResult | undefined) => {
      if (!result) {
        resultEl.textContent = 'No response from background.'
        resultEl.className = 'dev-error'
        return
      }
      const label = result.score >= 70 ? '🔴' : result.score >= 40 ? '🟡' : '🟢'
      const lines = [`${label} score ${result.score} — ${result.domain}`, ...result.reasons]
      resultEl.textContent = lines.join('\n')
      resultEl.className = result.score >= 70 ? 'dev-danger' : result.score >= 40 ? 'dev-warning' : 'dev-safe'
    })
  })
}

async function render(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  const scoreEl = document.getElementById('score-value')!
  const circle = document.getElementById('score-circle')!
  const reasonsList = document.getElementById('reasons')!
  const safeMsg = document.getElementById('safe-msg')!
  const noDataMsg = document.getElementById('no-data-msg')!
  const domainText = document.getElementById('domain-text')!

  if (!tab?.id) {
    noDataMsg.classList.remove('hidden')
    return
  }

  const stored = await chrome.storage.session.get(String(tab.id))
  const result: RiskResult | undefined = stored[String(tab.id)]

  if (!result) {
    noDataMsg.classList.remove('hidden')
    return
  }

  domainText.textContent = result.domain

  if (result.score === 0) {
    scoreEl.textContent = '0'
    circle.className = 'safe'
    safeMsg.classList.remove('hidden')
    return
  }

  scoreEl.textContent = String(result.score)
  circle.className = result.score >= 70 ? 'danger' : result.score >= 40 ? 'warning' : 'safe'

  for (const reason of result.reasons) {
    const li = document.createElement('li')
    li.textContent = reason
    reasonsList.appendChild(li)
  }
}

function setupHeader(): void {
  const logoIcon = document.getElementById('logo-icon') as HTMLImageElement | null
  if (logoIcon) logoIcon.src = chrome.runtime.getURL('icons/foilguard-16.png')

  const toggle = document.getElementById('dev-toggle')
  const panel = document.getElementById('dev-panel')
  if (toggle && panel) {
    toggle.addEventListener('click', () => panel.classList.toggle('hidden'))
  }
}

render()
setupDevPanel()
setupHeader()

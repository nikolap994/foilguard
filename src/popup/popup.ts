import type { RiskResult } from '../lib/detection/score'
import type { AuditEntry } from '../lib/audit'

const AUDIT_KEY = 'foilguard_audit'
const BLOCK_THRESHOLD = 65

async function setupAuditPanel(): Promise<void> {
  const auditToggle = document.getElementById('audit-toggle')!
  const auditPanel = document.getElementById('audit-panel')!
  const auditList = document.getElementById('audit-list')!
  const auditEmpty = document.getElementById('audit-empty')!
  const exportBtn = document.getElementById('export-btn')!

  auditToggle.addEventListener('click', () => {
    const opening = auditPanel.classList.toggle('hidden') === false
    auditToggle.setAttribute('aria-pressed', String(opening))
    if (opening) renderAuditEntries(auditList, auditEmpty)
  })

  exportBtn.addEventListener('click', async () => {
    const stored = await chrome.storage.local.get(AUDIT_KEY)
    const log: AuditEntry[] = stored[AUDIT_KEY] ?? []
    const json = JSON.stringify(log, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(json)
    const a = document.createElement('a')
    a.href = dataUri
    a.download = `foilguard-audit-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  })
}

async function renderAuditEntries(list: HTMLElement, empty: HTMLElement): Promise<void> {
  list.innerHTML = ''

  const stored = await chrome.storage.local.get(AUDIT_KEY)
  const log: AuditEntry[] = stored[AUDIT_KEY] ?? []

  if (log.length === 0) {
    empty.classList.remove('hidden')
    return
  }

  empty.classList.add('hidden')

  for (const entry of log.slice(0, 10)) {
    const row = document.createElement('div')
    row.className = `audit-row audit-${entry.action}`

    const age = formatAge(entry.ts)

    row.innerHTML = `
      <span class="audit-action-tag">${entry.action}</span>
      <span class="audit-domain">${entry.domain}</span>
      <span class="audit-meta">${entry.score} · ${age}</span>
    `
    list.appendChild(row)
  }

  if (log.length > 10) {
    const more = document.createElement('p')
    more.className = 'audit-more'
    more.textContent = `+${log.length - 10} more — export for full log`
    list.appendChild(more)
  }
}

function formatAge(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

async function renderStats(): Promise<void> {
  const statsLine = document.getElementById('stats-line')!
  const stored = await chrome.storage.local.get(AUDIT_KEY)
  const log: AuditEntry[] = stored[AUDIT_KEY] ?? []
  if (log.length === 0) return

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayTs = todayStart.getTime()

  const todayCount = log.filter(e => e.ts >= todayTs && e.action !== 'bypassed').length
  const totalCount = log.filter(e => e.action !== 'bypassed').length

  if (todayCount > 0) {
    statsLine.textContent = `${todayCount} blocked today · ${totalCount} total`
    statsLine.classList.remove('hidden')
  } else if (totalCount > 0) {
    statsLine.textContent = `${totalCount} blocked total`
    statsLine.classList.remove('hidden')
  }
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
  circle.className = result.score >= BLOCK_THRESHOLD ? 'danger' : result.score >= 40 ? 'warning' : 'safe'

  for (const reason of result.reasons) {
    const li = document.createElement('li')
    li.textContent = reason
    reasonsList.appendChild(li)
  }
}

function setupHeader(): void {
  const logoIcon = document.getElementById('logo-icon') as HTMLImageElement | null
  if (logoIcon) logoIcon.src = chrome.runtime.getURL('icons/foilguard-16.png')

  const optionsBtn = document.getElementById('options-btn')
  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage())
  }
}

render()
renderStats()
setupAuditPanel()
setupHeader()

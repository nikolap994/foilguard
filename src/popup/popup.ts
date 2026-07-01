import type { RiskResult } from '../lib/detection/score'
import type { AuditEntry } from '../lib/audit'

const AUDIT_KEY = 'foilguard_audit'
const BLOCK_THRESHOLD = 65

// ─── View switching ────────────────────────────────────────────────────────
function showView(v: 'result' | 'dashboard'): void {
  document.getElementById('view-result')!.classList.toggle('hidden', v !== 'result')
  document.getElementById('view-dashboard')!.classList.toggle('hidden', v !== 'dashboard')
}

// ─── Render active-tab scan result ────────────────────────────────────────
function renderResult(result: RiskResult): void {
  const scoreEl = document.getElementById('score-value')!
  const circle = document.getElementById('score-circle')!
  const reasonsList = document.getElementById('reasons')!
  const safeMsg = document.getElementById('safe-msg')!
  const ageLine = document.getElementById('age-line')!

  reasonsList.innerHTML = ''
  safeMsg.classList.add('hidden')
  ageLine.classList.add('hidden')
  document.getElementById('domain-text')!.textContent = result.domain

  if (typeof result.ageDays === 'number' && result.ageDays !== null) {
    ageLine.textContent = result.ageDays < 1
      ? 'Registered today'
      : result.ageDays < 365
        ? `Registered ${result.ageDays} day${result.ageDays !== 1 ? 's' : ''} ago`
        : `Registered ${Math.floor(result.ageDays / 365)}yr+ ago`
    ageLine.className = `age-line ${result.ageDays < 30 ? 'age-new' : 'age-ok'}`
  }

  if (result.score === 0) {
    scoreEl.textContent = '0'
    circle.className = 'safe'
    safeMsg.classList.remove('hidden')
    return
  }

  scoreEl.textContent = String(result.score)
  circle.className = result.score >= BLOCK_THRESHOLD ? 'danger' : result.score >= 40 ? 'warning' : 'low'
  for (const reason of result.reasons) {
    const li = document.createElement('li')
    li.textContent = reason
    reasonsList.appendChild(li)
  }
}

async function addToAllowlist(domain: string, btn: HTMLButtonElement): Promise<void> {
  const key = 'foilguard_personal_policy'
  const stored = await chrome.storage.sync.get(key)
  const p = (stored[key] ?? {}) as { customAllowlist?: string[]; allowlistTimestamps?: Record<string, number> }
  const list = p.customAllowlist ?? []
  if (!list.includes(domain)) {
    await chrome.storage.sync.set({
      [key]: { ...p, customAllowlist: [...list, domain], allowlistTimestamps: { ...(p.allowlistTimestamps ?? {}), [domain]: Date.now() } },
    })
  }
  btn.textContent = 'Trusted ✓'
  btn.disabled = true
}

// ─── Dashboard stats ───────────────────────────────────────────────────────
async function renderDashboard(): Promise<void> {
  const stored = await chrome.storage.local.get(AUDIT_KEY)
  const log: AuditEntry[] = stored[AUDIT_KEY] ?? []

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()

  const blocks = log.filter(e => e.action === 'blocked' || e.action === 'warned')
  const todayCount = blocks.filter(e => e.ts >= todayTs).length
  const totalCount = blocks.length

  document.getElementById('stat-today-num')!.textContent = String(todayCount)
  document.getElementById('stat-total-num')!.textContent = String(totalCount)

  // Day streak: consecutive days with at least 1 block
  const streak = calcStreak(blocks)
  document.getElementById('stat-streak')!.textContent = String(streak)

  // Recent blocks list
  const recentList = document.getElementById('recent-list')!
  const recentEmpty = document.getElementById('recent-empty')!
  const recent = blocks.slice(-5).reverse()

  if (recent.length === 0) {
    recentEmpty.classList.remove('hidden')
  } else {
    recentEmpty.classList.add('hidden')
    for (const e of recent) {
      const row = document.createElement('div')
      row.className = 'recent-row'
      row.innerHTML = `
        <span class="recent-dot recent-${e.action}"></span>
        <span class="recent-domain">${e.domain}</span>
        <span class="recent-score">${e.score}</span>
        <span class="recent-time">${formatAge(e.ts)}</span>
      `
      recentList.appendChild(row)
    }
  }
}

function calcStreak(blocks: AuditEntry[]): number {
  if (blocks.length === 0) return 0
  const days = new Set(blocks.map(e => new Date(e.ts).toDateString()))
  let streak = 0
  const d = new Date()
  while (days.has(d.toDateString())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ─── Quick scan ────────────────────────────────────────────────────────────
function setupQuickScan(): void {
  const input = document.getElementById('qs-input') as HTMLInputElement
  const btn = document.getElementById('qs-btn') as HTMLButtonElement
  const resultEl = document.getElementById('qs-result')!
  const circle = document.getElementById('qs-circle')!
  const domainEl = document.getElementById('qs-domain')!
  const verdictEl = document.getElementById('qs-verdict')!
  const reasonsList = document.getElementById('qs-reasons')!

  async function doScan(): Promise<void> {
    const raw = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
    if (!raw) return
    btn.textContent = '…'
    btn.disabled = true
    try {
      const result = await chrome.runtime.sendMessage({ type: 'test-domain', hostname: raw }) as RiskResult | undefined
      if (!result) return
      resultEl.classList.remove('hidden')
      domainEl.textContent = result.domain
      const scoreText = result.score === 0 ? '0' : String(result.score)
      circle.textContent = scoreText
      circle.className = `qs-circle ${result.score >= BLOCK_THRESHOLD ? 'danger' : result.score >= 40 ? 'warning' : result.score > 0 ? 'low' : 'safe'}`
      verdictEl.textContent = result.score === 0 ? 'No threats detected' : result.score >= BLOCK_THRESHOLD ? 'High risk' : result.score >= 40 ? 'Suspicious' : 'Low risk'
      verdictEl.className = `qs-verdict ${result.score >= BLOCK_THRESHOLD ? 'v-danger' : result.score >= 40 ? 'v-warn' : result.score > 0 ? 'v-low' : 'v-safe'}`
      reasonsList.innerHTML = ''
      for (const r of result.reasons.slice(0, 3)) {
        const li = document.createElement('li')
        li.textContent = r
        reasonsList.appendChild(li)
      }
    } finally {
      btn.textContent = 'Scan'
      btn.disabled = false
    }
  }

  btn.addEventListener('click', doScan)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doScan() })
}

// ─── Audit panel ───────────────────────────────────────────────────────────
async function setupAuditPanel(): Promise<void> {
  const auditToggle = document.getElementById('audit-toggle')!
  const auditPanel = document.getElementById('audit-panel')!
  const auditList = document.getElementById('audit-list')!
  const auditEmpty = document.getElementById('audit-empty')!

  auditToggle.addEventListener('click', () => {
    const opening = auditPanel.classList.toggle('hidden') === false
    auditToggle.setAttribute('aria-pressed', String(opening))
    if (opening) renderAuditEntries(auditList, auditEmpty)
  })

  document.getElementById('export-json-btn')!.addEventListener('click', () => exportLog('json'))
  document.getElementById('export-csv-btn')!.addEventListener('click', () => exportLog('csv'))
}

async function exportLog(format: 'json' | 'csv'): Promise<void> {
  const stored = await chrome.storage.local.get(AUDIT_KEY)
  const log: AuditEntry[] = stored[AUDIT_KEY] ?? []

  let content: string
  let mime: string
  let ext: string

  if (format === 'csv') {
    const header = 'timestamp,domain,score,action,reason\n'
    const rows = log.map(e =>
      `${new Date(e.ts).toISOString()},${e.domain},${e.score},${e.action},"${(e.reasons[0] ?? '').replace(/"/g, '""')}"`
    ).join('\n')
    content = header + rows
    mime = 'text/csv'
    ext = 'csv'
  } else {
    content = JSON.stringify(log, null, 2)
    mime = 'application/json'
    ext = 'json'
  }

  const dataUri = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`
  const a = document.createElement('a')
  a.href = dataUri
  a.download = `foilguard-audit-${new Date().toISOString().slice(0, 10)}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function renderAuditEntries(list: HTMLElement, empty: HTMLElement): Promise<void> {
  list.innerHTML = ''
  const stored = await chrome.storage.local.get(AUDIT_KEY)
  const log: AuditEntry[] = stored[AUDIT_KEY] ?? []

  if (log.length === 0) { empty.classList.remove('hidden'); return }
  empty.classList.add('hidden')

  for (const entry of log.slice(-15).reverse()) {
    const row = document.createElement('div')
    row.className = `audit-row audit-${entry.action}`
    row.innerHTML = `
      <span class="audit-action-tag">${entry.action}</span>
      <span class="audit-domain">${entry.domain}</span>
      <span class="audit-meta">${entry.score} · ${formatAge(entry.ts)}</span>
    `
    list.appendChild(row)
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

// ─── Main render ───────────────────────────────────────────────────────────
async function render(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  // Setup options button
  document.getElementById('logo-icon')!.setAttribute('src', chrome.runtime.getURL('icons/foilguard-16.png'))
  document.getElementById('options-btn')!.addEventListener('click', () => chrome.runtime.openOptionsPage())

  if (!tab?.id || !tab.url?.startsWith('http')) {
    // Non-web page (new tab, settings, etc.) — show dashboard
    showView('dashboard')
    await renderDashboard()
    setupQuickScan()
    return
  }

  const stored = await chrome.storage.session.get(String(tab.id))
  const result: RiskResult | undefined = stored[String(tab.id)]

  if (!result) {
    // Page not yet scanned (mid-load) — show dashboard with quick scan pre-filled
    showView('dashboard')
    await renderDashboard()
    setupQuickScan()
    try {
      const hostname = new URL(tab.url).hostname
      if (hostname) (document.getElementById('qs-input') as HTMLInputElement).value = hostname
    } catch { /* ignore */ }
    return
  }

  showView('result')
  renderResult(result)

  const trustBtn = document.getElementById('trust-btn') as HTMLButtonElement
  const rescanBtn = document.getElementById('rescan-btn') as HTMLButtonElement
  const key = 'foilguard_personal_policy'
  const syncStored = await chrome.storage.sync.get(key)
  const existing = ((syncStored[key] ?? {}) as { customAllowlist?: string[] }).customAllowlist ?? []

  if (!existing.includes(result.domain)) {
    trustBtn.classList.remove('hidden')
    trustBtn.addEventListener('click', () => addToAllowlist(result.domain, trustBtn))
  }

  rescanBtn.classList.remove('hidden')
  rescanBtn.addEventListener('click', async () => {
    rescanBtn.textContent = '…'
    rescanBtn.disabled = true
    const fresh = await chrome.runtime.sendMessage({ type: 'test-domain', hostname: result.domain }) as RiskResult | undefined
    if (fresh) {
      if (tab.id) await chrome.storage.session.set({ [tab.id]: fresh })
      renderResult(fresh)
    }
    rescanBtn.textContent = 'Rescan ↺'
    rescanBtn.disabled = false
  })
}

setupAuditPanel()
render()

import './warning.css'
import { logEvent } from '../lib/audit'

const params = new URLSearchParams(location.search)
const originalUrl = params.get('url') ?? ''
const score = Number(params.get('score') ?? 0)
const domain = params.get('domain') ?? ''
const reasons: string[] = JSON.parse(decodeURIComponent(params.get('reasons') ?? '[]'))
const forceBlock = params.get('forceBlock') === 'true'

const logoIcon = document.getElementById('logo-icon') as HTMLImageElement
logoIcon.src = chrome.runtime.getURL('icons/foilguard-48.png')

// Show decoded punycode if domain contains IDN labels
function decodePunycode(d: string): string | null {
  try {
    const decoded = new URL(`https://${d}`).hostname
    if (decoded !== d) return decoded
    return null
  } catch { return null }
}

document.getElementById('domain-label')!.textContent = domain
document.getElementById('bypass-domain')!.textContent = domain

const idnDecoded = decodePunycode(domain)
if (idnDecoded) {
  const idnNote = document.createElement('p')
  idnNote.className = 'idn-note'
  idnNote.textContent = `⚠ This domain uses internationalized characters. Visually it appears as: "${idnDecoded}"`
  document.getElementById('domain-label')!.insertAdjacentElement('afterend', idnNote)
}
document.getElementById('score-value')!.textContent = String(score)

const circle = document.getElementById('score-circle')!
circle.className = score >= 80 ? 'critical' : 'danger'

const reasonsList = document.getElementById('reasons')!
for (const reason of reasons) {
  const li = document.createElement('li')
  li.textContent = reason
  reasonsList.appendChild(li)
}

const btnBack = document.getElementById('btn-back')!

function goBack(): void {
  if (history.length > 1) history.back()
  else window.close()
}

btnBack.addEventListener('click', goBack)

async function addToAllowlist(d: string): Promise<void> {
  const key = 'foilguard_personal_policy'
  const stored = await chrome.storage.sync.get(key)
  const p = (stored[key] ?? {}) as { customAllowlist?: string[]; allowlistTimestamps?: Record<string, number> }
  const list = p.customAllowlist ?? []
  if (!list.includes(d)) {
    await chrome.storage.sync.set({
      [key]: {
        ...p,
        customAllowlist: [...list, d],
        allowlistTimestamps: { ...(p.allowlistTimestamps ?? {}), [d]: Date.now() },
      },
    })
  }
}

async function init(): Promise<void> {
  const btnProceed = document.getElementById('btn-proceed')!
  const btnTrust = document.getElementById('btn-trust')!
  const bypassNote = document.getElementById('bypass-note')!
  const kbdHint = document.getElementById('kbd-hint')!
  const forceBlockNote = document.getElementById('force-block-note')!

  if (forceBlock) {
    btnProceed.remove()
    btnTrust.remove()
    bypassNote.remove()
    kbdHint.remove()
    forceBlockNote.classList.remove('hidden')
    return
  }

  const policy = await chrome.runtime.sendMessage({ type: 'get-policy' })
  if (policy?.disableBypass) {
    btnProceed.remove()
    btnTrust.remove()
    bypassNote.remove()
    kbdHint.remove()
    forceBlockNote.textContent = 'Your organisation\'s security policy prevents bypassing this warning.'
    forceBlockNote.classList.remove('hidden')
    return
  }

  // Friction timer: 5-second countdown before "proceed" is enabled
  btnTrust.classList.remove('hidden')
  const btnProceedEl = btnProceed as HTMLButtonElement
  const FRICTION_SECS = score >= 80 ? 8 : 5
  let countdown = FRICTION_SECS
  btnProceedEl.disabled = true
  btnProceedEl.textContent = `Proceed anyway (${countdown}s)`
  const timer = setInterval(() => {
    countdown--
    if (countdown <= 0) {
      clearInterval(timer)
      btnProceedEl.disabled = false
      btnProceedEl.textContent = 'Proceed anyway — I understand the risk'
    } else {
      btnProceedEl.textContent = `Proceed anyway (${countdown}s)`
    }
  }, 1000)

  btnProceed.addEventListener('click', async () => {
    await logEvent({ domain, score, reasons, action: 'bypassed' })
    await chrome.storage.session.set({ [`bypass:${domain}`]: true })
    window.location.href = originalUrl
  })

  btnTrust.addEventListener('click', async () => {
    await addToAllowlist(domain)
    window.location.href = originalUrl
  })

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Escape') { goBack(); return }
    if (e.key === 'p' || e.key === 'P') { (btnProceed as HTMLButtonElement).click(); return }
    if (e.key === 't' || e.key === 'T') { (btnTrust as HTMLButtonElement).click(); return }
  })
}

// Rescan — requests a fresh score from background (RDAP included)
const btnRescan = document.getElementById('btn-rescan') as HTMLButtonElement
btnRescan.addEventListener('click', async () => {
  btnRescan.textContent = 'Scanning…'
  btnRescan.disabled = true
  try {
    const fresh = await chrome.runtime.sendMessage({ type: 'test-domain', hostname: domain }) as { score: number; reasons: string[] } | undefined
    if (fresh) {
      document.getElementById('score-value')!.textContent = String(fresh.score)
      const circle = document.getElementById('score-circle')!
      circle.className = fresh.score >= 80 ? 'critical' : fresh.score >= 65 ? 'danger' : 'safe'
      const list = document.getElementById('reasons')!
      list.innerHTML = ''
      for (const r of fresh.reasons) {
        const li = document.createElement('li')
        li.textContent = r
        list.appendChild(li)
      }
      if (fresh.score === 0) {
        btnRescan.textContent = 'Score is now 0 — looks safe'
      } else {
        btnRescan.textContent = `Rescanned: score ${fresh.score}`
      }
    }
  } catch {
    btnRescan.textContent = 'Rescan failed'
  }
})

// Report false positive — opens a pre-filled GitHub issue
const btnReport = document.getElementById('btn-report') as HTMLButtonElement
btnReport.addEventListener('click', () => {
  const title = encodeURIComponent(`False positive: ${domain}`)
  const body = encodeURIComponent(
    `**Domain:** ${domain}\n**Score:** ${score}\n**URL:** ${originalUrl}\n\n**Reasons given:**\n${reasons.map(r => `- ${r}`).join('\n')}\n\n**Additional context:**\n<!-- Describe why this site is legitimate -->`
  )
  const issueUrl = `https://github.com/nikolap994/foilguard/issues/new?title=${title}&body=${body}&labels=false-positive`
  window.open(issueUrl, '_blank', 'noopener,noreferrer')
})

init()

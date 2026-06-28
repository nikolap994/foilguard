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

document.getElementById('domain-label')!.textContent = domain
document.getElementById('bypass-domain')!.textContent = domain
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
  const stored = await chrome.storage.local.get(key)
  const p = (stored[key] ?? {}) as { customAllowlist?: string[] }
  const list = p.customAllowlist ?? []
  if (!list.includes(d)) {
    await chrome.storage.local.set({ [key]: { ...p, customAllowlist: [...list, d] } })
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

  // Show all interactive options
  btnTrust.classList.remove('hidden')

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

init()

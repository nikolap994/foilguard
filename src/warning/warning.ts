import { logEvent } from '../lib/audit'

const params = new URLSearchParams(location.search)
const originalUrl = params.get('url') ?? ''
const score = Number(params.get('score') ?? 0)
const domain = params.get('domain') ?? ''
const reasons: string[] = JSON.parse(decodeURIComponent(params.get('reasons') ?? '[]'))
const forceBlock = params.get('forceBlock') === 'true'

const logoIcon = document.getElementById('logo-icon') as HTMLImageElement
logoIcon.src = chrome.runtime.getURL('icons/foilguard-16.png')

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

document.getElementById('btn-back')!.addEventListener('click', () => {
  if (history.length > 1) {
    history.back()
  } else {
    window.close()
  }
})

async function init(): Promise<void> {
  const btnProceed = document.getElementById('btn-proceed')!
  const bypassNote = document.getElementById('bypass-note')!
  const forceBlockNote = document.getElementById('force-block-note')!

  if (forceBlock) {
    // Domain is on the admin's blocklist — bypass is not possible
    btnProceed.remove()
    bypassNote.remove()
    forceBlockNote.classList.remove('hidden')
    return
  }

  // Check admin policy — disableBypass hides the proceed button entirely
  const policy = await chrome.runtime.sendMessage({ type: 'get-policy' })
  if (policy?.disableBypass) {
    btnProceed.remove()
    bypassNote.remove()
    forceBlockNote.textContent = 'Your organisation\'s security policy prevents bypassing this warning.'
    forceBlockNote.classList.remove('hidden')
    return
  }

  btnProceed.addEventListener('click', async () => {
    await logEvent({ domain, score, reasons, action: 'bypassed' })
    await chrome.storage.session.set({ [`bypass:${domain}`]: true })
    window.location.href = originalUrl
  })
}

init()

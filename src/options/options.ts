import './options.css'

const STORAGE_KEY = 'foilguard_personal_policy'

interface PersonalPolicy {
  blockThreshold: number
  customAllowlist: string[]
  customBlocklist: string[]
  blockPopups: boolean
  allowlistTimestamps: Record<string, number>
}

const defaults: PersonalPolicy = {
  blockThreshold: 65,
  customAllowlist: [],
  customBlocklist: [],
  blockPopups: true,
  allowlistTimestamps: {},
}

const logoIcon = document.getElementById('logo-icon') as HTMLImageElement
logoIcon.src = chrome.runtime.getURL('icons/foilguard-48.png')

const slider = document.getElementById('threshold-slider') as HTMLInputElement
const thresholdDisplay = document.getElementById('threshold-value')!
const allowlistInput = document.getElementById('allowlist-input') as HTMLInputElement
const allowlistAdd = document.getElementById('allowlist-add')!
const allowlistEntries = document.getElementById('allowlist-entries')!
const allowlistError = document.getElementById('allowlist-error')!
const blocklistInput = document.getElementById('blocklist-input') as HTMLInputElement
const blocklistAdd = document.getElementById('blocklist-add')!
const blocklistEntries = document.getElementById('blocklist-entries')!
const blocklistError = document.getElementById('blocklist-error')!
const saveBanner = document.getElementById('save-banner')!
const importBanner = document.getElementById('import-banner')!
const exportBtn = document.getElementById('export-btn')!
const importBtn = document.getElementById('import-btn')!
const importFile = document.getElementById('import-file') as HTMLInputElement
const resetBtn = document.getElementById('reset-btn')!
const popupToggle = document.getElementById('popup-toggle') as HTMLButtonElement
const sbApiKeyInput = document.getElementById('sb-api-key') as HTMLInputElement
const sbSaveBtn = document.getElementById('sb-save-btn') as HTMLButtonElement
const sbClearBtn = document.getElementById('sb-clear-btn') as HTMLButtonElement
const sbStatus = document.getElementById('sb-status')!

let policy: PersonalPolicy = { ...defaults }
let saveTimer: ReturnType<typeof setTimeout> | null = null
let importTimer: ReturnType<typeof setTimeout> | null = null

// ─── Storage helpers (chrome.storage.sync with local migration) ────────────
async function readPolicy(): Promise<PersonalPolicy> {
  const synced = await chrome.storage.sync.get(STORAGE_KEY)
  if (synced[STORAGE_KEY]) return { ...defaults, ...synced[STORAGE_KEY] }

  const local = await chrome.storage.local.get(STORAGE_KEY)
  if (local[STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: local[STORAGE_KEY] })
    await chrome.storage.local.remove(STORAGE_KEY)
    return { ...defaults, ...local[STORAGE_KEY] }
  }

  return { ...defaults }
}

async function writePolicy(p: PersonalPolicy): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: p })
}
// ──────────────────────────────────────────────────────────────────────────

function syncToggleUI(): void {
  popupToggle.setAttribute('aria-checked', String(policy.blockPopups))
}

async function load(): Promise<void> {
  policy = await readPolicy()
  slider.value = String(policy.blockThreshold)
  thresholdDisplay.textContent = String(policy.blockThreshold)
  renderList(allowlistEntries, policy.customAllowlist, 'allowlist')
  renderList(blocklistEntries, policy.customBlocklist, 'blocklist')
  syncToggleUI()
}

async function save(): Promise<void> {
  await writePolicy(policy)
  showBanner(saveBanner, saveTimer, t => { saveTimer = t })
}

function showBanner(el: HTMLElement, _timer: ReturnType<typeof setTimeout> | null, setTimer: (t: ReturnType<typeof setTimeout>) => void): void {
  el.classList.remove('hidden')
  if (_timer) clearTimeout(_timer)
  setTimer(setTimeout(() => el.classList.add('hidden'), 2000))
}

const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000

function renderList(ul: HTMLElement, items: string[], type: 'allowlist' | 'blocklist'): void {
  ul.innerHTML = ''
  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'No entries yet.'
    ul.appendChild(empty)
    return
  }
  for (const item of items) {
    const li = document.createElement('li')

    const textSpan = document.createElement('span')
    textSpan.textContent = item
    li.appendChild(textSpan)

    // Show age warning for allowlist entries added more than 90 days ago
    if (type === 'allowlist') {
      const ts = policy.allowlistTimestamps[item]
      if (ts && Date.now() - ts > NINETY_DAYS) {
        const badge = document.createElement('span')
        badge.className = 'stale-badge'
        const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000))
        badge.title = `Added ${days} days ago — consider reviewing`
        badge.textContent = `${days}d`
        li.appendChild(badge)
      }
    }

    const removeBtn = document.createElement('button')
    removeBtn.textContent = '×'
    removeBtn.addEventListener('click', () => {
      if (type === 'allowlist') {
        policy.customAllowlist = policy.customAllowlist.filter(d => d !== item)
        const { [item]: _, ...rest } = policy.allowlistTimestamps
        policy.allowlistTimestamps = rest
        renderList(allowlistEntries, policy.customAllowlist, 'allowlist')
      } else {
        policy.customBlocklist = policy.customBlocklist.filter(d => d !== item)
        renderList(blocklistEntries, policy.customBlocklist, 'blocklist')
      }
      save()
    })
    li.appendChild(removeBtn)
    ul.appendChild(li)
  }
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg
  el.classList.remove('hidden')
}

function clearError(el: HTMLElement): void {
  el.textContent = ''
  el.classList.add('hidden')
}

function addDomain(input: HTMLInputElement, type: 'allowlist' | 'blocklist'): void {
  const raw = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
  const errEl = type === 'allowlist' ? allowlistError : blocklistError
  if (!raw || raw.length < 3) return
  if (type === 'allowlist') {
    if (policy.customAllowlist.includes(raw)) return
    if (policy.customBlocklist.includes(raw)) {
      showError(errEl, `"${raw}" is already in your blocklist — remove it there first.`)
      return
    }
    clearError(errEl)
    policy.customAllowlist = [...policy.customAllowlist, raw]
    policy.allowlistTimestamps = { ...policy.allowlistTimestamps, [raw]: Date.now() }
    renderList(allowlistEntries, policy.customAllowlist, 'allowlist')
  } else {
    if (policy.customBlocklist.includes(raw)) return
    if (policy.customAllowlist.includes(raw)) {
      showError(errEl, `"${raw}" is already in your allowlist — remove it there first.`)
      return
    }
    clearError(errEl)
    policy.customBlocklist = [...policy.customBlocklist, raw]
    renderList(blocklistEntries, policy.customBlocklist, 'blocklist')
  }
  input.value = ''
  save()
}

// ─── Export ────────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  const json = JSON.stringify({ version: 1, policy }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `foilguard-settings-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
})

// ─── Import ────────────────────────────────────────────────────────────────
importBtn.addEventListener('click', () => importFile.click())

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as { version?: number; policy?: Partial<PersonalPolicy> }
    const imported = parsed.policy ?? (parsed as Partial<PersonalPolicy>)
    policy = {
      blockThreshold: Number(imported.blockThreshold ?? defaults.blockThreshold),
      customAllowlist: Array.isArray(imported.customAllowlist) ? imported.customAllowlist : [],
      customBlocklist: Array.isArray(imported.customBlocklist) ? imported.customBlocklist : [],
      blockPopups: typeof imported.blockPopups === 'boolean' ? imported.blockPopups : defaults.blockPopups,
      allowlistTimestamps: (typeof imported.allowlistTimestamps === 'object' && imported.allowlistTimestamps !== null) ? imported.allowlistTimestamps as Record<string, number> : {},
    }
    await writePolicy(policy)
    slider.value = String(policy.blockThreshold)
    thresholdDisplay.textContent = String(policy.blockThreshold)
    renderList(allowlistEntries, policy.customAllowlist, 'allowlist')
    renderList(blocklistEntries, policy.customBlocklist, 'blocklist')
    syncToggleUI()
    showBanner(importBanner, importTimer, t => { importTimer = t })
  } catch {
    // Invalid file — ignore silently
  }
  importFile.value = ''
})

// ─── Reset ─────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', async () => {
  if (!confirm('Reset all settings to defaults? This will clear your allowlist, blocklist, and threshold.')) return
  policy = { ...defaults, allowlistTimestamps: {} }
  await chrome.storage.sync.remove(STORAGE_KEY)
  await chrome.storage.local.remove(STORAGE_KEY)
  slider.value = String(defaults.blockThreshold)
  thresholdDisplay.textContent = String(defaults.blockThreshold)
  renderList(allowlistEntries, [], 'allowlist')
  renderList(blocklistEntries, [], 'blocklist')
  syncToggleUI()
  showBanner(saveBanner, saveTimer, t => { saveTimer = t })
})

// ─── Popup toggle ─────────────────────────────────────────────────────────
popupToggle.addEventListener('click', () => {
  policy.blockPopups = !policy.blockPopups
  syncToggleUI()
  save()
})

slider.addEventListener('input', () => {
  policy.blockThreshold = Number(slider.value)
  thresholdDisplay.textContent = slider.value
  save()
})

allowlistAdd.addEventListener('click', () => addDomain(allowlistInput, 'allowlist'))
allowlistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(allowlistInput, 'allowlist') })

blocklistAdd.addEventListener('click', () => addDomain(blocklistInput, 'blocklist'))
blocklistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(blocklistInput, 'blocklist') })

// ─── Safe Browsing API key ──────────────────────────────────────────────────
async function loadSbKey(): Promise<void> {
  const s = await chrome.storage.sync.get(STORAGE_KEY)
  const p = s[STORAGE_KEY] as { safeBrowsingApiKey?: string } | undefined
  if (p?.safeBrowsingApiKey) {
    sbApiKeyInput.value = p.safeBrowsingApiKey
    sbStatus.textContent = '✓ API key saved — Safe Browsing active'
    sbStatus.style.color = '#41d07f'
  }
}

sbSaveBtn.addEventListener('click', async () => {
  const key = sbApiKeyInput.value.trim()
  if (!key) { sbStatus.textContent = 'Enter a key first.'; sbStatus.style.color = '#ef4444'; return }
  const s = await chrome.storage.sync.get(STORAGE_KEY)
  const p = (s[STORAGE_KEY] ?? {}) as Record<string, unknown>
  await chrome.storage.sync.set({ [STORAGE_KEY]: { ...p, safeBrowsingApiKey: key } })
  sbStatus.textContent = '✓ Saved — Safe Browsing checks enabled'
  sbStatus.style.color = '#41d07f'
})

sbClearBtn.addEventListener('click', async () => {
  sbApiKeyInput.value = ''
  const s = await chrome.storage.sync.get(STORAGE_KEY)
  const p = (s[STORAGE_KEY] ?? {}) as Record<string, unknown>
  const { safeBrowsingApiKey: _, ...rest } = p
  await chrome.storage.sync.set({ [STORAGE_KEY]: rest })
  sbStatus.textContent = 'API key cleared.'
  sbStatus.style.color = '#94a3b8'
})

loadSbKey()
load()

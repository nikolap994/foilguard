import './options.css'

const STORAGE_KEY = 'foilguard_personal_policy'

interface PersonalPolicy {
  blockThreshold: number
  customAllowlist: string[]
  customBlocklist: string[]
}

const defaults: PersonalPolicy = {
  blockThreshold: 65,
  customAllowlist: [],
  customBlocklist: [],
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

let policy: PersonalPolicy = { ...defaults }
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function load(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  policy = { ...defaults, ...(stored[STORAGE_KEY] ?? {}) }
  slider.value = String(policy.blockThreshold)
  thresholdDisplay.textContent = String(policy.blockThreshold)
  renderList(allowlistEntries, policy.customAllowlist, 'allowlist')
  renderList(blocklistEntries, policy.customBlocklist, 'blocklist')
}

async function save(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: policy })
  showBanner()
}

function showBanner(): void {
  saveBanner.classList.remove('hidden')
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveBanner.classList.add('hidden'), 2000)
}

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
    li.textContent = item
    const removeBtn = document.createElement('button')
    removeBtn.textContent = '×'
    removeBtn.addEventListener('click', () => {
      if (type === 'allowlist') {
        policy.customAllowlist = policy.customAllowlist.filter(d => d !== item)
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

slider.addEventListener('input', () => {
  policy.blockThreshold = Number(slider.value)
  thresholdDisplay.textContent = slider.value
  save()
})

allowlistAdd.addEventListener('click', () => addDomain(allowlistInput, 'allowlist'))
allowlistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(allowlistInput, 'allowlist') })

blocklistAdd.addEventListener('click', () => addDomain(blocklistInput, 'blocklist'))
blocklistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(blocklistInput, 'blocklist') })

load()

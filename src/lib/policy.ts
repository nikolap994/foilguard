export interface Policy {
  /** Risk score at which navigation is blocked (0–100, default 65) */
  blockThreshold: number
  /** Log events without actually blocking — useful for rollout/testing */
  reportOnly: boolean
  /** Remove the "Proceed anyway" button — prevents any bypass */
  disableBypass: boolean
  /** Domains that should never be flagged, regardless of score */
  customAllowlist: string[]
  /** Domains that are always blocked, regardless of score */
  customBlocklist: string[]
  /** URL to POST audit events to (empty string = disabled) */
  reportingEndpoint: string
  /** Block drive-by popups (window.open without a recent user click) */
  blockPopups: boolean
  /** Timestamps (ms) when each allowlist domain was added — used to surface stale entries */
  allowlistTimestamps: Record<string, number>
}

const DEFAULTS: Policy = {
  blockThreshold: 65,
  reportOnly: false,
  disableBypass: false,
  customAllowlist: [],
  customBlocklist: [],
  reportingEndpoint: '',
  blockPopups: true,
  allowlistTimestamps: {},
}

const PERSONAL_KEY = 'foilguard_personal_policy'

// Reads personal policy from sync storage, migrating from local if needed.
async function getPersonalPolicy(): Promise<Partial<Policy>> {
  const synced = await chrome.storage.sync.get(PERSONAL_KEY)
  if (synced[PERSONAL_KEY]) return synced[PERSONAL_KEY] as Partial<Policy>

  // One-time migration from local → sync
  const local = await chrome.storage.local.get(PERSONAL_KEY)
  if (local[PERSONAL_KEY]) {
    await chrome.storage.sync.set({ [PERSONAL_KEY]: local[PERSONAL_KEY] })
    await chrome.storage.local.remove(PERSONAL_KEY)
    return local[PERSONAL_KEY] as Partial<Policy>
  }

  return {}
}

// Reads policy merging three layers (lowest → highest priority):
//   1. Built-in defaults
//   2. Personal settings synced via chrome.storage.sync
//   3. Enterprise managed policy via MDM/GPO (chrome.storage.managed) — always wins
export async function getPolicy(): Promise<Policy> {
  const personalPolicy = await getPersonalPolicy()

  try {
    const managed = await chrome.storage.managed.get(null)
    return { ...DEFAULTS, ...personalPolicy, ...managed } as Policy
  } catch {
    return { ...DEFAULTS, ...personalPolicy }
  }
}

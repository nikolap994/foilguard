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
}

const DEFAULTS: Policy = {
  blockThreshold: 65,
  reportOnly: false,
  disableBypass: false,
  customAllowlist: [],
  customBlocklist: [],
  reportingEndpoint: '',
}

// Reads policy merging three layers (lowest → highest priority):
//   1. Built-in defaults
//   2. Personal settings from options page (chrome.storage.local)
//   3. Enterprise managed policy via MDM/GPO (chrome.storage.managed) — always wins
export async function getPolicy(): Promise<Policy> {
  const personal = await chrome.storage.local.get('foilguard_personal_policy')
  const personalPolicy = (personal['foilguard_personal_policy'] ?? {}) as Partial<Policy>

  try {
    const managed = await chrome.storage.managed.get(null)
    return { ...DEFAULTS, ...personalPolicy, ...managed } as Policy
  } catch {
    return { ...DEFAULTS, ...personalPolicy }
  }
}

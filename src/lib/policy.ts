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

// Reads policy from chrome.storage.managed (pushed by MDM/GPO in enterprise deployments).
// Falls back to defaults in personal Chrome where managed storage is unavailable.
export async function getPolicy(): Promise<Policy> {
  try {
    const managed = await chrome.storage.managed.get(null)
    return { ...DEFAULTS, ...managed } as Policy
  } catch {
    // chrome.storage.managed throws if the extension is not in a managed environment.
    return { ...DEFAULTS }
  }
}

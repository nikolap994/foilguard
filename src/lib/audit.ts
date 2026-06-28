import { getPolicy } from './policy'

export type AuditAction = 'blocked' | 'bypassed' | 'warned'

export interface AuditEntry {
  ts: number
  domain: string
  score: number
  reasons: string[]
  action: AuditAction
}

const STORAGE_KEY = 'foilguard_audit'
const MAX_ENTRIES = 500

export async function logEvent(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  const record: AuditEntry = { ts: Date.now(), ...entry }

  // Write to local audit log (ring-buffer capped at MAX_ENTRIES)
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY)
    const log: AuditEntry[] = stored[STORAGE_KEY] ?? []
    log.unshift(record)
    if (log.length > MAX_ENTRIES) log.splice(MAX_ENTRIES)
    await chrome.storage.local.set({ [STORAGE_KEY]: log })
  } catch {
    // Non-fatal — audit log is best-effort.
  }

  // Forward to reporting endpoint if configured by admin policy
  try {
    const policy = await getPolicy()
    if (!policy.reportingEndpoint) return
    fetch(policy.reportingEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch(() => {})
  } catch {
    // Policy read or fetch failure — do not block the main flow.
  }
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY)
    return stored[STORAGE_KEY] ?? []
  } catch {
    return []
  }
}

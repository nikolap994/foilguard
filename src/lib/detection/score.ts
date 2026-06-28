import { levenshtein } from './levenshtein'
import { isPunycode, containsNonASCII, normalizeHomoglyphs } from './homoglyph'
import { TOP_DOMAINS, SUSPICIOUS_TLDS, PHISHING_KEYWORDS, COMPOUND_SUFFIXES } from './domains'
import { fetchDomainAge } from './rdap'

export interface RiskResult {
  domain: string
  score: number       // 0–100
  reasons: string[]
}

// Extract the registrable domain (eTLD+1) from a hostname.
// Uses COMPOUND_SUFFIXES for known 2-level public suffixes (co.uk, com.au, etc.)
// so that "mail.google.co.uk" → "google.co.uk", not "co.uk".
export function extractRegistrableDomain(hostname: string): string {
  const lower = hostname.toLowerCase()
  const parts = lower.split('.')
  if (parts.length <= 2) return lower

  // Check if the last two labels form a known compound suffix
  const maybeSuffix = parts.slice(-2).join('.')
  if (COMPOUND_SUFFIXES.has(maybeSuffix)) {
    // eTLD is 2 labels — registrable domain needs 3 labels total
    return parts.length >= 3 ? parts.slice(-3).join('.') : lower
  }

  return parts.slice(-2).join('.')
}

// Leet-speak digit substitutions used in phishing (g00gle → google, paypa1 → paypal)
function normalizeDigits(s: string): string {
  return s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
}

// Detects combosquatting: a known brand name combined with a deceptive keyword
// via hyphen, e.g. paypal-login.com, google-account.com, amazon-security.com.
function detectCombosquatting(baseName: string): { brand: string; keyword: string } | null {
  const parts = baseName.split('-')
  if (parts.length < 2) return null

  const brand = parts.find(p => TOP_DOMAINS.includes(p))
  if (!brand) return null

  const keyword = parts.find(p => PHISHING_KEYWORDS.has(p))
  return keyword ? { brand, keyword } : null
}

interface BaseRisk {
  domain: string
  score: number
  reasons: string[]
  minDist: number
}

// Synchronous core — no network calls. Used by both the blocking check (fast)
// and the full async check (which adds the RDAP age signal on top).
function computeBaseRisk(hostname: string): BaseRisk {
  const domain = extractRegistrableDomain(hostname)
  const reasons: string[] = []
  let score = 0

  // Fast path: exact match to a known brand is the legitimate domain.
  const originalBase = domain.split('.')[0]
  if (TOP_DOMAINS.includes(originalBase)) {
    return { domain, score: 0, reasons: [], minDist: 0 }
  }

  // Punycode IDN — strongest signal for homoglyph attacks
  if (isPunycode(domain)) {
    score += 60
    reasons.push('Domain uses internationalized characters (IDN) — possible homoglyph attack')
  } else if (containsNonASCII(domain)) {
    score += 50
    reasons.push('Domain contains non-ASCII characters that may visually impersonate another site')
  }

  // Homoglyph substitution
  const homoglyphNorm = normalizeHomoglyphs(domain)
  if (homoglyphNorm !== domain) {
    score += 40
    reasons.push('Domain contains characters that visually resemble Latin letters')
  }

  // Digit substitution — leet-speak (g00gle → google, paypa1 → paypal)
  const digitNorm = normalizeDigits(domain)
  if (digitNorm !== domain) {
    const digitBase = digitNorm.split('.')[0]
    if (TOP_DOMAINS.includes(digitBase)) {
      score += 70
      reasons.push(`Domain uses digit substitutions to impersonate "${digitBase}" (e.g. 0→o, 1→i)`)
    } else {
      const digitHomoglyphBase = normalizeHomoglyphs(digitNorm).split('.')[0]
      const distAfterNorm = Math.min(...TOP_DOMAINS.map(b => levenshtein(digitHomoglyphBase, b)))
      if (distAfterNorm <= 1) {
        score += 45
        reasons.push('Domain uses digit substitutions that closely resemble a known brand')
      }
    }
  }

  // Suspicious TLD
  const tld = '.' + domain.split('.').pop()!
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 20
    reasons.push(`Suspicious top-level domain: ${tld}`)
  }

  // Combosquatting: brand + phishing keyword joined by hyphens (paypal-login.com)
  const combo = detectCombosquatting(originalBase)
  if (combo) {
    score += 70
    reasons.push(
      `Domain combines brand "${combo.brand}" with deceptive keyword "${combo.keyword}" — classic combosquatting pattern`,
    )
  }

  // Subdomain abuse: known brand name used as a subdomain label (paypal.evil.com)
  if (domain !== hostname.toLowerCase()) {
    const domainParts = new Set(domain.split('.'))
    const subdomainLabels = hostname.toLowerCase().split('.').filter(l => !domainParts.has(l))

    for (const label of subdomainLabels) {
      const labelParts = label.split('-')
      const subBrand = labelParts.find(p => TOP_DOMAINS.includes(p))
      const subKeyword = labelParts.find(p => PHISHING_KEYWORDS.has(p))

      if (subBrand && subKeyword) {
        score += 70
        reasons.push(
          `Subdomain "${label}" combines brand "${subBrand}" with deceptive keyword "${subKeyword}"`,
        )
      } else if (TOP_DOMAINS.includes(label)) {
        score += 35
        reasons.push(`Brand "${label}" used as a subdomain to impersonate it — possible phishing`)
      }
    }
  }

  // Typosquatting — Levenshtein on the fully-normalised base (homoglyphs + digits stripped)
  const fullNorm = normalizeHomoglyphs(digitNorm)
  const baseName = fullNorm.split('.')[0]
  let minDist = Infinity
  let closestBrand = ''

  for (const brand of TOP_DOMAINS) {
    const dist = levenshtein(baseName, brand)
    if (dist < minDist) {
      minDist = dist
      closestBrand = brand
    }
    if (dist === 0) break
  }

  if (minDist === 1) {
    score += 75
    reasons.push(`Very similar to "${closestBrand}" (1 character off — likely typosquatting)`)
  } else if (minDist === 2) {
    score += 65
    reasons.push(`Similar to "${closestBrand}" (2 characters off — possible typosquatting)`)
  }
  // minDist === 0 already scored above via homoglyph/digit blocks.

  return { domain, score: Math.min(score, 100), reasons, minDist }
}

// Fast synchronous check — used by the navigation blocker (no RDAP network call).
export function calculateRiskScoreSync(hostname: string): RiskResult {
  const { domain, score, reasons } = computeBaseRisk(hostname)
  return { domain, score, reasons }
}

// Full async check — adds RDAP domain age on top of the base score.
// Used for the badge update after navigation completes.
export async function calculateRiskScore(hostname: string): Promise<RiskResult> {
  const base = computeBaseRisk(hostname)
  const { domain, minDist } = base
  let { score, reasons } = base

  if (minDist <= 3) {
    const ageDays = await fetchDomainAge(domain)
    if (ageDays !== null && ageDays < 30) {
      const dayLabel = ageDays === 1 ? '1 day' : `${ageDays} days`
      score += 40
      reasons = [
        ...reasons,
        `Domain registered ${dayLabel} ago — newly registered domains imitating known brands are a strong phishing indicator`,
      ]
    }
  }

  return { domain, score: Math.min(score, 100), reasons }
}

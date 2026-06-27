import { levenshtein } from './levenshtein'
import { isPunycode, containsNonASCII, normalizeHomoglyphs } from './homoglyph'
import { TOP_DOMAINS, SUSPICIOUS_TLDS } from './domains'
import { fetchDomainAge } from './rdap'

export interface RiskResult {
  domain: string
  score: number       // 0–100
  reasons: string[]
}

export async function calculateRiskScore(hostname: string): Promise<RiskResult> {
  const domain = hostname.replace(/^www\./, '').toLowerCase()
  const reasons: string[] = []
  let score = 0

  // Fast path: exact ASCII match to a known brand is the legitimate domain.
  // Must be checked before homoglyph normalization so we don't flag e.g. paypal.com
  // because it normalizes to itself and matches "paypal" in the brand list.
  const originalBase = domain.split('.')[0]
  if (TOP_DOMAINS.includes(originalBase)) {
    return { domain, score: 0, reasons: [] }
  }

  // Punycode IDN — strongest signal for homoglyph attacks
  if (isPunycode(domain)) {
    score += 50
    reasons.push('Domain uses internationalized characters (IDN) — possible homoglyph attack')
  } else if (containsNonASCII(domain)) {
    score += 40
    reasons.push('Domain contains non-ASCII characters that may visually impersonate another site')
  }

  // Homoglyph substitution (Cyrillic/Greek lookalikes in otherwise ASCII-looking domain)
  const normalized = normalizeHomoglyphs(domain)
  if (normalized !== domain) {
    score += 30
    reasons.push('Domain contains characters that visually resemble Latin letters')
  }

  // Suspicious TLD
  const tld = '.' + domain.split('.').pop()!
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 20
    reasons.push(`Suspicious top-level domain: ${tld}`)
  }

  // Typosquatting — run Levenshtein against the normalized base name so that
  // homoglyph domains (e.g. pаypаl → paypal) are caught here too.
  const baseName = normalized.split('.')[0]
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

  if (minDist === 0) {
    // Normalized base matches a known brand exactly — the homoglyph checks above
    // already scored this; no extra points needed.
  } else if (minDist === 1) {
    score += 45
    reasons.push(`Very similar to "${closestBrand}" (1 character off — likely typosquatting)`)
  } else if (minDist === 2) {
    score += 20
    reasons.push(`Similar to "${closestBrand}" (2 characters off)`)
  }

  // RDAP domain age — only checked when the domain is brand-like (minDist ≤ 3)
  // to avoid false positives on legitimate new sites that aren't impersonating anyone.
  if (minDist <= 3) {
    const ageDays = await fetchDomainAge(domain)
    if (ageDays !== null && ageDays < 30) {
      const dayLabel = ageDays === 1 ? '1 day' : `${ageDays} days`
      score += 40
      reasons.push(
        `Domain registered ${dayLabel} ago — newly registered domains imitating known brands are a strong phishing indicator`,
      )
    }
  }

  // Cap the score at 100 to avoid runaway scoring from multiple factors.
  return {
    domain,
    score: Math.min(score, 100),
    reasons,
  }
}

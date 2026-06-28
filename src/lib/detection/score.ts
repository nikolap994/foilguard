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

  const brand = parts.find(p => TOP_DOMAINS.has(p))
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

// IPv4 detection helpers — public IPs in browser URLs are nearly always malicious.
// Private/loopback ranges (10.x, 192.168.x, 172.16-31.x, 127.x) are excluded.
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function isIPv4(h: string): boolean {
  return IPV4_RE.test(h)
}

function isPublicIPv4(h: string): boolean {
  const m = h.match(IPV4_RE)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 127 || a === 10) return false
  if (a === 192 && b === 168) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  return true
}

// Synchronous core — no network calls. Used by both the blocking check (fast)
// and the full async check (which adds the RDAP age signal on top).
function computeBaseRisk(hostname: string): BaseRisk {
  // IP address handling — score public IPs, pass private/loopback through as safe
  if (isIPv4(hostname)) {
    if (!isPublicIPv4(hostname)) return { domain: hostname, score: 0, reasons: [], minDist: 0 }
    return {
      domain: hostname,
      score: 70,
      reasons: ['Direct IP address — real websites use domain names, not numeric addresses. Phishing pages use raw IPs to hide their identity.'],
      minDist: Infinity,
    }
  }

  const domain = extractRegistrableDomain(hostname)
  const reasons: string[] = []
  let score = 0

  // Fast path: exact match to a known brand is the legitimate domain.
  const originalBase = domain.split('.')[0]
  if (TOP_DOMAINS.has(originalBase)) {
    return { domain, score: 0, reasons: [], minDist: 0 }
  }

  // Punycode IDN — strongest signal for homoglyph attacks
  if (isPunycode(domain)) {
    score += 60
    reasons.push('This web address uses special encoded characters designed to look identical to a real site — a technique used to create convincing fake pages')
  } else if (containsNonASCII(domain)) {
    score += 50
    reasons.push('This web address contains characters from other languages that look like normal letters — a trick used to make fake sites appear legitimate')
  }

  // Homoglyph substitution
  const homoglyphNorm = normalizeHomoglyphs(domain)
  if (homoglyphNorm !== domain) {
    score += 40
    reasons.push('One or more characters in this address look like regular letters but come from another alphabet (e.g. Cyrillic or Greek) — making a fake site appear identical to the real one')
  }

  // Digit substitution — leet-speak (g00gle → google, paypa1 → paypal)
  const digitNorm = normalizeDigits(domain)
  if (digitNorm !== domain) {
    const digitBase = digitNorm.split('.')[0]
    if (TOP_DOMAINS.has(digitBase)) {
      score += 70
      reasons.push(`Disguised as ${digitBase}.com — replaces letters with look-alike numbers (like '0' instead of 'o') to trick you into thinking it's the real site`)
    } else {
      const digitHomoglyphBase = normalizeHomoglyphs(digitNorm).split('.')[0]
      const dLen = digitHomoglyphBase.length
      const distAfterNorm = Math.min(...[...TOP_DOMAINS].filter(b => Math.abs(b.length - dLen) <= 1).map(b => levenshtein(digitHomoglyphBase, b)))
      if (distAfterNorm <= 1) {
        score += 45
        reasons.push('Uses numbers in place of letters to look like a well-known website')
      }
    }
  }

  // Suspicious TLD
  const tld = '.' + domain.split('.').pop()!
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 20
    reasons.push(`The '${tld}' domain extension is commonly used for free throwaway sites and is heavily abused for phishing`)
  }

  // Combosquatting: brand + phishing keyword joined by hyphens (paypal-login.com)
  const combo = detectCombosquatting(originalBase)
  if (combo) {
    score += 70
    reasons.push(
      `Combines the real '${combo.brand}' brand name with '${combo.keyword}' to look like an official page — real companies don't put their name in the middle of a domain like this`,
    )
  }

  // Subdomain abuse: known brand name used as a subdomain label (paypal.evil.com)
  if (domain !== hostname.toLowerCase()) {
    const domainParts = new Set(domain.split('.'))
    const subdomainLabels = hostname.toLowerCase().split('.').filter(l => !domainParts.has(l))

    for (const label of subdomainLabels) {
      const labelParts = label.split('-')
      const subBrand = labelParts.find(p => TOP_DOMAINS.has(p))
      const subKeyword = labelParts.find(p => PHISHING_KEYWORDS.has(p))

      if (subBrand && subKeyword) {
        score += 70
        reasons.push(
          `Uses '${subBrand}' and '${subKeyword}' together in the web address to look official — the real ${subBrand}.com would never be formatted this way`,
        )
      } else if (TOP_DOMAINS.has(label)) {
        score += 35
        reasons.push(`'${label}' appears in the web address but this is not the real ${label}.com — a common trick to make phishing links look legitimate`)
      }
    }
  }

  // Typosquatting — Levenshtein on the fully-normalised base (homoglyphs + digits stripped)
  const fullNorm = normalizeHomoglyphs(digitNorm)
  const baseName = fullNorm.split('.')[0]
  let minDist = Infinity
  let closestBrand = ''
  const baseLen = baseName.length

  for (const brand of TOP_DOMAINS) {
    // Levenshtein distance ≥ |length difference|, so skip brands too far in length.
    if (Math.abs(brand.length - baseLen) > 2) continue
    const dist = levenshtein(baseName, brand)
    if (dist < minDist) {
      minDist = dist
      closestBrand = brand
    }
    if (minDist <= 1) break
  }

  // Require a minimum length for both the domain and the matched brand before scoring
  // typosquatting. Short brands like "ea", "okx", "hp" cause too many false positives
  // against short-but-legitimate domains like x.com, dev.to, etc.
  if (minDist === 1 && closestBrand.length >= 4 && baseName.length >= 4) {
    score += 75
    reasons.push(`One letter away from ${closestBrand}.com — designed to catch typos or look convincing at a glance`)
  } else if (minDist === 2 && closestBrand.length >= 5 && baseName.length >= 5) {
    score += 65
    reasons.push(`Looks very similar to ${closestBrand}.com but spelled differently — likely a fake copy`)
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
        `This domain was registered only ${dayLabel} ago — brand-new sites mimicking real companies are a major phishing red flag`,
      ]
    }
  }

  return { domain, score: Math.min(score, 100), reasons }
}

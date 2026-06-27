// Punycode domains start with xn-- — these are IDN domains that may use
// lookalike Unicode characters (e.g. Cyrillic а vs Latin a)
export function isPunycode(domain: string): boolean {
  return domain.split('.').some((label) => label.startsWith('xn--'))
}

// Detects non-ASCII characters in a domain that was not encoded as punycode.
// Browsers encode IDN domains before navigation, but some phishing kits
// inject raw unicode into the DOM to trick users reading the address bar.
export function containsNonASCII(domain: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(domain)
}

// Common homoglyph substitutions used in phishing (Cyrillic, Greek, Latin lookalikes)
const HOMOGLYPH_MAP: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', // Cyrillic
  'ο': 'o', 'ν': 'v', 'μ': 'u',                                  // Greek
  'ɡ': 'g', 'ı': 'i', 'ʟ': 'l',                                  // Latin variants
}

// Returns the domain with all known homoglyphs replaced by their ASCII equivalent.
// Used to compare a suspicious domain against known legitimate ones.
export function normalizeHomoglyphs(domain: string): string {
  return domain
    .split('')
    .map((ch) => HOMOGLYPH_MAP[ch] ?? ch)
    .join('')
}

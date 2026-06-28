export function isPunycode(domain: string): boolean {
  return domain.split('.').some((label) => label.startsWith('xn--'))
}

export function containsNonASCII(domain: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(domain)
}

// Comprehensive homoglyph map covering the most-abused Unicode lookalikes.
// Sources: Unicode confusables.txt (https://unicode.org/Public/security/latest/confusables.txt),
// filtered to characters that realistically appear in phishing domain names.
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic — exact visual matches to Latin
  'а': 'a', // а → a
  'е': 'e', // е → e
  'о': 'o', // о → o
  'р': 'p', // р → p
  'с': 'c', // с → c
  'х': 'x', // х → x
  'у': 'y', // у → y
  'і': 'i', // і → i
  'ј': 'j', // ј → j
  'ѕ': 's', // ѕ → s
  'ԁ': 'd', // ԁ → d
  'ԛ': 'q', // ԛ → q
  'һ': 'h', // һ → h

  // Greek
  'ο': 'o', // ο → o
  'ν': 'v', // ν → v
  'μ': 'u', // μ → u
  'η': 'n', // η → n
  'α': 'a', // α → a
  'ε': 'e', // ε → e
  'ρ': 'r', // ρ → r
  'τ': 't', // τ → t
  'υ': 'y', // υ → y
  'ω': 'w', // ω → w
  'κ': 'k', // κ → k
  'γ': 'y', // γ → y
  'ι': 'i', // ι → i
  'β': 'b', // β → b
  'δ': 'd', // δ → d
  'ζ': 'z', // ζ → z

  // Latin variants
  'ɡ': 'g', // ɡ → g
  'ı': 'i', // ı → i
  'ʟ': 'l', // ʟ → l
  'ƅ': 'b', // ƅ → b
  'ɑ': 'a', // ɑ → a
  'ɩ': 'i', // ɩ → i
  'ɔ': 'o', // ɔ → o
  'ʙ': 'b', // ʙ → b
  'ʜ': 'h', // ʜ → h
  'ᴋ': 'k', // ᴋ → k
  'ᴍ': 'm', // ᴍ → m
  'ɴ': 'n', // ɴ → n
  'ᴘ': 'p', // ᴘ → p
  'ʀ': 'r', // ʀ → r
  'ꜱ': 's', // ꜱ → s
  'ᴛ': 't', // ᴛ → t
  'ᴜ': 'u', // ᴜ → u
  'ᴠ': 'v', // ᴠ → v
  'ᴡ': 'w', // ᴡ → w
  'ʏ': 'y', // ʏ → y
  'ᴢ': 'z', // ᴢ → z

  // Fullwidth ASCII (U+FF41–U+FF5A)
  'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
  'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
  'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
  'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
  'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y',
  'ｚ': 'z',
}

export function normalizeHomoglyphs(domain: string): string {
  return domain
    .split('')
    .map((ch) => HOMOGLYPH_MAP[ch] ?? ch)
    .join('')
}

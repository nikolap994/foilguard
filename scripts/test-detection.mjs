// Detection engine smoke tests — no real Chrome extension environment needed.
// Run: npm test
// Tests marked [network] hit rdap.org and may be slow or fail offline.

// ---------- Chrome API mock ----------
// rdap.ts now uses chrome.storage.session for caching. Mock it so tests
// run in Node.js without a browser. Cache misses fall through to real RDAP.
globalThis.chrome = {
  storage: {
    session: {
      get: async () => ({}),
      set: async () => {},
    },
    local: {
      get: async () => ({}),
      set: async () => {},
    },
    managed: {
      get: async () => { throw new Error('not managed') },
    },
  },
}

import { levenshtein } from '../src/lib/detection/levenshtein.ts'
import { isPunycode, containsNonASCII, normalizeHomoglyphs } from '../src/lib/detection/homoglyph.ts'
import { extractRegistrableDomain, calculateRiskScoreSync, calculateRiskScore } from '../src/lib/detection/score.ts'
import { fetchDomainAge } from '../src/lib/detection/rdap.ts'

let passed = 0
let failed = 0

function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) console.log(`    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}`)
  ok ? passed++ : failed++
}

function section(name) {
  console.log(`\n--- ${name} ---`)
}

// ─── Levenshtein ───────────────────────────────────────────────────────────
section('Levenshtein')
expect('identical strings',                  levenshtein('google', 'google'), 0)
expect('1 char deleted  — gogle',            levenshtein('gogle', 'google'), 1)
expect('1 char inserted — gooogle',          levenshtein('gooogle', 'google'), 1)
expect('2 chars off     — googel',           levenshtein('googel', 'google'), 2)
expect('completely different words',         levenshtein('paypal', 'amazon') > 3, true)

// ─── Homoglyphs ────────────────────────────────────────────────────────────
section('Homoglyphs')
expect('isPunycode: IDN domain',             isPunycode('xn--pple-43d.com'), true)
expect('isPunycode: normal domain',          isPunycode('apple.com'), false)
expect('containsNonASCII: ASCII clean',      containsNonASCII('paypal.com'), false)
// Cyrillic а (U+0430)
expect('normalizeHomoglyphs: Cyrillic а→a',  normalizeHomoglyphs('pаypаl.com'), 'paypal.com')
// Greek ο (U+03BF), ο→o
expect('normalizeHomoglyphs: Greek ο→o',     normalizeHomoglyphs('gοοgle.com'), 'google.com')
// Fullwidth ｇ (U+FF47)
expect('normalizeHomoglyphs: fullwidth g→g', normalizeHomoglyphs('ｇoogle.com'), 'google.com')
// Latin variant ɡ (U+0261)
expect('normalizeHomoglyphs: ɡ→g',          normalizeHomoglyphs('ɡoogle.com'), 'google.com')

// ─── Domain extraction (PSL-aware) ─────────────────────────────────────────
section('Domain extraction')
expect('plain domain unchanged',             extractRegistrableDomain('google.com'), 'google.com')
expect('strips www.',                        extractRegistrableDomain('www.google.com'), 'google.com')
expect('strips mail. subdomain',             extractRegistrableDomain('mail.google.com'), 'google.com')
expect('deep subdomain stripped',            extractRegistrableDomain('a.b.google.com'), 'google.com')
expect('co.uk — keeps 3 labels',            extractRegistrableDomain('google.co.uk'), 'google.co.uk')
expect('co.uk — strips subdomain correctly',extractRegistrableDomain('login.google.co.uk'), 'google.co.uk')
expect('com.au — keeps 3 labels',           extractRegistrableDomain('google.com.au'), 'google.com.au')
expect('edu.au — keeps 3 labels',           extractRegistrableDomain('mit.edu.au'), 'mit.edu.au')

// ─── Score: safe / legitimate domains ──────────────────────────────────────
section('Safe domains (sync)')
expect('google.com → 0',    calculateRiskScoreSync('google.com').score, 0)
expect('paypal.com → 0',    calculateRiskScoreSync('paypal.com').score, 0)
expect('github.com → 0',    calculateRiskScoreSync('github.com').score, 0)
expect('mail.google.com → 0 (subdomain of known brand)',
  calculateRiskScoreSync('mail.google.com').score, 0)
expect('accounts.google.com → 0',
  calculateRiskScoreSync('accounts.google.com').score, 0)
expect('login.microsoft.com → 0',
  calculateRiskScoreSync('login.microsoft.com').score, 0)

// ─── Score: typosquatting ───────────────────────────────────────────────────
section('Typosquatting (sync)')
const gogle    = calculateRiskScoreSync('gogle.com')      // dist 1 from google
const facebok  = calculateRiskScoreSync('facebok.com')    // dist 1 from facebook
const googel   = calculateRiskScoreSync('googel.com')     // dist 2 from google
const rnicrosoft = calculateRiskScoreSync('rnicrosoft.com') // dist 2 from microsoft

expect('gogle.com → score >= 75 (dist-1)',        gogle.score >= 75, true)
expect('gogle.com → has reasons',                 gogle.reasons.length > 0, true)
expect('facebok.com → score >= 75 (dist-1)',      facebok.score >= 75, true)
expect('googel.com → score >= 65 (dist-2)',       googel.score >= 65, true)
expect('rnicrosoft.com → score >= 65 (dist-2)',   rnicrosoft.score >= 65, true)
expect('rnicrosoft.com → blocked (>= 65)',        rnicrosoft.score >= 65, true)

// ─── Score: digit substitution ─────────────────────────────────────────────
section('Digit substitution (sync)')
const g00gle   = calculateRiskScoreSync('g00gle.com')    // 0→o
const paypa1   = calculateRiskScoreSync('paypa1.com')    // 1→i
const amaz0n   = calculateRiskScoreSync('amaz0n.com')    // 0→o

expect('g00gle.com → score >= 65 (blocked)',      g00gle.score >= 65, true)
expect('g00gle.com → digit substitution reason',  g00gle.reasons.some(r => r.includes('numbers') || r.includes('look-alike')), true)
expect('paypa1.com → score >= 65 (blocked)',      paypa1.score >= 65, true)
expect('amaz0n.com → score >= 65 (blocked)',      amaz0n.score >= 65, true)

// ─── Score: combosquatting ─────────────────────────────────────────────────
section('Combosquatting (sync)')
const paypalLogin    = calculateRiskScoreSync('paypal-login.com')
const amazonSecurity = calculateRiskScoreSync('amazon-security.com')
const googleAccount  = calculateRiskScoreSync('google-account.com')
const linkedinLearn  = calculateRiskScoreSync('linkedin-learning.com')  // legit-ish, no phishing keyword

expect('paypal-login.com → score >= 65 (blocked)',        paypalLogin.score >= 65, true)
expect('paypal-login.com → combosquatting reason',        paypalLogin.reasons.some(r => r.includes('comboSquat') || r.includes('comboSquat') || r.includes('keyword') || r.includes('brand')), true)
expect('amazon-security.com → score >= 65 (blocked)',     amazonSecurity.score >= 65, true)
expect('google-account.com → score >= 65 (blocked)',      googleAccount.score >= 65, true)
expect('linkedin-learning.com → NOT blocked (no phishing keyword)',
  linkedinLearn.score < 65, true)

// ─── Score: subdomain abuse ────────────────────────────────────────────────
section('Subdomain abuse (sync)')
const paypalEvil     = calculateRiskScoreSync('paypal.evil.com')
const googleEvil     = calculateRiskScoreSync('google.malicious.xyz')

expect('paypal.evil.com → score > 0 (brand in subdomain)',   paypalEvil.score > 0, true)
expect('paypal.evil.com → subdomain reason',                 paypalEvil.reasons.some(r => r.includes('web address') || r.includes('phishing')), true)
expect('google.malicious.xyz → score > 0',                   googleEvil.score > 0, true)

// ─── Score: IDN / homoglyph domains ────────────────────────────────────────
section('IDN and homoglyph scoring (sync)')
const punycode = calculateRiskScoreSync('xn--pple-43d.com')
const cyrillic = calculateRiskScoreSync('pаypаl.com')         // Cyrillic а

expect('IDN punycode domain → score >= 60',          punycode.score >= 60, true)
expect('Cyrillic paypal → score >= 60',              cyrillic.score >= 60, true)
expect('Cyrillic paypal → reason mentions characters',
  cyrillic.reasons.some(r => r.includes('characters') || r.includes('alphabet')), true)

// ─── Score: raw IP detection ───────────────────────────────────────────────
section('Raw IP detection (sync)')
expect('203.0.113.5 → public IP flagged',    calculateRiskScoreSync('203.0.113.5').score >= 65, true)
expect('192.168.1.1 → private IP not flagged', calculateRiskScoreSync('192.168.1.1').score, 0)
expect('10.0.0.1 → private IP not flagged',    calculateRiskScoreSync('10.0.0.1').score, 0)
expect('127.0.0.1 → loopback not flagged',     calculateRiskScoreSync('127.0.0.1').score, 0)

// ─── Score: false positive regression ─────────────────────────────────────
section('False positive regressions (sync)')
expect('x.com → score 0 (Twitter/X, short domain)',   calculateRiskScoreSync('x.com').score, 0)
expect('dev.to → score 0 (developer community site)', calculateRiskScoreSync('dev.to').score, 0)
expect('t.co → score 0 (Twitter short link)',          calculateRiskScoreSync('t.co').score, 0)

// ─── Score: suspicious TLDs ────────────────────────────────────────────────
section('Suspicious TLDs (sync)')
expect('brand-like.tk → TLD penalty',  calculateRiskScoreSync('something.tk').score >= 20, true)
expect('brand-like.xyz → TLD penalty', calculateRiskScoreSync('something.xyz').score >= 20, true)

// ─── RDAP: fail-open contract ──────────────────────────────────────────────
section('RDAP fail-open [network]')
const badDomain = await fetchDomainAge('not-a-real-domain-xyzxyz123.com')
expect('unknown domain → null or number (fail open)',
  badDomain === null || typeof badDomain === 'number', true)

// Ensure RDAP null does not lower a typosquat score already above threshold
const gogleAsync = await calculateRiskScore('gogle.com')
expect('gogle.com async → still blocked after RDAP', gogleAsync.score >= 65, true)

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
